import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

// Base SMM Configuration
const SMM_API_KEY = process.env.SMM_API_KEY || '4f875a1ab9fc4c8ca31cb98a6e82e98c';
const SMM_API_URL = 'https://socialuphub-backend.onrender.com/api/v2';

const SUPABASE_URL = 'https://mfrnehshclymmydtykpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcm5laHNoY2x5bW15ZHR5a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQyNjUsImV4cCI6MjA5NzcxMDI2NX0.dhdfx9xURndzS6MSSsZmH5HI0O59VAY8Vfl7UZt4yxM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let PROFIT_MARKUP_PERCENT = 15;
let LANDING_VIDEO_URL = ''; // Removed rickroll demo video

// Advanced Admin Overrides - DEPRECATED (Now DB Driven)

// Load Config from Supabase on start
async function loadServerSettings() {
  try {
    const { data: dbSettings, error } = await supabase.from('global_settings').select('*');
    if (dbSettings && !error) {
      for (const row of dbSettings) {
        if (row.key === 'profit_markup_percent') {
          PROFIT_MARKUP_PERCENT = parseFloat(row.value) || 15;
        } else if (row.key === 'landing_video_url') {
          LANDING_VIDEO_URL = row.value;
        }
      }
      console.log('Successfully loaded config settings from Supabase:', { PROFIT_MARKUP_PERCENT, LANDING_VIDEO_URL });
    }
  } catch (err) {
    console.warn('Could not load global settings from Supabase, relying on in-memory cache.');
  }
}
loadServerSettings();

const app = express();
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: bodyParams.toString()
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`SMM Server error (Status ${response.status}): ${response.statusText}`);
    }

    try {
      return JSON.parse(text);
    } catch (parseErr) {
      if (text.trim().startsWith('<')) {
        throw new Error('SMM API returned HTML content (possibly Cloudflare protection, rate limit, or maintenance mode) instead of expected JSON.');
      }
      throw new Error(`Failed to parse SMM response as JSON: ${text.slice(0, 100)}`);
    }
  } catch (err: any) {
    console.warn('SMM API call failed and was handled gracefully:', err.message);
    throw err;
  }
}

// === CATALOG & SERVICES ===

// 5. Cache for services to improve performance
let servicesCache: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Start background task every 15 minutes
setInterval(backgroundSyncPrices, 15 * 60 * 1000);

// Background sync task for prices to keep them realtime
async function backgroundSyncPrices() {
  try {
    console.log('[Background] Syncing prices from API...');
    const rawServices: any[] = await callSmmApi({ key: SMM_API_KEY, action: 'services' });
    if (!Array.isArray(rawServices)) return;

    // Use a batch update strategy if possible, but for now simple loop is fine
    for (const item of rawServices) {
      await supabase.from('smm_services').update({
        provider_rate: parseFloat(item.rate)
      }).eq('service_id', parseInt(item.service));
    }
    // Invalidate cache
    servicesCache = null;
    console.log('[Background] Price sync completed.');
  } catch (err) {
    console.error('[Background] Price sync failed:', err);
  }
}

app.post('/api/smm/admin/services/sync', async (req, res) => {
  try {
    const { force_reset } = req.body || {};
    const rawServices: any[] = await callSmmApi({ key: SMM_API_KEY, action: 'services' });
    if (!Array.isArray(rawServices)) throw new Error('Invalid format from API');

    if (force_reset) {
      console.log('Force resetting categories and services...');
      await supabase.from('smm_services').delete().neq('service_id', 0);
      await supabase.from('smm_categories').delete().neq('name', '');
    }

    console.log('Syncing categories to DB...');
    const uniqueCategories = [...new Set(rawServices.map(s => s.category || 'Other'))];
    for (let i = 0; i < uniqueCategories.length; i++) {
      const c = uniqueCategories[i];
      await supabase.from('smm_categories').upsert({ name: c, sort_order: i }, { onConflict: 'name' });
    }

    console.log(`Syncing ${rawServices.length} services to DB...`);
    if (!force_reset) {
       await supabase.from('smm_services').update({ is_active: false }).neq('service_id', 0);
    }
    
    for (let i = 0; i < rawServices.length; i++) {
      const item = rawServices[i];
      await supabase.from('smm_services').upsert({
        service_id: parseInt(item.service),
        category_name: item.category || 'Other',
        api_name: item.name,
        provider_rate: parseFloat(item.rate),
        min_order: parseInt(item.min),
        max_order: parseInt(item.max),
        type: item.type || 'Default',
        refill: !!item.refill,
        is_active: true,
        sort_order: i // Preserving API order
      }, { onConflict: 'service_id' });
    }

    // Invalidate cache
    servicesCache = null;

    const balanceRes = await callSmmApi({ key: SMM_API_KEY, action: 'balance' }).catch(() => ({ balance: 0, currency: 'INR' }));

    res.json({ success: true, count: rawServices.length, balance: balanceRes.balance });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/smm/services', async (req, res) => {
  try {
    const { force_sync } = req.body || {};

    // Return cached services if available and NOT force syncing
    if (!force_sync && servicesCache && (Date.now() - lastCacheUpdate < CACHE_TTL)) {
      return res.json({ success: true, services: servicesCache });
    }

    if (force_sync) {
      console.log('Force sync requested, invalidating cache and fetching live...');
      servicesCache = null;
    }

    const { data: dbCategories } = await supabase.from('smm_categories').select('*').order('sort_order', { ascending: true });
    const { data: dbServices } = await supabase.from('smm_services').select('*').eq('is_active', true).order('sort_order', { ascending: true });

    if (!dbServices || dbServices.length === 0 || force_sync) {
      // Auto sync if empty or force requested
      console.log('Fetching live SMM services catalog...');
      const rawServices: any[] = await callSmmApi({ key: SMM_API_KEY, action: 'services' });
      if (Array.isArray(rawServices)) {
        // Upsert categories
        const uniqueCats = [...new Set(rawServices.map(s => s.category || 'Other'))];
        for (const c of uniqueCats) {
          await supabase.from('smm_categories').upsert({ name: c }, { onConflict: 'name', ignoreDuplicates: true });
        }
        
        // Upsert services (update prices)
        for (const item of rawServices) {
          await supabase.from('smm_services').upsert({
            service_id: parseInt(item.service),
            category_name: item.category || 'Other',
            api_name: item.name,
            provider_rate: parseFloat(item.rate),
            min_order: parseInt(item.min),
            max_order: parseInt(item.max),
            type: item.type || 'Default',
            refill: !!item.refill,
            is_active: true
          }, { onConflict: 'service_id' });
        }
      }

      // Re-fetch from DB to get the patched data
      const { data: nDbCats } = await supabase.from('smm_categories').select('*').order('sort_order', { ascending: true });
      const { data: nDbSvc } = await supabase.from('smm_services').select('*').eq('is_active', true).order('sort_order', { ascending: true });
      
      // Update our local references
      const categoriesMap = new Map();
      if (nDbCats) {
        for (const c of nDbCats) categoriesMap.set(c.name, c);
      }

      const patchedServices = (nDbSvc || []).map((row: any) => {
        const cat = categoriesMap.get(row.category_name) || {};
        if (cat.is_active === false) return null;

        const appliedMargin = row.custom_margin !== null && row.custom_margin !== undefined
          ? parseFloat(row.custom_margin)
          : (cat.custom_margin !== null && cat.custom_margin !== undefined ? parseFloat(cat.custom_margin) : PROFIT_MARKUP_PERCENT);

        const originalRate = parseFloat(row.provider_rate);
        const ratePer1000 = Math.round((originalRate * (1 + appliedMargin / 100)) * 100) / 100;

        return {
          id: String(row.service_id),
          category: cat.custom_name || row.category_name,
          name: row.custom_name || row.api_name || `Service #${row.service_id}`,
          ratePer1000,
          min: row.min_order,
          max: row.max_order,
          description: row.custom_description || `⚡ High-quality SMM delivery system for ${row.category_name}.`,
          sort_order: row.sort_order
        };
      }).filter(Boolean);

      servicesCache = patchedServices;
      lastCacheUpdate = Date.now();
      return res.json({ success: true, services: patchedServices });
    }

    const categoriesMap = new Map();
    if (dbCategories) {
      for (const c of dbCategories) categoriesMap.set(c.name, c);
    }

    const patchedServices = (dbServices || []).map((row: any) => {
      const cat = categoriesMap.get(row.category_name) || {};
      if (cat.is_active === false) return null;

      const appliedMargin = row.custom_margin !== null && row.custom_margin !== undefined
        ? parseFloat(row.custom_margin)
        : (cat.custom_margin !== null && cat.custom_margin !== undefined ? parseFloat(cat.custom_margin) : PROFIT_MARKUP_PERCENT);

      const originalRate = parseFloat(row.provider_rate);
      const ratePer1000 = Math.round((originalRate * (1 + appliedMargin / 100)) * 100) / 100;

      const name = row.custom_name || row.api_name || `Service #${row.service_id}`;
      let description = row.custom_description || '';
      if (!description) {
        description = `⚡ High-quality SMM delivery system for ${row.category_name}. Instantly processed with automatic delivery relays, stable speeds, and standard refill support coverage.`;
      }

      return {
        id: String(row.service_id),
        category: cat.custom_name || row.category_name, // Respect custom category names if any
        name,
        ratePer1000,
        min: row.min_order,
        max: row.max_order,
        description,
        sort_order: row.sort_order
      };
    }).filter(Boolean);

    // Update cache
    servicesCache = patchedServices;
    lastCacheUpdate = Date.now();

    res.json({ success: true, services: patchedServices });
  } catch (err: any) {
    console.error('Services error:', err);
    res.json({ success: false, error: err.message });
  }
});

// 2. Add/Forward SMM Order to Social Up Hub API automatically with real-time deduction
app.post('/api/smm/order', async (req, res) => {
  const { serviceId, targetUrl, quantity, charge } = req.body;

  if (!serviceId || !targetUrl || !quantity) {
    return res.status(400).json({ success: false, error: 'Missing required order parameters.' });
  }

  try {
    // 1. Verify Real-time Price Before Placing Order
    const dbServiceReq = await supabase.from('smm_services').select('provider_rate').eq('service_id', parseInt(serviceId)).single();
    if (!dbServiceReq.data) {
       return res.status(400).json({ success: false, error: 'Invalid service ID requested.' });
    }
    const currentDbPrice = parseFloat(dbServiceReq.data.provider_rate);

    // Call live API to get current price for this service
    const rawServices: any[] = await callSmmApi({ key: SMM_API_KEY, action: 'services' });
    const liveService = rawServices.find(s => String(s.service) === String(serviceId));
    
    if (!liveService) {
       return res.status(400).json({ success: false, error: 'Service is no longer offered by the provider.' });
    }

    const livePrice = parseFloat(liveService.rate);

    // Compare prices
    if (livePrice !== currentDbPrice) {
       // Update database
       await supabase.from('smm_services').update({ provider_rate: livePrice }).eq('service_id', parseInt(serviceId));
       
       if (livePrice > currentDbPrice) {
         // Provider increased price, bounce user so they can accept new pricing.
         return res.status(400).json({ 
           success: false, 
           error: 'PRICE_CHANGED_ERROR: The provider has updated the pricing for this service. We have synced our database. Please refresh the page to see the new price and try again.' 
         });
       }
    }

    console.log(`Forwarding order automatically to SMM API... Service: ${serviceId}, Link: ${targetUrl}, Quantity: ${quantity}`);
    
    // Call Social Up Hub API
    const response = await callSmmApi({
      key: SMM_API_KEY,
      action: 'add',
      service: String(serviceId),
      link: String(targetUrl),
      quantity: String(quantity)
    });

    if (response && response.order) {
      console.log('SMM API Order received successfully! Provider Order ID:', response.order);
      return res.json({
        success: true,
        providerOrderId: response.order,
        message: 'Order created and sent to support proxy.'
      });
    } else if (response && response.error) {
      console.error('SMM API Order failed:', response.error);
      return res.status(400).json({ success: false, error: response.error });
    } else {
      return res.status(500).json({ success: false, error: 'Unknown SMM provider response.' });
    }
  } catch (err: any) {
    console.error('Failed to contact provider SMM API server:', err.message);
    res.status(500).json({ success: false, error: 'Provider connection failure. Please confirm your API status.' });
  }
});

// 3. Status sync & dynamic refund trigger
app.post('/api/smm/status-sync', async (req, res) => {
  const { orders } = req.body; // Array of orders containing { id, providerOrderId, charge, status }
  
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.json({ success: true, updatedOrders: [] });
  }

  const updatedOrders: any[] = [];

  try {
    // For performance and compliance, we sync active orders
    for (const order of orders) {
      // Only poll from provider if status is not finalized
      if (order.providerOrderId && (order.status === 'Pending' || order.status === 'In Progress')) {
        try {
          console.log(`Polling status from provider for Order ${order.id} (SMM: ${order.providerOrderId})`);
          const statusResp = await callSmmApi({
            key: SMM_API_KEY,
            action: 'status',
            order: String(order.providerOrderId)
          });

          if (statusResp && statusResp.status) {
            console.log(`Provider reported status for ${order.id}: ${statusResp.status}`);
            
            let status = order.status;
            const provStatus = String(statusResp.status).toLowerCase();

            // SMM status standard mapping
            if (provStatus.includes('completed') || provStatus.includes('success')) {
              status = 'Completed';
            } else if (provStatus.includes('canceled') || provStatus.includes('cancelled') || provStatus.includes('fail')) {
              status = 'Cancelled';
            } else if (provStatus.includes('progress') || provStatus.includes('process') || provStatus.includes('pending')) {
              status = 'In Progress';
            } else if (provStatus.includes('partial')) {
              status = 'Cancelled'; // Mark as cancelled to trigger partial refund or complete refund
            }

            // Prepare refund status flag
            const isNewlyCancelled = (status === 'Cancelled' && order.status !== 'Cancelled');

            updatedOrders.push({
              id: order.id,
              status,
              startCount: statusResp.start_count || 0,
              remains: statusResp.remains || 0,
              refundIssued: isNewlyCancelled, // Signal to client that a refund should be processed
              refundAmount: isNewlyCancelled ? order.charge : 0
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
app.get('/api/smm/settings', async (req, res) => {
  await loadServerSettings();
  res.json({ success: true, settings: { profit_markup_percent: PROFIT_MARKUP_PERCENT, landing_video_url: LANDING_VIDEO_URL } });
});

app.post('/api/smm/settings/update', async (req, res) => {
  const { profit_markup_percent, landing_video_url } = req.body;
  if (profit_markup_percent !== undefined) {
    PROFIT_MARKUP_PERCENT = parseFloat(profit_markup_percent);
    try {
      await supabase.from('global_settings').upsert({ key: 'profit_markup_percent', value: String(profit_markup_percent) });
    } catch(e) { console.warn('Supabase global_settings sync failed:', e); }
  }
  if (landing_video_url !== undefined) {
    LANDING_VIDEO_URL = String(landing_video_url);
    try {
      await supabase.from('global_settings').upsert({ key: 'landing_video_url', value: String(landing_video_url) });
    } catch(e) { console.warn('Supabase global_settings sync failed:', e); }
  }
  res.json({ success: true, settings: { profit_markup_percent: PROFIT_MARKUP_PERCENT, landing_video_url: LANDING_VIDEO_URL } });
});

// === COUPONS ENGINE ===
let couponsMemory: any[] = [
  {
    code: 'WELCOME10',
    discount_percent: 10,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 100,
    used_count: 0
  },
  {
    code: 'BONUS20',
    discount_percent: 20,
    expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 50,
    used_count: 5
  },
  {
    code: 'MEGA50',
    discount_percent: 50,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    max_uses: 20,
    used_count: 2
  }
];

async function getCoupons() {
  try {
    const { data, error } = await supabase.from('coupons').select('*');
    if (data && !error) {
      return data.map((row: any) => ({
        code: row.code,
        discount_percent: parseFloat(row.discount_percent),
        expires_at: row.expires_at,
        max_uses: parseInt(row.max_uses, 10),
        used_count: parseInt(row.used_count, 10)
      }));
    }
  } catch (err) {
    console.warn('Failed getting coupons from Supabase, returning memory list:', err);
  }
  return couponsMemory;
}

app.get('/api/smm/coupons', async (req, res) => {
  const list = await getCoupons();
  res.json({ success: true, coupons: list });
});

app.post('/api/smm/coupons/create', async (req, res) => {
  const { code, discount_percent, expires_at, max_uses } = req.body;
  if (!code || discount_percent === undefined || !expires_at) {
    return res.status(400).json({ success: false, error: 'Missing code, discount_percent, or expires_at.' });
  }

  const newCoupon = {
    code: String(code).toUpperCase().trim(),
    discount_percent: parseFloat(discount_percent),
    expires_at: String(expires_at),
    max_uses: parseInt(max_uses || '100', 10),
    used_count: 0
  };

  const idx = couponsMemory.findIndex(c => c.code === newCoupon.code);
  if (idx !== -1) {
    couponsMemory[idx] = newCoupon;
  } else {
    couponsMemory.push(newCoupon);
  }

  try {
    await supabase.from('coupons').upsert({
      code: newCoupon.code,
      discount_percent: newCoupon.discount_percent,
      expires_at: newCoupon.expires_at,
      max_uses: newCoupon.max_uses,
      used_count: newCoupon.used_count
    });
  } catch (err) {
    console.warn('Coupons db write failed:', err);
  }

  res.json({ success: true, coupon: newCoupon });
});

app.post('/api/smm/coupons/apply', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'Coupon code cannot be empty.' });
  }

  const upperCode = String(code).toUpperCase().trim();
  const list = await getCoupons();
  const coupon = list.find((c: any) => c.code === upperCode);

  if (!coupon) {
    return res.status(404).json({ success: false, error: 'This coupon code does not exist.' });
  }

  if (new Date(coupon.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ success: false, error: 'This coupon code has expired.' });
  }

  if (coupon.used_count >= coupon.max_uses) {
    return res.status(400).json({ success: false, error: 'This coupon is fully claimed.' });
  }

  const memIdx = couponsMemory.findIndex(c => c.code === upperCode);
  if (memIdx !== -1) {
    couponsMemory[memIdx].used_count += 1;
  }

  try {
    await supabase
      .from('coupons')
      .update({ used_count: coupon.used_count + 1 })
      .eq('code', upperCode);
  } catch (err) {
    console.warn('Coupon counter update error:', err);
  }

  res.json({
    success: true,
    discount_percent: coupon.discount_percent,
    message: `Coupon "${upperCode}" applied! Extra ${coupon.discount_percent}% bonus cash will be added.`
  });
});

app.post('/api/smm/coupons/delete', async (req, res) => {
  const { code } = req.body;
  const upperCode = String(code).toUpperCase().trim();
  couponsMemory = couponsMemory.filter(c => c.code !== upperCode);
  try {
    await supabase.from('coupons').delete().eq('code', upperCode);
  } catch (err) {
    console.warn('Coupon db delete fail:', err);
  }
  res.json({ success: true });
});

// === ADMIN USERS & DATA CONTROL ===

// Admin Login
app.post('/api/smm/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  try {
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();

    if (error || !adminUser) {
      return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
    }

    // Success
    res.json({ success: true, token: 'admin-super-secret-token-xyz' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/smm/admin/dashboard', async (req, res) => {
  try {
    const balanceRes = await callSmmApi({ key: SMM_API_KEY, action: 'balance' }).catch(() => ({ balance: 0, currency: 'INR' }));
    
    const { data: dbOrders } = await supabase.from('orders').select('id, charge');
    const { data: dbUsers } = await supabase.from('profiles').select('id');
    const { data: dbTransactions } = await supabase.from('transactions').select('id');
    
    const orders = dbOrders || [];

    res.json({ 
      success: true, 
      stats: {
        totalUsers: (dbUsers || []).length,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.charge || '0'), 0),
        totalTransactions: (dbTransactions || []).length,
        providerBalance: balanceRes?.balance || 0,
        referralPayouts: 0,
        pendingRecharges: 0,
        recentActivity: orders.slice(0, 5)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/smm/admin/users', async (req, res) => {
  try {
    const { data: users } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    res.json({ success: true, users: users || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/smm/admin/users/update-balance', async (req, res) => {
  const { email, balance } = req.body;
  try {
    const { error } = await supabase.from('profiles').update({ balance }).eq('email', email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/smm/admin/users/toggle-admin', async (req, res) => {
  const { email, is_admin } = req.body;
  try {
    const { error } = await supabase.from('profiles').update({ is_admin }).eq('email', email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/smm/admin/users/toggle-ban', async (req, res) => {
  const { email, is_banned } = req.body;
  try {
    const { error } = await supabase.from('profiles').update({ status: is_banned ? 'banned' : 'active' }).eq('email', email);
    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/smm/admin/transactions', async (req, res) => {
  try {
    const { data: transactions } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    res.json({ success: true, transactions: transactions || [], pendingRecharges: [], recharges: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/smm/admin/transactions/approve-recharge', async (req, res) => {
  const { txId } = req.body;
  res.json({ success: true }); // Simplification for demo
});

app.post('/api/smm/admin/transactions/reject-recharge', async (req, res) => {
  const { txId } = req.body;
  res.json({ success: true }); // Simplification for demo
});

// Categories and Services overrides
app.get('/api/smm/admin/categories', async (req, res) => {
  try {
    const { data: categories } = await supabase.from('smm_categories').select('*').order('sort_order', { ascending: true });
    res.json({ success: true, categories: categories || [] });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/smm/admin/categories/update', async (req, res) => {
  const { name, is_active, custom_margin, custom_name, sort_order } = req.body;
  try {
    const { error } = await supabase.from('smm_categories').upsert({
      name,
      is_active,
      custom_margin,
      custom_name,
      sort_order
    }, { onConflict: 'name' });
    
    if (error) throw error;
    servicesCache = null; // Invalidate cache
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/smm/admin/services', async (req, res) => {
  try {
    const { data: services } = await supabase.from('smm_services').select('*').order('sort_order', { ascending: true });
    res.json({ success: true, services: services || [] });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/smm/admin/services/update', async (req, res) => {
  const { service_id, is_active, custom_margin, custom_name, custom_description, sort_order } = req.body;
  try {
    const { error } = await supabase.from('smm_services').upsert({
      service_id,
      is_active,
      custom_margin,
      custom_name,
      custom_description,
      sort_order
    }, { onConflict: 'service_id' });
    
    if (error) throw error;
    servicesCache = null; // Invalidate cache
    res.json({ success: true });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

app.get('/api/smm/admin/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    res.json({ success: true, orders: data || [] });
  } catch (err: any) {
    res.json({ success: true, orders: [] });
  }
});

app.get('/api/smm/admin/provider-balance', async (req, res) => {
  try {
    const data = await callSmmApi({ key: SMM_API_KEY, action: 'balance' });
    res.json({ success: true, balance: data.balance, currency: data.currency });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
});

// Vite server development configuration
async function initializeServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware loaded.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static handler loaded.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

initializeServer();
