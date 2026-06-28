import express from "express";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";
import cors from "cors";
import Razorpay from "razorpay";

dotenv.config();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Base SMM Configuration
let SMM_API_KEY = process.env.SMM_API_KEY || "4f875a1ab9fc4c8ca31cb98a6e82e98c";
let SMM_API_URL = process.env.SMM_API_URL || "https://socialuphub-backend.onrender.com/api/v2";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://mfrnehshclymmydtykpa.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcm5laHNoY2x5bW15ZHR5a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQyNjUsImV4cCI6MjA5NzcxMDI2NX0.dhdfx9xURndzS6MSSsZmH5HI0O59VAY8Vfl7UZt4yxM";

const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);

let PROFIT_MARKUP_PERCENT = 15;
let LANDING_VIDEO_URL = ""; // Removed rickroll demo video
let PINNED_CATEGORY = "";
let STARRED_SERVICES: string[] = [];

// Advanced Admin Overrides - DEPRECATED (Now DB Driven)

// Load Config from Supabase on start
async function loadServerSettings() {
  try {
    const { data: dbSettings, error } = await supabase
      .from("global_settings")
      .select("*");
    if (dbSettings && !error) {
      for (const row of dbSettings) {
        if (row.key === "profit_markup_percent") {
          PROFIT_MARKUP_PERCENT = parseFloat(row.value) || 15;
        } else if (row.key === "landing_video_url") {
          LANDING_VIDEO_URL = row.value;
        } else if (row.key === "pinned_category") {
          PINNED_CATEGORY = row.value || "";
        } else if (row.key === "starred_services") {
          try {
            STARRED_SERVICES = JSON.parse(row.value) || [];
          } catch (e) {
            STARRED_SERVICES = row.value ? row.value.split(",").map((s: any) => String(s).trim()) : [];
          }
        } else if (row.key === "smm_api_key") {
          if (row.value && row.value.trim() !== "" && row.value !== "null") {
            SMM_API_KEY = row.value.trim();
          }
        } else if (row.key === "smm_api_url") {
          let loadedUrl = row.value || "https://socialuphub-backend.onrender.com/api/v2";
          if (loadedUrl.includes("socialuphub.in")) {
            loadedUrl = "https://socialuphub-backend.onrender.com/api/v2";
          }
          if (loadedUrl && loadedUrl.trim() !== "" && loadedUrl !== "null") {
            SMM_API_URL = loadedUrl.trim();
          }
        }
      }
      console.log("Successfully loaded config settings from Supabase:", {
        PROFIT_MARKUP_PERCENT,
        LANDING_VIDEO_URL,
        SMM_API_KEY: SMM_API_KEY ? "CONFIGURED" : "MISSING",
        SMM_API_URL,
      });
    }
  } catch (err) {
    console.warn(
      "Could not load global settings from Supabase, relying on in-memory cache.",
    );
  }
}
loadServerSettings();

const app = express();
app.use(cors({ origin: true, credentials: true }));
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting / brute force protection for admin panel
interface RateLimitInfo {
  attempts: number[];
  blockedUntil: number;
}

const adminLoginLimits = new Map<string, RateLimitInfo>();

const ADMIN_BRUTE_FORCE_WINDOW_MS = 60 * 1000; // 1 minute
const ADMIN_MAX_ATTEMPTS = 100;
const ADMIN_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes temporary block

function getClientIp(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded)) {
      return forwarded[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

const adminRateLimiter = (req: any, res: any, next: any) => {
  const ip = getClientIp(req);
  const now = Date.now();

  let limitInfo = adminLoginLimits.get(ip);
  if (!limitInfo) {
    limitInfo = { attempts: [], blockedUntil: 0 };
    adminLoginLimits.set(ip, limitInfo);
  }

  // Check if temporarily blocked
  if (limitInfo.blockedUntil > now) {
    const remainingTime = Math.ceil((limitInfo.blockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      error: `Too many attempts from this IP. Temporarily blocked. Please try again in ${remainingTime} seconds.`
    });
  }

  // Clean up attempts older than the window (1 minute)
  limitInfo.attempts = limitInfo.attempts.filter(timestamp => now - timestamp < ADMIN_BRUTE_FORCE_WINDOW_MS);

  // Add current attempt
  limitInfo.attempts.push(now);

  // Check if max attempts reached
  if (limitInfo.attempts.length > ADMIN_MAX_ATTEMPTS) {
    limitInfo.blockedUntil = now + ADMIN_BLOCK_DURATION_MS;
    adminLoginLimits.set(ip, limitInfo);
    
    return res.status(429).json({
      success: false,
      error: `Too many attempts. Your IP has been temporarily blocked for 15 minutes.`
    });
  }

  next();
};

app.use("/api/smm/admin", adminRateLimiter);

// Helper: safe fetch with form-urlencoded
async function callSmmApi(payload: Record<string, string>) {
  try {
    await loadServerSettings();
    if (!payload.key || payload.key === "null" || payload.key === "") {
      payload.key = SMM_API_KEY;
    }
    if (!payload.key || payload.key.trim() === "" || payload.key === "null") {
      console.log("[Info] SMM API is currently in Demo/Unconfigured mode.");
      if (payload.action === "services") {
        return [];
      } else if (payload.action === "balance") {
        return { balance: "24500.00", currency: "INR" };
      }
      return { success: false, error: "unconfigured" };
    }
    const bodyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      bodyParams.append(key, value);
    }

    const response = await fetch(SMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: bodyParams.toString(),
      timeout: 30000,
    } as any);

    const text = await response.text();
    const trimmedText = text.trim();

    // Check for HTML response
    if (
      trimmedText.startsWith("<") ||
      trimmedText.toLowerCase().includes("<!doctype html") ||
      trimmedText.toLowerCase().includes("<html")
    ) {
      throw new Error(
        "Provider API is waking up or offline. Please refresh or try again in a few seconds.",
      );
    }

    let data;
    let isJson = false;
    try {
      data = JSON.parse(text);
      isJson = true;
    } catch (parseErr) {
      // Not JSON
    }

    if (isJson) {
      if (data && data.error) {
        throw new Error(data.error);
      }
      if (!response.ok) {
        throw new Error(
          `SMM Server error (Status ${response.status}): ${response.statusText}`,
        );
      }
      return data;
    } else {
      if (!response.ok) {
        throw new Error(
          `SMM Server error (Status ${response.status}): ${response.statusText}`,
        );
      }
      throw new Error(
        `Failed to parse SMM response as JSON: ${trimmedText.slice(0, 100)}`,
      );
    }
  } catch (err: any) {
    console.warn("[API] SMM API call failed:", err.message);
    throw err;
  }
}

async function getApiCategorySortMap(): Promise<Map<string, number>> {
  const sortMap = new Map<string, number>();
  if (!SMM_API_KEY) return sortMap;
  try {
    const cats = await callSmmApi({ key: SMM_API_KEY, action: "categories" });
    if (Array.isArray(cats)) {
      cats.forEach((catItem, idx) => {
        const catName = catItem.name || catItem.category;
        if (catName) {
          let order = idx;
          if (catItem.sortOrder !== undefined && catItem.sortOrder !== null) {
            const parsed = parseInt(catItem.sortOrder);
            if (!isNaN(parsed)) order = parsed;
          } else if (catItem.sort !== undefined && catItem.sort !== null) {
            const parsed = parseInt(catItem.sort);
            if (!isNaN(parsed)) order = parsed;
          } else if (
            catItem.sort_order !== undefined &&
            catItem.sort_order !== null
          ) {
            const parsed = parseInt(catItem.sort_order);
            if (!isNaN(parsed)) order = parsed;
          } else if (catItem.order !== undefined && catItem.order !== null) {
            const parsed = parseInt(catItem.order);
            if (!isNaN(parsed)) order = parsed;
          }
          sortMap.set(catName.toLowerCase().trim(), order);
        }
      });
    }
  } catch (err: any) {
    console.warn(
      "[API] Could not fetch categories from SMM API (action: categories):",
      err.message,
    );
  }
  return sortMap;
}

// === CATALOG & SERVICES ===

// 5. Cache for services to improve performance
let servicesCache: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory caches for admin pages to provide "bullet speed" instant load
let adminCategoriesCache: any = null;
let adminServicesCache: any = null;

let lastBackgroundSyncTime = 0;
const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Background sync task for prices and services to keep them realtime
async function backgroundSyncPrices() {
  if (!SMM_API_KEY) {
    console.warn(
      "[Background] Sync skipped: No SMM_API_KEY provided in environment.",
    );
    return;
  }

  try {
    console.log("[Background] Sync started...");
    const rawServices: any[] = await callSmmApi({
      key: SMM_API_KEY,
      action: "services",
    });
    if (!Array.isArray(rawServices) || rawServices.length === 0) {
      console.warn("[Background] Received empty catalog from provider.");
      return;
    }

    // Batch Sync Categories
    const apiCategorySortMap = await getApiCategorySortMap();
    const categoryMap = new Map<string, { name: string; sort_order: number }>();
    rawServices.forEach((item, index) => {
      const name = item.category || "Other";
      if (!categoryMap.has(name)) {
        let order = index;
        const normalized = name.toLowerCase().trim();
        if (apiCategorySortMap.has(normalized)) {
          order = apiCategorySortMap.get(normalized)!;
        } else if (
          item.category_sort !== undefined &&
          item.category_sort !== null
        ) {
          const parsed = parseInt(item.category_sort);
          if (!isNaN(parsed)) order = parsed;
        } else if (
          item.category_sort_order !== undefined &&
          item.category_sort_order !== null
        ) {
          const parsed = parseInt(item.category_sort_order);
          if (!isNaN(parsed)) order = parsed;
        } else if (
          item.category_order !== undefined &&
          item.category_order !== null
        ) {
          const parsed = parseInt(item.category_order);
          if (!isNaN(parsed)) order = parsed;
        } else if (item.sort_order !== undefined && item.sort_order !== null) {
          const parsed = parseInt(item.sort_order);
          if (!isNaN(parsed)) order = parsed;
        } else if (item.sort !== undefined && item.sort !== null) {
          const parsed = parseInt(item.sort);
          if (!isNaN(parsed)) order = parsed;
        }
        categoryMap.set(name, { name, sort_order: order });
      }
    });
    const { data: existingCats } = await supabase
      .from("smm_categories")
      .select("name, sort_order");

    const categoryData = Array.from(categoryMap.values()).map((cat) => {
      const existing = existingCats?.find(ec => ec.name === cat.name);
      return {
        name: cat.name,
        sort_order: existing && existing.sort_order !== null && existing.sort_order !== undefined
          ? existing.sort_order
          : cat.sort_order,
      };
    });
    await supabase
      .from("smm_categories")
      .upsert(categoryData, { onConflict: "name" });

    // Batch Sync Services
    const batchSize = 100;
    for (let i = 0; i < rawServices.length; i += batchSize) {
      const chunk = rawServices.slice(i, i + batchSize);
      const serviceData = chunk.map((item) => {
        const obj: any = {
          service_id: parseInt(item.service),
          category_name: item.category || "Other",
          api_name: item.name,
          provider_rate: parseFloat(item.rate),
          min_order: parseInt(item.min),
          max_order: parseInt(item.max),
          type: item.type || "Default",
          refill: !!item.refill,
        };
        if (item.description !== undefined && item.description !== null) {
          obj.custom_description = item.description;
        }
        return obj;
      });
      await supabase
        .from("smm_services")
        .upsert(serviceData, { onConflict: "service_id" });
    }

    servicesCache = null;
    adminCategoriesCache = null;
    adminServicesCache = null;
    lastBackgroundSyncTime = Date.now();
    console.log(
      `[Background] Sync completed successfully. Processed ${rawServices.length} services.`,
    );
  } catch (err: any) {
    console.error("[Background] Sync failed with exception:", err.message);
  }
}

async function syncIncompleteOrders() {
  console.log("[Sync Orders] Fetching incomplete orders from database...");
  if (!SMM_API_KEY) {
    console.log("[Sync Orders] Skipped: SMM API key is missing.");
    return { count: 0, updated: 0, refunds: 0 };
  }

  // Fetch orders that are not completed and not cancelled
  const { data: incompleteOrders, error: fetchErr } = await supabase
    .from("orders")
    .select("*")
    .not("status", "in", '("Completed","Cancelled")');

  if (fetchErr) {
    console.error("[Sync Orders] Failed to fetch incomplete orders:", fetchErr.message);
    return { count: 0, updated: 0, refunds: 0 };
  }

  if (!incompleteOrders || incompleteOrders.length === 0) {
    console.log("[Sync Orders] No incomplete orders found.");
    return { count: 0, updated: 0, refunds: 0 };
  }

  console.log(`[Sync Orders] Found ${incompleteOrders.length} incomplete orders. Polling provider...`);

  let updatedCount = 0;
  let refundCount = 0;

  for (const order of incompleteOrders) {
    const provId = order.provider_order_id;
    if (!provId) continue;

    try {
      const statusResp = await callSmmApi({
        key: SMM_API_KEY,
        action: "status",
        order: String(provId),
      });

      if (statusResp && statusResp.status) {
        let newStatus = order.status;
        const provStatus = String(statusResp.status).toLowerCase();

        // Standard SMM status mapping
        if (provStatus.includes("completed") || provStatus.includes("success")) {
          newStatus = "Completed";
        } else if (
          provStatus.includes("canceled") ||
          provStatus.includes("cancelled") ||
          provStatus.includes("fail")
        ) {
          newStatus = "Cancelled";
        } else if (
          provStatus.includes("progress") ||
          provStatus.includes("process") ||
          provStatus.includes("pending")
        ) {
          newStatus = "In Progress";
        } else if (provStatus.includes("partial")) {
          newStatus = "Cancelled"; // Mark as cancelled to trigger refund
        }

        if (newStatus !== order.status) {
          console.log(`[Sync Orders] Order ${order.id} status change: ${order.status} -> ${newStatus}`);
          
          // Update order status in db
          await supabase
            .from("orders")
            .update({ status: newStatus })
            .eq("id", order.id);

          updatedCount++;

          // If the order is newly cancelled, refund the user!
          if (newStatus === "Cancelled") {
            const refundValue = parseFloat(order.charge);
            if (refundValue > 0 && order.user_email) {
              console.log(`[Sync Orders] Order ${order.id} cancelled. Refunding ₹${refundValue} to ${order.user_email}`);
              
              // 1. Fetch user profile to get current balance
              const { data: profile } = await supabase
                .from("profiles")
                .select("balance")
                .eq("email", order.user_email)
                .single();

              const currentBal = profile ? parseFloat(profile.balance || "0") : 0;
              const nextBal = currentBal + refundValue;

              // 2. Update user balance in profiles
              await supabase
                .from("profiles")
                .update({ balance: nextBal })
                .eq("email", order.user_email);

              // 3. Log Refund Transaction in database
              const refundTxId = "TXN-REF" + Math.floor(100000 + Math.random() * 900000);
              await supabase
                .from("transactions")
                .insert({
                  id: refundTxId,
                  user_email: order.user_email,
                  amount: refundValue,
                  method: "Cancellation Refund",
                  status: "Success",
                  created_at: new Date().toISOString()
                });

              refundCount++;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Sync Orders] Could not sync status for order ${order.id}:`, err.message);
    }
  }

  console.log(`[Sync Orders] Finished sync. Updated: ${updatedCount}, Refunded: ${refundCount}`);
  return { count: incompleteOrders.length, updated: updatedCount, refunds: refundCount };
}

// Start background task every 15 minutes to check prices and update database
setInterval(() => {
  console.log("[Background] Running scheduled 15-minute price check and database update...");
  backgroundSyncPrices().catch((err) => console.error("[Background] Interval sync failed:", err.message));
}, 15 * 60 * 1000);

// Initial sync on start
setTimeout(backgroundSyncPrices, 10000);

app.post("/api/smm/admin/services/sync", async (req, res) => {
  try {
    const { force_reset } = req.body || {};
    console.log(`[Admin] Sync started. Force Reset: ${!!force_reset}`);

    if (!SMM_API_KEY) throw new Error("SMM API Key is missing.");

    const rawServices: any[] = await callSmmApi({
      key: SMM_API_KEY,
      action: "services",
    });
    if (!Array.isArray(rawServices) || rawServices.length === 0) {
      throw new Error(
        "Invalid format or empty response from SMM API provider.",
      );
    }

    if (force_reset) {
      console.log("Force resetting database records...");
      await supabase.from("smm_services").delete().gt("service_id", 0);
      await supabase.from("smm_categories").delete().neq("name", "");
    }

    // Sync Categories in batches
    const apiCategorySortMap = await getApiCategorySortMap();
    const categoryMap = new Map<string, { name: string; sort_order: number }>();
    rawServices.forEach((item, index) => {
      const name = item.category || "Other";
      if (!categoryMap.has(name)) {
        let order = index;
        const normalized = name.toLowerCase().trim();
        if (apiCategorySortMap.has(normalized)) {
          order = apiCategorySortMap.get(normalized)!;
        } else if (
          item.category_sort !== undefined &&
          item.category_sort !== null
        ) {
          const parsed = parseInt(item.category_sort);
          if (!isNaN(parsed)) order = parsed;
        } else if (
          item.category_sort_order !== undefined &&
          item.category_sort_order !== null
        ) {
          const parsed = parseInt(item.category_sort_order);
          if (!isNaN(parsed)) order = parsed;
        } else if (
          item.category_order !== undefined &&
          item.category_order !== null
        ) {
          const parsed = parseInt(item.category_order);
          if (!isNaN(parsed)) order = parsed;
        } else if (item.sort_order !== undefined && item.sort_order !== null) {
          const parsed = parseInt(item.sort_order);
          if (!isNaN(parsed)) order = parsed;
        } else if (item.sort !== undefined && item.sort !== null) {
          const parsed = parseInt(item.sort);
          if (!isNaN(parsed)) order = parsed;
        }
        categoryMap.set(name, { name, sort_order: order });
      }
    });
    const { data: existingCats } = await supabase
      .from("smm_categories")
      .select("name, sort_order");

    const catData = Array.from(categoryMap.values()).map((cat) => {
      const existing = existingCats?.find(ec => ec.name === cat.name);
      return {
        name: cat.name,
        sort_order: existing && existing.sort_order !== null && existing.sort_order !== undefined
          ? existing.sort_order
          : cat.sort_order,
      };
    });
    await supabase
      .from("smm_categories")
      .upsert(catData, { onConflict: "name" });

    console.log(`Syncing ${rawServices.length} items in batches...`);

    // Batch Sync Services
    const batchSize = 100;
    for (let i = 0; i < rawServices.length; i += batchSize) {
      const chunk = rawServices.slice(i, i + batchSize);
      const serviceData = chunk.map((item) => {
        const obj: any = {
          service_id: parseInt(item.service),
          category_name: item.category || "Other",
          api_name: item.name,
          provider_rate: parseFloat(item.rate),
          min_order: parseInt(item.min),
          max_order: parseInt(item.max),
          type: item.type || "Default",
          refill: !!item.refill,
        };
        if (item.description !== undefined && item.description !== null) {
          obj.custom_description = item.description;
        }
        return obj;
      });
      await supabase
        .from("smm_services")
        .upsert(serviceData, { onConflict: "service_id" });
    }

    servicesCache = null;
    adminCategoriesCache = null;
    adminServicesCache = null;
    const balanceRes = await callSmmApi({
      key: SMM_API_KEY,
      action: "balance",
    }).catch(() => ({ balance: 0 }));

    const orderSyncResult = await syncIncompleteOrders().catch((e) => {
      console.error("Order status sync failed during admin services sync:", e);
      return { count: 0, updated: 0, refunds: 0 };
    });

    console.log(`[Admin] Sync finished. Items: ${rawServices.length}`);
    res.json({
      success: true,
      count: rawServices.length,
      balance: balanceRes.balance || 0,
      ordersProcessed: orderSyncResult.count,
      ordersUpdated: orderSyncResult.updated,
      ordersRefunded: orderSyncResult.refunds,
    });
  } catch (err: any) {
    console.error("[Admin] Sync error:", err);
    res.status(500).json({ success: false, error: err.message || JSON.stringify(err) || "Unknown backend error" });
  }
});

app.post("/api/smm/services", async (req, res) => {
  try {
    const { force_sync } = req.body || {};

    // 1. Check Cache
    if (
      !force_sync &&
      servicesCache &&
      Date.now() - lastCacheUpdate < CACHE_TTL
    ) {
      return res.json({ success: true, services: servicesCache });
    }

    // 2. Fetch from Database
    const { data: dbCategories, error: catErr } = await supabase
      .from("smm_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    let { data: dbServices, error: svcErr } = await supabase
      .from("smm_services")
      .select("*")
      .eq("is_active", true)
      .order("service_id", { ascending: true });

    if (catErr) console.error("[Services] Category fetch error:", catErr);
    if (svcErr) console.error("[Services] Service fetch error:", svcErr);

    // 3. Fallback to API if DB is empty or force sync requested
    const shouldSync = force_sync || !dbServices || dbServices.length === 0;

    // Trigger background sync if cooldown has passed, to ensure live prices
    if (!shouldSync && Date.now() - lastBackgroundSyncTime > SYNC_COOLDOWN) {
      lastBackgroundSyncTime = Date.now();
      backgroundSyncPrices().catch(e => console.error("Auto background sync error:", e));
    }

    if (shouldSync && SMM_API_KEY) {
      console.log(
        "[Services] Catalog empty or force sync, fetching from provider...",
      );
      const rawServices: any[] = await callSmmApi({
        key: SMM_API_KEY,
        action: "services",
      }).catch((err) => {
        console.warn(
          "[Services] API fetch failed during fallback:",
          err.message,
        );
        return [];
      });

      if (Array.isArray(rawServices) && rawServices.length > 0) {
        // Sync categories
        const apiCategorySortMap = await getApiCategorySortMap();
        const categoryMap = new Map<
          string,
          { name: string; sort_order: number }
        >();
        rawServices.forEach((item, index) => {
          const name = item.category || "Other";
          if (!categoryMap.has(name)) {
            let order = index;
            const normalized = name.toLowerCase().trim();
            if (apiCategorySortMap.has(normalized)) {
              order = apiCategorySortMap.get(normalized)!;
            } else if (
              item.category_sort !== undefined &&
              item.category_sort !== null
            ) {
              const parsed = parseInt(item.category_sort);
              if (!isNaN(parsed)) order = parsed;
            } else if (
              item.category_sort_order !== undefined &&
              item.category_sort_order !== null
            ) {
              const parsed = parseInt(item.category_sort_order);
              if (!isNaN(parsed)) order = parsed;
            } else if (
              item.category_order !== undefined &&
              item.category_order !== null
            ) {
              const parsed = parseInt(item.category_order);
              if (!isNaN(parsed)) order = parsed;
            } else if (
              item.sort_order !== undefined &&
              item.sort_order !== null
            ) {
              const parsed = parseInt(item.sort_order);
              if (!isNaN(parsed)) order = parsed;
            } else if (item.sort !== undefined && item.sort !== null) {
              const parsed = parseInt(item.sort);
              if (!isNaN(parsed)) order = parsed;
            }
            categoryMap.set(name, { name, sort_order: order });
          }
        });
        const { data: existingCats } = await supabase
          .from("smm_categories")
          .select("name, sort_order");

        const catUpserts = Array.from(categoryMap.values()).map((cat) => {
          const existing = existingCats?.find(ec => ec.name === cat.name);
          return {
            name: cat.name,
            sort_order: existing && existing.sort_order !== null && existing.sort_order !== undefined
              ? existing.sort_order
              : cat.sort_order,
          };
        });
        await supabase
          .from("smm_categories")
          .upsert(catUpserts, { onConflict: "name" });

        // Sync services in batches
        const batchSize = 100;
        for (let i = 0; i < rawServices.length; i += batchSize) {
          const chunk = rawServices.slice(i, i + batchSize);
          const svcUpserts = chunk.map((item) => {
            const obj: any = {
              service_id: parseInt(item.service),
              category_name: item.category || "Other",
              api_name: item.name,
              provider_rate: parseFloat(item.rate),
              min_order: parseInt(item.min),
              max_order: parseInt(item.max),
              type: item.type || "Default",
              refill: !!item.refill,
            };
            if (item.description !== undefined && item.description !== null) {
              obj.custom_description = item.description;
            }
            return obj;
          });
          await supabase
            .from("smm_services")
            .upsert(svcUpserts, { onConflict: "service_id" });
        }

        // Re-fetch after sync
        const { data: refreshedServices } = await supabase
          .from("smm_services")
          .select("*")
          .eq("is_active", true)
          .order("service_id", { ascending: true });
        dbServices = refreshedServices || [];
      }
    }

    // 4. Fetch Global Settings for Margin
    const { data: settingRow } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "profit_markup_percent")
      .single();
    const activeMargin = settingRow
      ? parseFloat(settingRow.value)
      : PROFIT_MARKUP_PERCENT;

    // 5. Map Results
    const categoriesMap = new Map();
    if (dbCategories) {
      for (const c of dbCategories) {
        if (c.name) {
          categoriesMap.set(c.name.toLowerCase().trim(), c);
        }
      }
    }

    const mapped = (dbServices || [])
      .map((row: any) => {
        const catKey = row.category_name ? row.category_name.toLowerCase().trim() : "";
        const cat = categoriesMap.get(catKey) || {};
        if (cat.is_active === false) return null;

        const appliedMargin =
          row.custom_margin !== null && row.custom_margin !== undefined
            ? parseFloat(row.custom_margin)
            : cat.custom_margin !== null && cat.custom_margin !== undefined
              ? parseFloat(cat.custom_margin)
              : activeMargin;

        // SMM API applies a 50% discount on direct API orders instantly.
        // Therefore, our actual cost is 50% of the raw provider rate.
        const actualCost = parseFloat(row.provider_rate) * 0.5;
        const ratePer1000 =
          Math.round(
            actualCost * (1 + appliedMargin / 100) * 100,
          ) / 100;

        const isPinned = (row.category_name && PINNED_CATEGORY && row.category_name.toLowerCase().trim() === PINNED_CATEGORY.toLowerCase().trim()) ||
          (cat.name && PINNED_CATEGORY && cat.name.toLowerCase().trim() === PINNED_CATEGORY.toLowerCase().trim());

        return {
          id: String(row.service_id),
          category: cat.custom_name || row.category_name,
          categorySortOrder: isPinned
            ? -1000000
            : cat.sort_order !== undefined && cat.sort_order !== null
              ? Number(cat.sort_order)
              : 99999,
          name: row.custom_name || row.api_name || `Service #${row.service_id}`,
          ratePer1000,
          min: row.min_order,
          max: row.max_order,
          description:
            row.custom_description ||
            `⚡ High-quality SMM delivery system for ${row.category_name}.`,
          is_starred: STARRED_SERVICES.includes(String(row.service_id)),
        };
      })
      .filter(Boolean);

    // 5. Update Cache and Return
    if (mapped.length > 0) {
      servicesCache = mapped;
      lastCacheUpdate = Date.now();
    }

    console.log(`[Services] Returning ${mapped.length} services to client.`);
    res.json({ success: true, services: mapped });
  } catch (err: any) {
    console.error("[Services] API Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Add/Forward SMM Order to Social Up Hub API automatically with real-time deduction
app.post("/api/smm/order", async (req, res) => {
  const { serviceId, targetUrl, quantity, charge } = req.body;

  if (!serviceId || !targetUrl || !quantity) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required order parameters." });
  }

  try {
    // 0. Prevent double same service on same link (active orders check)
    const { data: existingActiveOrders } = await supabase
      .from("orders")
      .select("id, status, service_id, target_url, link")
      .in("status", ["Pending", "In Progress", "Processing"]);

    if (existingActiveOrders) {
      const isDuplicate = existingActiveOrders.some((row: any) => {
        const matchesService = String(row.service_id) === String(serviceId);
        const matchesLink = (row.target_url && String(row.target_url).trim().toLowerCase() === String(targetUrl).trim().toLowerCase()) ||
                            (row.link && String(row.link).trim().toLowerCase() === String(targetUrl).trim().toLowerCase());
        return matchesService && matchesLink;
      });

      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          error: "DUPLICATE_ORDER_ERROR: An active order for this exact service and link is already being processed. Please wait for the current order to complete before placing another."
        });
      }
    }

    // 1. Verify Real-time Price Before Placing Order
    const dbServiceReq = await supabase
      .from("smm_services")
      .select("provider_rate")
      .eq("service_id", parseInt(serviceId))
      .single();
    if (!dbServiceReq.data) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid service ID requested." });
    }
    const currentDbPrice = parseFloat(dbServiceReq.data.provider_rate);

    // Call live API to get current price for this service
    const rawServices: any[] = await callSmmApi({
      key: SMM_API_KEY,
      action: "services",
    });
    const liveService = rawServices.find(
      (s) => String(s.service) === String(serviceId),
    );

    if (!liveService) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Service is no longer offered by the provider.",
        });
    }

    const livePrice = parseFloat(liveService.rate);

    // Compare prices
    if (livePrice !== currentDbPrice) {
      // Update database
      await supabase
        .from("smm_services")
        .update({ provider_rate: livePrice })
        .eq("service_id", parseInt(serviceId));

      if (livePrice > currentDbPrice) {
        // Provider increased price, bounce user so they can accept new pricing.
        return res.status(400).json({
          success: false,
          error:
            "PRICE_CHANGED_ERROR: The provider has updated the pricing for this service. We have synced our database. Please refresh the page to see the new price and try again.",
        });
      }
    }

    console.log(
      `Forwarding order automatically to SMM API... Service: ${serviceId}, Link: ${targetUrl}, Quantity: ${quantity}`,
    );

    // Call Social Up Hub API
    const response = await callSmmApi({
      key: SMM_API_KEY,
      action: "add",
      service: String(serviceId),
      link: String(targetUrl),
      quantity: String(quantity),
    });

    if (response && response.order) {
      console.log(
        "SMM API Order received successfully! Provider Order ID:",
        response.order,
      );
      return res.json({
        success: true,
        providerOrderId: response.order,
        message: "Order created and sent to support proxy.",
      });
    } else if (response && response.error) {
      console.error("SMM API Order failed:", response.error);
      return res.status(400).json({ success: false, error: response.error });
    } else {
      return res
        .status(500)
        .json({ success: false, error: "Unknown SMM provider response." });
    }
  } catch (err: any) {
    console.error("Failed to contact provider SMM API server:", err.message);
    res
      .status(500)
      .json({
        success: false,
        error: "Provider connection failure. Please confirm your API status.",
      });
  }
});

// 3. Status sync & dynamic refund trigger
app.post("/api/smm/status-sync", async (req, res) => {
  const { orders } = req.body; // Array of orders containing { id, providerOrderId, charge, status }

  if (!Array.isArray(orders) || orders.length === 0) {
    return res.json({ success: true, updatedOrders: [] });
  }

  const updatedOrders: any[] = [];

  try {
    // For performance and compliance, we sync active orders
    for (const order of orders) {
      // Only poll from provider if status is not finalized
      if (
        order.providerOrderId &&
        (order.status === "Pending" || order.status === "In Progress")
      ) {
        try {
          console.log(
            `Polling status from provider for Order ${order.id} (SMM: ${order.providerOrderId})`,
          );
          const statusResp = await callSmmApi({
            key: SMM_API_KEY,
            action: "status",
            order: String(order.providerOrderId),
          });

          if (statusResp && statusResp.status) {
            console.log(
              `Provider reported status for ${order.id}: ${statusResp.status}`,
            );

            let status = order.status;
            const provStatus = String(statusResp.status).toLowerCase();

            // SMM status standard mapping
            if (
              provStatus.includes("completed") ||
              provStatus.includes("success")
            ) {
              status = "Completed";
            } else if (
              provStatus.includes("canceled") ||
              provStatus.includes("cancelled") ||
              provStatus.includes("fail")
            ) {
              status = "Cancelled";
            } else if (
              provStatus.includes("progress") ||
              provStatus.includes("process") ||
              provStatus.includes("pending")
            ) {
              status = "In Progress";
            } else if (provStatus.includes("partial")) {
              status = "Cancelled"; // Mark as cancelled to trigger partial refund or complete refund
            }

            // Prepare refund status flag
            const isNewlyCancelled =
              status === "Cancelled" && order.status !== "Cancelled";

            updatedOrders.push({
              id: order.id,
              status,
              startCount: statusResp.start_count || 0,
              remains: statusResp.remains || 0,
              refundIssued: isNewlyCancelled, // Signal to client that a refund should be processed
              refundAmount: isNewlyCancelled ? order.charge : 0,
            });
          }
        } catch (err) {
          console.warn(`Could not sync status for order ${order.id}`, err);
        }
      }
    }

    res.json({ success: true, updatedOrders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// === GLOBAL SETTINGS ENDPOINTS ===
app.get("/api/smm/settings", async (req, res) => {
  await loadServerSettings();
  res.json({
    success: true,
    settings: {
      profit_markup_percent: PROFIT_MARKUP_PERCENT,
      landing_video_url: LANDING_VIDEO_URL,
      smm_api_key: SMM_API_KEY,
      smm_api_url: SMM_API_URL,
      pinned_category: PINNED_CATEGORY,
    },
  });
});

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_live_RzLdEkePrpnfd4";
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET || "4wiJs8mHjvhbes6JRZFd35hT";

const rzp = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_SECRET,
});

// Endpoint: Create order for Razorpay payment
app.post("/api/smm/payments/create-order", async (req, res) => {
  const { amount, email, couponCode } = req.body;
  if (!amount || amount < 1) {
    return res.status(400).json({ error: "Invalid amount. Minimum is ₹1." });
  }
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const options = {
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "rcpt_" + Math.random().toString(36).substring(2, 15),
    };

    const order = await rzp.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ error: error.message || "Failed to create Razorpay order" });
  }
});

// Endpoint: Verify payment and update wallet balance safely
app.post("/api/smm/payments/verify", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, email, amount, couponCode } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !email || !amount) {
    return res.status(400).json({ error: "Missing verification parameters" });
  }

  try {
    const generated_signature = crypto
      .createHmac("sha256", RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Signature verification failed" });
    }

    const { data: existingTx } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", razorpay_payment_id)
      .maybeSingle();

    if (existingTx) {
      return res.status(400).json({ error: "Transaction has already been processed" });
    }

    let bonusFactor = 1.0;
    let methodSuffix = "";
    if (couponCode) {
      const cleanCode = String(couponCode).trim().toUpperCase();
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", cleanCode)
        .eq("is_active", true)
        .maybeSingle();

      if (coupon) {
        bonusFactor = 1.0 + (coupon.discount_percent / 100);
        methodSuffix = ` [Coupon: ${cleanCode} (+${coupon.discount_percent}% Bonus)]`;
      }
    }

    const finalAmountCredited = Math.round(amount * bonusFactor * 100) / 100;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("balance")
      .eq("email", email)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const currentBalance = parseFloat(profile.balance || "0");
    const newBalance = currentBalance + finalAmountCredited;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("email", email);

    if (updateErr) {
      return res.status(500).json({ error: "Failed to update balance in wallet" });
    }

    const { error: txErr } = await supabase
      .from("transactions")
      .insert({
        id: razorpay_payment_id,
        user_email: email,
        amount: amount,
        method: `Razorpay INR Gateway${methodSuffix}`,
        status: "Success",
        created_at: new Date().toISOString(),
      });

    if (txErr) {
      console.error("Failed to log transaction:", txErr);
    }

    res.json({
      success: true,
      message: `Successfully credited ₹${finalAmountCredited} to your wallet!`,
      newBalance: newBalance,
    });
  } catch (error: any) {
    console.error("Razorpay verification error:", error);
    res.status(500).json({ error: error.message || "Failed to verify signature" });
  }
});

app.post("/api/smm/settings/update", async (req, res) => {
  const { profit_markup_percent, landing_video_url, smm_api_key, smm_api_url, pinned_category } = req.body;
  if (profit_markup_percent !== undefined) {
    PROFIT_MARKUP_PERCENT = parseFloat(profit_markup_percent);
    try {
      await supabase
        .from("global_settings")
        .upsert({
          key: "profit_markup_percent",
          value: String(profit_markup_percent),
        }, { onConflict: "key" });
    } catch (e) {
      console.warn("Supabase global_settings sync failed:", e);
    }
  }
  if (landing_video_url !== undefined) {
    LANDING_VIDEO_URL = String(landing_video_url);
    try {
      await supabase
        .from("global_settings")
        .upsert({ key: "landing_video_url", value: String(landing_video_url) }, { onConflict: "key" });
    } catch (e) {
      console.warn("Supabase global_settings sync failed:", e);
    }
  }
  if (pinned_category !== undefined) {
    PINNED_CATEGORY = String(pinned_category).trim();
    try {
      await supabase
        .from("global_settings")
        .upsert({ key: "pinned_category", value: PINNED_CATEGORY }, { onConflict: "key" });
    } catch (e) {
      console.warn("Supabase global_settings sync failed:", e);
    }
  }
  if (smm_api_key !== undefined) {
    SMM_API_KEY = String(smm_api_key);
    try {
      await supabase
        .from("global_settings")
        .upsert({ key: "smm_api_key", value: String(smm_api_key) }, { onConflict: "key" });
    } catch (e) {
      console.warn("Supabase global_settings sync failed:", e);
    }
  }
  if (smm_api_url !== undefined) {
    let urlToSave = String(smm_api_url);
    if (urlToSave.includes("socialuphub.in")) {
      urlToSave = "https://socialuphub-backend.onrender.com/api/v2";
    }
    SMM_API_URL = urlToSave;
    try {
      await supabase
        .from("global_settings")
        .upsert({ key: "smm_api_url", value: urlToSave }, { onConflict: "key" });
    } catch (e) {
      console.warn("Supabase global_settings sync failed:", e);
    }
  }
  servicesCache = null; // Invalidate cache so new margin is applied
  res.json({
    success: true,
    settings: {
      profit_markup_percent: PROFIT_MARKUP_PERCENT,
      landing_video_url: LANDING_VIDEO_URL,
      smm_api_key: SMM_API_KEY,
      smm_api_url: SMM_API_URL,
      pinned_category: PINNED_CATEGORY,
    },
  });
});

app.post("/api/smm/admin/categories/pin", async (req, res) => {
  const { name } = req.body;
  try {
    PINNED_CATEGORY = name ? String(name).trim() : "";
    await supabase
      .from("global_settings")
      .upsert({ key: "pinned_category", value: PINNED_CATEGORY }, { onConflict: "key" });

    servicesCache = null; // Invalidate caches
    adminCategoriesCache = null;
    res.json({ success: true, pinned_category: PINNED_CATEGORY });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// === COUPONS ENGINE ===
let couponsMemory: any[] = [
  {
    code: "WELCOME10",
    discount_percent: 10,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 100,
    used_count: 0,
  },
  {
    code: "BONUS20",
    discount_percent: 20,
    expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 50,
    used_count: 5,
  },
  {
    code: "MEGA50",
    discount_percent: 50,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 20,
    used_count: 2,
  },
];

async function getCoupons() {
  try {
    const { data, error } = await supabase.from("coupons").select("*");
    if (data && !error) {
      return data.map((row: any) => ({
        code: row.code,
        discount_percent: parseFloat(row.discount_percent),
        expires_at: row.expires_at,
        max_uses: parseInt(row.max_uses, 10),
        used_count: parseInt(row.used_count, 10),
      }));
    }
  } catch (err) {
    console.warn(
      "Failed getting coupons from Supabase, returning memory list:",
      err,
    );
  }
  return couponsMemory;
}

app.get("/api/smm/coupons", async (req, res) => {
  const list = await getCoupons();
  res.json({ success: true, coupons: list });
});

app.post("/api/smm/coupons/create", async (req, res) => {
  const { code, discount_percent, expires_at, max_uses } = req.body;
  if (!code || discount_percent === undefined || !expires_at) {
    return res
      .status(400)
      .json({
        success: false,
        error: "Missing code, discount_percent, or expires_at.",
      });
  }

  const newCoupon = {
    code: String(code).toUpperCase().trim(),
    discount_percent: parseFloat(discount_percent),
    expires_at: String(expires_at),
    max_uses: parseInt(max_uses || "100", 10),
    used_count: 0,
  };

  const idx = couponsMemory.findIndex((c) => c.code === newCoupon.code);
  if (idx !== -1) {
    couponsMemory[idx] = newCoupon;
  } else {
    couponsMemory.push(newCoupon);
  }

  try {
    await supabase.from("coupons").upsert({
      code: newCoupon.code,
      discount_percent: newCoupon.discount_percent,
      expires_at: newCoupon.expires_at,
      max_uses: newCoupon.max_uses,
      used_count: newCoupon.used_count,
    });
  } catch (err) {
    console.warn("Coupons db write failed:", err);
  }

  res.json({ success: true, coupon: newCoupon });
});

app.post("/api/smm/coupons/apply", async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res
      .status(400)
      .json({ success: false, error: "Coupon code cannot be empty." });
  }

  const upperCode = String(code).toUpperCase().trim();
  const list = await getCoupons();
  const coupon = list.find((c: any) => c.code === upperCode);

  if (!coupon) {
    return res
      .status(404)
      .json({ success: false, error: "This coupon code does not exist." });
  }

  if (new Date(coupon.expires_at).getTime() < Date.now()) {
    return res
      .status(400)
      .json({ success: false, error: "This coupon code has expired." });
  }

  if (coupon.used_count >= coupon.max_uses) {
    return res
      .status(400)
      .json({ success: false, error: "This coupon is fully claimed." });
  }

  const memIdx = couponsMemory.findIndex((c) => c.code === upperCode);
  if (memIdx !== -1) {
    couponsMemory[memIdx].used_count += 1;
  }

  try {
    await supabase
      .from("coupons")
      .update({ used_count: coupon.used_count + 1 })
      .eq("code", upperCode);
  } catch (err) {
    console.warn("Coupon counter update error:", err);
  }

  res.json({
    success: true,
    discount_percent: coupon.discount_percent,
    message: `Coupon "${upperCode}" applied! Extra ${coupon.discount_percent}% bonus cash will be added.`,
  });
});

app.post("/api/smm/coupons/delete", async (req, res) => {
  const { code } = req.body;
  const upperCode = String(code).toUpperCase().trim();
  couponsMemory = couponsMemory.filter((c) => c.code !== upperCode);
  try {
    await supabase.from("coupons").delete().eq("code", upperCode);
  } catch (err) {
    console.warn("Coupon db delete fail:", err);
  }
  res.json({ success: true });
});

// === USER SIGNUP & SIGNIN AUTH SYSTEM ===

// User Signup
app.post("/api/auth/signup", async (req, res) => {
  const { email, phone, password, name } = req.body;
  if (!email || !phone || !password) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
  // Basic validation
  if (!email.includes("@")) {
    return res.status(400).json({ success: false, error: "Invalid email format" });
  }
  if (phone.length < 10) {
    return res.status(400).json({ success: false, error: "Invalid phone number length" });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.trim();

    // Check if email already exists
    const { data: existingEmail, error: emailCheckError } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      return res.status(400).json({ success: false, error: "Email already registered" });
    }

    // Check if phone already exists
    const { data: existingPhone } = await supabase
      .from("profiles")
      .select("phone")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (existingPhone) {
      return res.status(400).json({ success: false, error: "Phone number already registered" });
    }

    // Generate hashed password
    const password_hash = hashPassword(password);
    const pic = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail.split("@")[0])}&backgroundColor=000000&color=ffffff`;
    const initialBalance = 0; // INR 0 default balance
    const apiKey = "smm_KEY" + crypto.randomBytes(6).toString("hex").toUpperCase();
    const is_admin = cleanEmail === "gauravbeniwal30003@gmail.com";

    const { error: insertError } = await supabase
      .from("profiles")
      .insert({
        email: cleanEmail,
        phone: cleanPhone,
        password_hash,
        name: name || cleanEmail.split("@")[0],
        picture: pic,
        balance: initialBalance,
        api_key: apiKey,
        is_admin,
      });

    if (insertError) {
      throw insertError;
    }

    res.json({
      success: true,
      user: {
        email: cleanEmail,
        phone: cleanPhone,
        name: name || cleanEmail.split("@")[0],
        picture: pic,
        balance: initialBalance,
        apiKey,
        isAdmin: is_admin,
      }
    });
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to create account" });
  }
});

// User Signin
app.post("/api/auth/signin", async (req, res) => {
  const { loginIdentifier, password } = req.body; // loginIdentifier can be email or phone
  if (!loginIdentifier || !password) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const hash = hashPassword(password);
    const identifier = loginIdentifier.trim();

    let query = supabase.from("profiles").select("*");
    if (identifier.includes("@")) {
      query = query.eq("email", identifier.toLowerCase());
    } else {
      query = query.eq("phone", identifier);
    }

    const { data: user, error } = await query.maybeSingle();

    if (error || !user) {
      return res.status(401).json({ success: false, error: "Invalid email/phone or password" });
    }

    if (user.password_hash !== hash) {
      return res.status(401).json({ success: false, error: "Invalid email/phone or password" });
    }

    const automatedAdmin = user.email.toLowerCase() === "gauravbeniwal30003@gmail.com";

    res.json({
      success: true,
      user: {
        email: user.email,
        phone: user.phone,
        name: user.name,
        picture: user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=000000&color=ffffff`,
        balance: parseFloat(user.balance),
        apiKey: user.api_key,
        isAdmin: user.is_admin || automatedAdmin,
      }
    });
  } catch (err: any) {
    console.error("Signin error:", err);
    res.status(500).json({ success: false, error: err.message || "Authentication failed" });
  }
});

// Google Authentication
app.post("/api/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ success: false, error: "Missing Google credential token" });
  }

  try {
    // 1. Verify token with Google's tokeninfo API
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const verifyRes = await fetch(googleVerifyUrl);
    if (!verifyRes.ok) {
      return res.status(400).json({ success: false, error: "Invalid Google credential token" });
    }

    const payload = await verifyRes.json();
    
    // Validate audience (aud) matches our Client ID
    const expectedClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "188819967487-2tk0hgu4p5m3eo2npummaqq0523cehh0.apps.googleusercontent.com";
    if (payload.aud !== expectedClientId) {
      console.error("Google Auth Audience mismatch:", payload.aud, "expected:", expectedClientId);
      return res.status(400).json({ success: false, error: "Authentication client ID mismatch. Please check your credentials." });
    }

    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    if (!email) {
      return res.status(400).json({ success: false, error: "Google account does not provide an email address" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 2. Check if a profile already exists with this email
    let { data: user, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (fetchError) {
      console.error("Supabase user check error:", fetchError);
      return res.status(500).json({ success: false, error: "Database error during lookup" });
    }

    const is_admin = cleanEmail === "gauravbeniwal30003@gmail.com";

    if (user) {
      // User already exists! Open the same account (prevent duplicates)
      const updateData: any = {};
      let needsUpdate = false;
      if (!user.picture && picture) {
        updateData.picture = picture;
        needsUpdate = true;
      }
      if (!user.name && name) {
        updateData.name = name;
        needsUpdate = true;
      }
      if (is_admin && !user.is_admin) {
        updateData.is_admin = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        const { data: updatedUser } = await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", user.id)
          .select()
          .maybeSingle();
        if (updatedUser) {
          user = updatedUser;
        }
      }

      return res.json({
        success: true,
        user: {
          email: user.email,
          phone: user.phone,
          name: user.name,
          picture: user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || "")}&backgroundColor=000000&color=ffffff`,
          balance: parseFloat(user.balance),
          apiKey: user.api_key,
          isAdmin: user.is_admin || is_admin,
        }
      });
    }

    // 3. User does NOT exist, create a new profile linked with Google
    const initialBalance = 0;
    const apiKey = "smm_KEY" + crypto.randomBytes(6).toString("hex").toUpperCase();
    const pic = picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || cleanEmail.split("@")[0])}&backgroundColor=000000&color=ffffff`;

    const { data: newUser, error: insertError } = await supabase
      .from("profiles")
      .insert({
        email: cleanEmail,
        phone: null, // Left as null to avoid uniqueness conflicts
        password_hash: null, // Password is null for pure OAuth accounts
        name: name || cleanEmail.split("@")[0],
        picture: pic,
        balance: initialBalance,
        api_key: apiKey,
        is_admin,
      })
      .select()
      .maybeSingle();

    if (insertError || !newUser) {
      console.error("Google user insertion error:", insertError);
      return res.status(500).json({ success: false, error: insertError?.message || "Failed to create Google-linked profile" });
    }

    res.json({
      success: true,
      user: {
        email: newUser.email,
        phone: newUser.phone,
        name: newUser.name,
        picture: newUser.picture,
        balance: parseFloat(newUser.balance),
        apiKey: newUser.api_key,
        isAdmin: newUser.is_admin,
      }
    });

  } catch (err: any) {
    console.error("Google auth handler error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to authenticate with Google" });
  }
});

// === ADMIN USERS & DATA CONTROL ===

// Admin Login
app.post("/api/smm/admin/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ success: false, error: "Missing credentials" });
  }

  try {
    const { data: adminUser, error } = await supabase
      .from("admin_users")
      .select("*")
      .eq("username", username)
      .eq("password", password)
      .single();

    if (error || !adminUser) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid admin credentials" });
    }

    // Success
    res.json({ success: true, token: "admin-super-secret-token-xyz" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/dashboard", async (req, res) => {
  try {
    const balanceRes = await callSmmApi({
      key: SMM_API_KEY,
      action: "balance",
    }).catch(() => ({ balance: 0, currency: "INR" }));

    const { data: dbOrders } = await supabase
      .from("orders")
      .select("id, charge");
    const { data: dbUsers } = await supabase.from("profiles").select("id");
    const { data: dbTransactions } = await supabase
      .from("transactions")
      .select("id");

    const orders = dbOrders || [];

    res.json({
      success: true,
      stats: {
        totalUsers: (dbUsers || []).length,
        totalOrders: orders.length,
        totalRevenue: orders.reduce(
          (sum, o) => sum + parseFloat(o.charge || "0"),
          0,
        ),
        totalTransactions: (dbTransactions || []).length,
        providerBalance: balanceRes?.balance || 0,
        referralPayouts: 0,
        pendingRecharges: 0,
        recentActivity: orders.slice(0, 5),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/users", async (req, res) => {
  try {
    const { data: users } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    res.json({ success: true, users: users || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/users/update-balance", async (req, res) => {
  const { email, balance } = req.body;
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ balance })
      .eq("email", email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/users/toggle-admin", async (req, res) => {
  const { email, is_admin } = req.body;
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin })
      .eq("email", email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/users/toggle-ban", async (req, res) => {
  const { email, is_banned } = req.body;
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ status: is_banned ? "banned" : "active" })
      .eq("email", email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/transactions", async (req, res) => {
  try {
    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });
    res.json({
      success: true,
      transactions: transactions || [],
      pendingRecharges: [],
      recharges: [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/transactions/approve-recharge", async (req, res) => {
  const { txId } = req.body;
  res.json({ success: true }); // Simplification for demo
});

app.post("/api/smm/admin/transactions/reject-recharge", async (req, res) => {
  const { txId } = req.body;
  res.json({ success: true }); // Simplification for demo
});

// Categories and Services overrides
app.get("/api/smm/admin/categories", async (req, res) => {
  try {
    if (!adminCategoriesCache) {
      const { data: categories } = await supabase
        .from("smm_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      adminCategoriesCache = categories || [];
    }
    res.json({ success: true, categories: adminCategoriesCache, pinned_category: PINNED_CATEGORY });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/categories/update", async (req, res) => {
  const { name, is_active, custom_margin, custom_name, sort_order } = req.body;
  try {
    const updateObj: any = {};
    if (is_active !== undefined) updateObj.is_active = is_active;
    if (custom_margin !== undefined) updateObj.custom_margin = custom_margin;
    if (custom_name !== undefined) updateObj.custom_name = custom_name;
    if (sort_order !== undefined) updateObj.sort_order = sort_order;

    const { error } = await supabase
      .from("smm_categories")
      .update(updateObj)
      .eq("name", name);

    if (error) throw error;
    servicesCache = null; // Invalidate cache
    adminCategoriesCache = null; // Invalidate admin categories cache
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/services", async (req, res) => {
  try {
    if (!adminServicesCache) {
      const { data: services } = await supabase
        .from("smm_services")
        .select("*")
        .order("service_id", { ascending: true });
      adminServicesCache = services || [];
    }
    const mapped = adminServicesCache.map((row: any) => ({
      ...row,
      is_starred: STARRED_SERVICES.includes(String(row.service_id)),
    }));
    res.json({ success: true, services: mapped, starred_services: STARRED_SERVICES });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/services/star", async (req, res) => {
  const { service_id, is_starred } = req.body;
  try {
    const sId = String(service_id).trim();
    if (is_starred) {
      if (!STARRED_SERVICES.includes(sId)) {
        STARRED_SERVICES.push(sId);
      }
    } else {
      STARRED_SERVICES = STARRED_SERVICES.filter(id => id !== sId);
    }

    await supabase
      .from("global_settings")
      .upsert({ key: "starred_services", value: JSON.stringify(STARRED_SERVICES) }, { onConflict: "key" });

    servicesCache = null; // Invalidate cache so changes reflect instantly
    adminServicesCache = null;

    res.json({ success: true, starred_services: STARRED_SERVICES });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/services/update", async (req, res) => {
  const {
    service_id,
    is_active,
    custom_margin,
    custom_name,
    custom_description,
    category_name,
    provider_rate,
    min_order,
    max_order,
    refill,
    api_name,
  } = req.body;
  try {
    const updateObj: any = {};
    if (is_active !== undefined) updateObj.is_active = is_active;
    if (custom_margin !== undefined) {
      updateObj.custom_margin = custom_margin === null ? null : parseFloat(custom_margin);
    }
    if (custom_name !== undefined) updateObj.custom_name = custom_name;
    if (custom_description !== undefined) updateObj.custom_description = custom_description;
    if (category_name !== undefined) updateObj.category_name = category_name;
    if (provider_rate !== undefined) {
      updateObj.provider_rate = provider_rate === null ? null : parseFloat(provider_rate);
    }
    if (min_order !== undefined) {
      updateObj.min_order = min_order === null ? null : parseInt(min_order);
    }
    if (max_order !== undefined) {
      updateObj.max_order = max_order === null ? null : parseInt(max_order);
    }
    if (refill !== undefined) updateObj.refill = !!refill;
    if (api_name !== undefined) updateObj.api_name = api_name;

    const { error } = await supabase
      .from("smm_services")
      .update(updateObj)
      .eq("service_id", parseInt(service_id));

    if (error) throw error;
    servicesCache = null; // Invalidate cache
    adminServicesCache = null; // Invalidate admin services cache
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Create Category Endpoint
app.post("/api/smm/admin/categories/create", async (req, res) => {
  const { name, custom_name, custom_margin, sort_order, is_active } = req.body;
  try {
    if (!name || !name.trim()) {
      return res.json({ success: false, error: "Category original name is required" });
    }
    const insertObj = {
      name: name.trim(),
      custom_name: custom_name || null,
      custom_margin: custom_margin !== undefined && custom_margin !== null ? parseFloat(custom_margin) : null,
      sort_order: sort_order !== undefined && sort_order !== null ? parseInt(sort_order) : 0,
      is_active: is_active !== undefined ? !!is_active : true
    };
    const { error } = await supabase.from("smm_categories").insert(insertObj);
    if (error) throw error;
    servicesCache = null;
    adminCategoriesCache = null;
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Delete Category Endpoint
app.post("/api/smm/admin/categories/delete", async (req, res) => {
  const { name } = req.body;
  try {
    const { error } = await supabase.from("smm_categories").delete().eq("name", name);
    if (error) throw error;
    servicesCache = null;
    adminCategoriesCache = null;
    adminServicesCache = null;
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Create Service Endpoint
app.post("/api/smm/admin/services/create", async (req, res) => {
  const {
    service_id,
    category_name,
    api_name,
    custom_name,
    custom_description,
    provider_rate,
    custom_margin,
    min_order,
    max_order,
    type,
    refill,
    is_active
  } = req.body;
  try {
    if (!service_id || isNaN(parseInt(service_id))) {
      return res.json({ success: false, error: "Valid unique Service ID is required" });
    }
    if (!category_name) {
      return res.json({ success: false, error: "Category selection is required" });
    }
    if (!api_name || !api_name.trim()) {
      return res.json({ success: false, error: "API Name/Original name is required" });
    }
    const insertObj = {
      service_id: parseInt(service_id),
      category_name,
      api_name: api_name.trim(),
      custom_name: custom_name || null,
      custom_description: custom_description || null,
      provider_rate: provider_rate ? parseFloat(provider_rate) : 0,
      custom_margin: custom_margin !== undefined && custom_margin !== null ? parseFloat(custom_margin) : null,
      min_order: min_order ? parseInt(min_order) : 10,
      max_order: max_order ? parseInt(max_order) : 10000,
      type: type || "Default",
      refill: !!refill,
      is_active: is_active !== undefined ? !!is_active : true
    };
    const { error } = await supabase.from("smm_services").insert(insertObj);
    if (error) throw error;
    servicesCache = null;
    adminServicesCache = null;
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Delete Service Endpoint
app.post("/api/smm/admin/services/delete", async (req, res) => {
  const { service_id } = req.body;
  try {
    const { error } = await supabase.from("smm_services").delete().eq("service_id", parseInt(service_id));
    if (error) throw error;
    servicesCache = null;
    adminServicesCache = null;
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/orders", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    res.json({ success: true, orders: data || [] });
  } catch (err: any) {
    res.json({ success: true, orders: [] });
  }
});

app.post("/api/smm/admin/orders/update", async (req, res) => {
  const { id, status, provider_order_id, target_url, quantity, charge } = req.body;
  try {
    const updateObj: any = {};
    if (status !== undefined) updateObj.status = status;
    if (provider_order_id !== undefined) updateObj.provider_order_id = provider_order_id;
    if (target_url !== undefined) updateObj.target_url = target_url;
    if (quantity !== undefined) updateObj.quantity = parseInt(quantity);
    if (charge !== undefined) updateObj.charge = parseFloat(charge);

    // Fetch order to see if it was newly cancelled
    const { data: currentOrder, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !currentOrder) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const { error } = await supabase
      .from("orders")
      .update(updateObj)
      .eq("id", id);

    if (error) throw error;

    // Handle refund if status changed to Cancelled manually
    if (status === "Cancelled" && currentOrder.status !== "Cancelled") {
      const refundValue = parseFloat(currentOrder.charge);
      if (refundValue > 0 && currentOrder.user_email) {
        console.log(`[Admin Order Edit] Order ${id} cancelled manually. Refunding ₹${refundValue} to ${currentOrder.user_email}`);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("email", currentOrder.user_email)
          .single();

        const currentBal = profile ? parseFloat(profile.balance || "0") : 0;
        const nextBal = currentBal + refundValue;

        await supabase
          .from("profiles")
          .update({ balance: nextBal })
          .eq("email", currentOrder.user_email);

        const refundTxId = "TXN-REF" + Math.floor(100000 + Math.random() * 900000);
        await supabase
          .from("transactions")
          .insert({
            id: refundTxId,
            user_email: currentOrder.user_email,
            amount: refundValue,
            method: "Cancellation Refund",
            status: "Success",
            created_at: new Date().toISOString()
          });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/smm/admin/orders/delete", async (req, res) => {
  const { id } = req.body;
  try {
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/provider-balance", async (req, res) => {
  try {
    if (!SMM_API_KEY) {
      return res.json({ success: true, balance: "24500.00", currency: "INR", note: "Demo Balance (No SMM API Key Configured)" });
    }
    const data = await callSmmApi({ key: SMM_API_KEY, action: "balance" });
    if (data && data.balance !== undefined) {
      res.json({ success: true, balance: data.balance, currency: data.currency || "INR" });
    } else {
      res.json({ success: true, balance: "24500.00", currency: "INR", note: "Demo Balance" });
    }
  } catch (err: any) {
    console.warn("Could not load real provider balance, falling back to demo balance:", err.message);
    res.json({ success: true, balance: "24500.00", currency: "INR", note: "Demo Balance (API Offline)", error: err.message });
  }
});

// Vite server development configuration
async function initializeServer() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware loaded.");
    } catch (err: any) {
      console.warn("Failed to load Vite dev middleware, falling back to static server:", err.message);
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static handler loaded.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  initializeServer();
}

export default app;
