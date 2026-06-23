import { createClient } from '@supabase/supabase-js';
import { SMMOrder, SupportTicket, TicketReply, UserSession, Transaction } from '../types';

const SUPABASE_URL = 'https://mfrnehshclymmydtykpa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcm5laHNoY2x5bW15ZHR5a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQyNjUsImV4cCI6MjA5NzcxMDI2NX0.dhdfx9xURndzS6MSSsZmH5HI0O59VAY8Vfl7UZt4yxM';

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
 *   balance NUMERIC DEFAULT 10000.00, -- Default INR balance (e.g., ₹10,000)
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
 *   service_name TEXT NOT NULL,
 *   category TEXT NOT NULL,
 *   target_url TEXT NOT NULL,
 *   quantity INTEGER NOT NULL,
 *   charge NUMERIC NOT NULL,
 *   status TEXT DEFAULT 'Pending' NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
 * );
 * ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
 * 
 * -- 3. Support Tickets Table
 * CREATE TABLE IF NOT EXISTS public.tickets (
 *   id TEXT PRIMARY KEY,
 *   user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
 *   subject TEXT NOT NULL,
 *   message TEXT NOT NULL,
 *   status TEXT DEFAULT 'Open' NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
 * );
 * ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;
 * 
 * -- 4. Ticket Replies Table
 * CREATE TABLE IF NOT EXISTS public.ticket_replies (
 *   id TEXT PRIMARY KEY,
 *   ticket_id TEXT REFERENCES public.tickets(id) ON DELETE CASCADE,
 *   sender TEXT NOT NULL CHECK (sender IN ('user', 'support')),
 *   message TEXT NOT NULL,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
 * );
 * ALTER TABLE public.ticket_replies DISABLE ROW LEVEL SECURITY;
 * 
 * -- 5. Transactions Table (Add Funds log)
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
-- 1. Profiles Table (Added is_admin field)
CREATE TABLE IF NOT EXISTS public.profiles (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  picture TEXT,
  balance NUMERIC DEFAULT 10000.00, -- Default ₹10,000 INR
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
  service_name TEXT NOT NULL,
  category TEXT NOT NULL,
  target_url TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  charge NUMERIC NOT NULL,
  status TEXT DEFAULT 'Pending' NOT NULL,
  provider_order_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- 3. Support Tickets Table
CREATE TABLE IF NOT EXISTS public.tickets (
  id TEXT PRIMARY KEY,
  user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'Open' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.tickets DISABLE ROW LEVEL SECURITY;

-- 4. Ticket Replies Table
CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id TEXT PRIMARY KEY,
  ticket_id TEXT REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'support')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.ticket_replies DISABLE ROW LEVEL SECURITY;

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY,
  user_email TEXT REFERENCES public.profiles(email) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL,
  status TEXT DEFAULT 'Success' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- 6. Coupons Table (New)
CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  discount_percent NUMERIC NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER DEFAULT 100 NOT NULL,
  used_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.coupons DISABLE ROW LEVEL SECURITY;

-- 7. Global Settings Table (New)
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
    const initialBalance = 10000.00; // INR 10,000 default balance
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
      balance: 10000.00,
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
      serviceId: row.service_id,
      serviceName: row.service_name,
      category: row.category,
      targetUrl: row.target_url,
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
    const { error } = await supabase
      .from('orders')
      .insert({
        id: order.id,
        user_email: email,
        service_id: order.serviceId,
        service_name: order.serviceName,
        category: order.category,
        target_url: order.targetUrl,
        quantity: order.quantity,
        charge: order.charge,
        status: order.status,
        created_at: order.createdAt,
        provider_order_id: order.providerOrderId
      });

    if (error) {
      console.error('Supabase order insert error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Helper: Fetch tickets and replies
export async function getDbTickets(email: string): Promise<SupportTicket[]> {
  try {
    const { data: ticketsData, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (ticketsError) {
      console.error('Fetch tickets error:', ticketsError);
      return [];
    }

    if (!ticketsData || ticketsData.length === 0) return [];

    // Fetch replies for these tickets
    const ticketIds = ticketsData.map(t => t.id);
    const { data: repliesData, error: repliesError } = await supabase
      .from('ticket_replies')
      .select('*')
      .in('ticket_id', ticketIds)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('Fetch ticket replies error:', repliesError);
    }

    const repliesMap: Record<string, TicketReply[]> = {};
    (repliesData || []).forEach(row => {
      if (!repliesMap[row.ticket_id]) {
        repliesMap[row.ticket_id] = [];
      }
      repliesMap[row.ticket_id].push({
        id: row.id,
        sender: row.sender as 'user' | 'support',
        message: row.message,
        createdAt: row.created_at
      });
    });

    return ticketsData.map(t => ({
      id: t.id,
      subject: t.subject,
      message: t.message,
      status: t.status as any,
      replies: repliesMap[t.id] || [],
      createdAt: t.created_at
    }));
  } catch (err) {
    console.error(err);
    return [];
  }
}

// Helper: Setup live support / client ticket insertion
export async function createDbTicket(email: string, ticket: SupportTicket): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tickets')
      .insert({
        id: ticket.id,
        user_email: email,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status,
        created_at: ticket.createdAt
      });

    if (error) {
      console.error('Supabase insert ticket error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Helper: Add ticket reply
export async function createDbTicketReply(ticketId: string, reply: TicketReply): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ticket_replies')
      .insert({
        id: reply.id,
        ticket_id: ticketId,
        sender: reply.sender,
        message: reply.message,
        created_at: reply.createdAt
      });

    if (error) {
      console.error('Supabase ticket reply insert error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

// Helper: Update Ticket Status
export async function updateDbTicketStatus(ticketId: string, status: 'Open' | 'Closed' | 'Answered'): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', ticketId);
    if (error) {
      console.error(error);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

// Helper: Log transaction
export async function logDbTransaction(email: string, tx: Transaction): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert({
        id: tx.id,
        user_email: email,
        amount: tx.amount,
        method: tx.method,
        status: tx.status,
        created_at: tx.createdAt
      });
    if (error) {
      console.error(error);
      return false;
    }
    return true;
  } catch (err) {
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
      id: row.id,
      amount: parseFloat(row.amount),
      method: row.method,
      status: row.status as any,
      createdAt: row.created_at
    }));
  } catch (err) {
    return [];
  }
}
