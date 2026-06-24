import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// Base SMM Configuration
const SMM_API_KEY = process.env.SMM_API_KEY;
const SMM_API_URL = process.env.SMM_API_URL;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SMM_API_KEY || !SMM_API_URL || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing required environment variables.");
}

const supabase = createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string);

let PROFIT_MARKUP_PERCENT = 15;
let LANDING_VIDEO_URL = ""; // Removed rickroll demo video

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
        }
      }
      console.log("Successfully loaded config settings from Supabase:", {
        PROFIT_MARKUP_PERCENT,
        LANDING_VIDEO_URL,
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
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper: safe fetch with form-urlencoded
async function callSmmApi(payload: Record<string, string>) {
  try {
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

    if (!response.ok) {
      throw new Error(
        `SMM Server error (Status ${response.status}): ${response.statusText}`,
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      if (text.trim().startsWith("<")) {
        throw new Error(
          "SMM API returned HTML content (possibly Cloudflare protection) instead of expected JSON.",
        );
      }
      throw new Error(
        `Failed to parse SMM response as JSON: ${text.slice(0, 100)}`,
      );
    }

    if (data && data.error) {
      throw new Error(`SMM API Error: ${data.error}`);
    }
    return data;
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
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Start background task every 10 minutes
setInterval(backgroundSyncPrices, 10 * 60 * 1000);

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
    const categoryData = Array.from(categoryMap.values()).map((cat) => ({
      name: cat.name,
      sort_order: cat.sort_order,
    }));
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
    console.log(
      `[Background] Sync completed successfully. Processed ${rawServices.length} services.`,
    );
  } catch (err: any) {
    console.error("[Background] Sync failed with exception:", err.message);
  }
}

// Start background task every 10 minutes
setInterval(backgroundSyncPrices, 10 * 60 * 1000);

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
    const catData = Array.from(categoryMap.values()).map((cat) => ({
      name: cat.name,
      sort_order: cat.sort_order,
    }));
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
    const balanceRes = await callSmmApi({
      key: SMM_API_KEY,
      action: "balance",
    }).catch(() => ({ balance: 0 }));

    console.log(`[Admin] Sync finished. Items: ${rawServices.length}`);
    res.json({
      success: true,
      count: rawServices.length,
      balance: balanceRes.balance,
    });
  } catch (err: any) {
    console.error("[Admin] Sync error:", err.message);
    res.status(500).json({ success: false, error: err.message });
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
        const catUpserts = Array.from(categoryMap.values()).map((cat) => ({
          name: cat.name,
          sort_order: cat.sort_order,
        }));
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
    if (dbCategories)
      for (const c of dbCategories) categoriesMap.set(c.name, c);

    const mapped = (dbServices || [])
      .map((row: any) => {
        const cat = categoriesMap.get(row.category_name) || {};
        if (cat.is_active === false) return null;

        const appliedMargin =
          row.custom_margin !== null && row.custom_margin !== undefined
            ? parseFloat(row.custom_margin)
            : cat.custom_margin !== null && cat.custom_margin !== undefined
              ? parseFloat(cat.custom_margin)
              : activeMargin;

        const ratePer1000 =
          Math.round(
            parseFloat(row.provider_rate) * (1 + appliedMargin / 100) * 100,
          ) / 100;

        return {
          id: String(row.service_id),
          category: cat.custom_name || row.category_name,
          categorySortOrder:
            cat.sort_order !== undefined && cat.sort_order !== null
              ? cat.sort_order
              : 99999,
          name: row.custom_name || row.api_name || `Service #${row.service_id}`,
          ratePer1000,
          min: row.min_order,
          max: row.max_order,
          description:
            row.custom_description ||
            `⚡ High-quality SMM delivery system for ${row.category_name}.`,
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
    },
  });
});

app.post("/api/smm/settings/update", async (req, res) => {
  const { profit_markup_percent, landing_video_url } = req.body;
  if (profit_markup_percent !== undefined) {
    PROFIT_MARKUP_PERCENT = parseFloat(profit_markup_percent);
    try {
      await supabase
        .from("global_settings")
        .upsert({
          key: "profit_markup_percent",
          value: String(profit_markup_percent),
        });
    } catch (e) {
      console.warn("Supabase global_settings sync failed:", e);
    }
  }
  if (landing_video_url !== undefined) {
    LANDING_VIDEO_URL = String(landing_video_url);
    try {
      await supabase
        .from("global_settings")
        .upsert({ key: "landing_video_url", value: String(landing_video_url) });
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
    },
  });
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
    const { data: categories } = await supabase
      .from("smm_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    res.json({ success: true, categories: categories || [] });
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
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.get("/api/smm/admin/services", async (req, res) => {
  try {
    const { data: services } = await supabase
      .from("smm_services")
      .select("*")
      .order("service_id", { ascending: true });
    res.json({ success: true, services: services || [] });
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
  } = req.body;
  try {
    const updateObj: any = {};
    if (is_active !== undefined) updateObj.is_active = is_active;
    if (custom_margin !== undefined) updateObj.custom_margin = custom_margin;
    if (custom_name !== undefined) updateObj.custom_name = custom_name;
    if (custom_description !== undefined) updateObj.custom_description = custom_description;

    const { error } = await supabase
      .from("smm_services")
      .update(updateObj)
      .eq("service_id", parseInt(service_id));

    if (error) throw error;
    servicesCache = null; // Invalidate cache
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

app.get("/api/smm/admin/provider-balance", async (req, res) => {
  try {
    const data = await callSmmApi({ key: SMM_API_KEY, action: "balance" });
    res.json({ success: true, balance: data.balance, currency: data.currency });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Vite server development configuration
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware loaded.");
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

initializeServer();
