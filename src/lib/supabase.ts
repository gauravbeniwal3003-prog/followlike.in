import { createClient } from '@supabase/supabase-js';
import { SMMOrder, UserSession, Transaction } from '../types';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://mfrnehshclymmydtykpa.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcm5laHNoY2x5bW15ZHR5a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQyNjUsImV4cCI6MjA5NzcxMDI2NX0.dhdfx9xURndzS6MSSsZmH5HI0O59VAY8Vfl7UZt4yxM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * SQL SCHEMA FOR SUPABASE SETUP
 * Run these statements in your Supabase SQL Editor (SQL Query Runner) to initialize database tables:
 * 
 * -- 1. Profiles Table
 * CREATE TABLE IF NOT EXISTS public.profiles (
 *   email TEXT PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   picture TEXT,
 *   balance NUMERIC DEFAULT 0.00, -- Default INR balance
 *   api_key TEXT,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
 * );
 * 
 * -- Enable public read/write or add RLS rules as needed (or keep simple for preview)
 * ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
 * 
 * -- 2. SMM Orders Table
 * CREATE TABLE IF NOT EXISTS public.orders (
 *   id TEXT PRIMARY KEY,
 *   user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
 *   service_id TEXT NOT NULL,
 *   target_url TEXT NOT NULL,
 *   quantity INTEGER NOT NULL,
 *   charge NUMERIC NOT NULL,
 *   status TEXT DEFAULT 'Pending' NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
 * );
 * ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
 * 
 * -- 3. Transactions Table (Add Funds log)
 * CREATE TABLE IF NOT EXISTS public.transactions (
 *   id TEXT PRIMARY KEY,
 *   user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
 *   amount NUMERIC NOT NULL,
 *   method TEXT NOT NULL,
 *   status TEXT DEFAULT 'Success' NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
 * );
 * ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
 */

export const DATABASE_SQL_INSTRUCTIONS = `
-- MIGRATION STAGE: Run this to update your existing profiles table for email/phone signup and password hash
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 1. Profiles Table (Complete schema with phone & password_hash)
CREATE TABLE IF NOT EXISTS public.profiles (
  email TEXT PRIMARY KEY,
  phone TEXT UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  picture TEXT,
  balance NUMERIC DEFAULT 0.00, -- Default ₹0 INR
  api_key TEXT,
  is_admin BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. SMM Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
  service_id TEXT NOT NULL,
  target_url TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  charge NUMERIC NOT NULL,
  status TEXT DEFAULT 'Pending' NOT NULL,
  provider_order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'Success' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- 4. Coupons Table (New)
CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  discount_percent NUMERIC NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER DEFAULT 100 NOT NULL,
  used_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;

-- 5. Global Settings Table (New)
CREATE TABLE IF NOT EXISTS public.global_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.global_settings DISABLE ROW LEVEL SECURITY;

-- Seed default global settings
INSERT INTO public.global_settings (key, value) VALUES ('landing_video_url', 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1&controls=1') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.global_settings (key, value) VALUES ('profit_markup_percent', '15') ON CONFLICT (key) DO NOTHING;
`;

// Helper: Sync or Create user session profile
export async function syncUserProfile(email: string, name: string): Promise<UserSession> {
  try {
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile from Supabase:', error);
    }

    const automatedAdmin = email.toLowerCase() === 'gauravbeniwal30003@gmail.com';

    if (existing) {
      const isAdmin = existing.is_admin || automatedAdmin;
      return {
        email: existing.email,
        name: existing.name,
        picture: existing.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(existing.name)}&backgroundColor=000000&color=ffffff`,
        balance: parseFloat(existing.balance),
        apiKey: existing.api_key || 'smm_KEY' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        isAdmin: isAdmin
      };
    }

    // Create profile
    const initialBalance = 0; // INR 0 default balance
    const apiKey = 'smm_KEY' + Math.random().toString(36).substring(2, 12).toUpperCase();
    const pic = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=000000&color=ffffff`;
    const isAdmin = automatedAdmin;

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        email,
        name,
        picture: pic,
        balance: initialBalance,
        api_key: apiKey,
        is_admin: isAdmin
      });

    if (insertError) {
      console.warn('Error profile creation in Supabase, falling back locally', insertError);
    }

    return {
      email,
      name,
      picture: pic,
      balance: initialBalance,
      apiKey,
      isAdmin
    };
  } catch (err) {
    console.error('Failed to sync profile, fallback to default offline metrics:', err);
    const automatedAdmin = email.toLowerCase() === 'gauravbeniwal30003@gmail.com';
    return {
      email,
      name,
      picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=000000&color=ffffff`,
      balance: 0,
      apiKey: 'smm_KEYLOCAL_OFFLINE',
      isAdmin: automatedAdmin
    };
  }
}

// Helper: Save balance
export async function updateDbBalance(email: string, balance: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ balance })
      .eq('email', email);
    if (error) {
      console.error('Supabase update balance error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Helper: Fetch orders
export async function getDbOrders(email: string): Promise<SMMOrder[]> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase order fetch error:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      serviceId: row.service_id || '',
      serviceName: row.service_name || `Service #${row.service_id || ''}`,
      category: row.category || 'General',
      targetUrl: row.target_url || row.link || '',
      quantity: row.quantity,
      charge: parseFloat(row.charge),
      status: row.status as any,
      createdAt: row.created_at,
      providerOrderId: row.provider_order_id
    }));
  } catch (err) {
    console.error('Failed to getDbOrders:', err);
    return [];
  }
}

// Helper: Create order
export async function createDbOrder(email: string, order: SMMOrder): Promise<boolean> {
  try {
    // Attempt 1: Try inserting with maximum column match combining both schemas
    const schema1Result = await supabase
      .from('orders')
      .insert({
        id: order.id,
        user_email: email,
        service_id: order.serviceId,
        service_name: order.serviceName,
        category: order.category,
        target_url: order.targetUrl,
        link: order.targetUrl,
        quantity: order.quantity,
        charge: order.charge,
        original_rate: order.charge,
        status: order.status,
        created_at: order.createdAt,
        provider_order_id: order.providerOrderId
      });

    if (!schema1Result.error) {
      return true;
    }

    console.warn('Unified insertion scheme failed, trying fallback scheme 2 (database.sql format):', schema1Result.error);

    // Attempt 2: minimal fallback insertion matching database.sql standard schema
    const schema2Result = await supabase
      .from('orders')
      .insert({
        user_email: email,
        service_id: order.serviceId,
        original_rate: order.charge,
        charge: order.charge,
        link: order.targetUrl,
        quantity: order.quantity,
        status: order.status,
        created_at: order.createdAt,
        provider_order_id: order.providerOrderId
      });

    if (!schema2Result.error) {
      return true;
    }

    console.warn('Fallback scheme 2 failed, trying fallback scheme 3 (frontend specific):', schema2Result.error);

    // Attempt 3: Frontend-only custom schema format
    const schema3Result = await supabase
      .from('orders')
      .insert({
        id: order.id,
        user_email: email,
        service_id: order.serviceId,
        target_url: order.targetUrl,
        quantity: order.quantity,
        charge: order.charge,
        status: order.status,
        created_at: order.createdAt,
        provider_order_id: order.providerOrderId
      });

    if (schema3Result.error) {
      console.error('All order insertion schemes failed:', schema3Result.error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Exception during order database insertion:', err);
    return false;
  }
}

// Helper: Log transaction
export async function logDbTransaction(email: string, tx: Transaction): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tx.id);
    
    // Attempt 1: Schema A (id text/uuid, type, description, status)
    const payloadA: any = {
      user_email: email,
      amount: tx.amount,
      type: tx.method,
      status: tx.status || 'Success',
      created_at: tx.createdAt || new Date().toISOString(),
      description: tx.id
    };
    if (isUuid) {
      payloadA.id = tx.id;
    }

    const { error: errorA } = await supabase.from('transactions').insert(payloadA);
    if (!errorA) {
      return true;
    }

    console.warn('logDbTransaction Schema A failed, trying Schema B:', errorA);

    // Attempt 2: Schema B (id, method, status)
    const payloadB: any = {
      user_email: email,
      amount: tx.amount,
      method: tx.method,
      status: tx.status || 'Success',
      created_at: tx.createdAt || new Date().toISOString()
    };
    if (isUuid || typeof tx.id === 'string') {
      payloadB.id = tx.id;
    }

    const { error: errorB } = await supabase.from('transactions').insert(payloadB);
    if (errorB) {
      console.error('All transaction logging schemes failed:', errorB);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception logging transaction:', err);
    return false;
  }
}

// Helper: Retrieve transactions
export async function getDbTransactions(email: string): Promise<Transaction[]> {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }
    return (data || []).map(row => ({
      id: row.description || row.id,
      amount: parseFloat(row.amount),
      method: row.method || row.type || 'Razorpay Gateway',
      status: row.status as any,
      createdAt: row.created_at
    }));
  } catch (err) {
    return [];
  }
}
