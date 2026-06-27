import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://mfrnehshclymmydtykpa.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcm5laHNoY2x5bW15ZHR5a3BhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMzQyNjUsImV4cCI6MjA5NzcxMDI2NX0.dhdfx9xURndzS6MSSsZmH5HI0O59VAY8Vfl7UZt4yxM";

interface RequiredTable {
  name: string;
  columns: { name: string; type: string; definition: string }[];
  sqlCreate: string;
}

const REQUIRED_SCHEMAS: RequiredTable[] = [
  {
    name: 'profiles',
    columns: [
      { name: 'id', type: 'uuid', definition: 'id uuid primary key default gen_random_uuid()' },
      { name: 'email', type: 'text', definition: 'email text unique not null' },
      { name: 'name', type: 'text', definition: 'name text' },
      { name: 'balance', type: 'numeric', definition: 'balance numeric default 0.00' },
      { name: 'is_admin', type: 'boolean', definition: 'is_admin boolean default false' },
      { name: 'status', type: 'text', definition: 'status text default \'active\'' },
      { name: 'phone', type: 'text', definition: 'phone text unique' },
      { name: 'password_hash', type: 'text', definition: 'password_hash text' },
      { name: 'picture', type: 'text', definition: 'picture text' },
      { name: 'api_key', type: 'text', definition: 'api_key text' },
      { name: 'created_at', type: 'timestamp with time zone', definition: 'created_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  balance numeric default 0.00,
  is_admin boolean default false,
  status text default 'active',
  phone text unique,
  password_hash text,
  picture text,
  api_key text,
  created_at timestamp with time zone default now()
);`
  },
  {
    name: 'admin_users',
    columns: [
      { name: 'id', type: 'uuid', definition: 'id uuid primary key default gen_random_uuid()' },
      { name: 'username', type: 'text', definition: 'username text unique not null' },
      { name: 'password', type: 'text', definition: 'password text not null' },
      { name: 'created_at', type: 'timestamp with time zone', definition: 'created_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  created_at timestamp with time zone default now()
);`
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', type: 'uuid', definition: 'id uuid primary key default gen_random_uuid()' },
      { name: 'user_email', type: 'text', definition: 'user_email text not null' },
      { name: 'service_id', type: 'text', definition: 'service_id text not null' },
      { name: 'original_rate', type: 'numeric', definition: 'original_rate numeric not null' },
      { name: 'charge', type: 'numeric', definition: 'charge numeric not null' },
      { name: 'link', type: 'text', definition: 'link text not null' },
      { name: 'quantity', type: 'integer', definition: 'quantity integer not null' },
      { name: 'status', type: 'text', definition: 'status text not null default \'Pending\'' },
      { name: 'provider_order_id', type: 'text', definition: 'provider_order_id text' },
      { name: 'start_count', type: 'integer', definition: 'start_count integer default 0' },
      { name: 'remains', type: 'integer', definition: 'remains integer' },
      { name: 'created_at', type: 'timestamp with time zone', definition: 'created_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.orders (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  service_id text not null,
  original_rate numeric not null,
  charge numeric not null,
  link text not null,
  quantity integer not null,
  status text not null default 'Pending',
  provider_order_id text,
  start_count integer default 0,
  remains integer,
  created_at timestamp with time zone default now()
);`
  },
  {
    name: 'transactions',
    columns: [
      { name: 'id', type: 'uuid', definition: 'id uuid primary key default gen_random_uuid()' },
      { name: 'user_email', type: 'text', definition: 'user_email text not null' },
      { name: 'amount', type: 'numeric', definition: 'amount numeric not null' },
      { name: 'type', type: 'text', definition: 'type text not null' },
      { name: 'status', type: 'text', definition: 'status text not null default \'completed\'' },
      { name: 'description', type: 'text', definition: 'description text' },
      { name: 'created_at', type: 'timestamp with time zone', definition: 'created_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  amount numeric not null,
  type text not null,
  status text not null default 'completed',
  description text,
  created_at timestamp with time zone default now()
);`
  },
  {
    name: 'smm_categories',
    columns: [
      { name: 'name', type: 'text', definition: 'name text primary key' },
      { name: 'custom_margin', type: 'numeric', definition: 'custom_margin numeric' },
      { name: 'is_active', type: 'boolean', definition: 'is_active boolean default true' },
      { name: 'sort_order', type: 'integer', definition: 'sort_order integer default 0' },
      { name: 'custom_name', type: 'text', definition: 'custom_name text' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.smm_categories (
  name text primary key,
  custom_margin numeric,
  is_active boolean default true,
  sort_order integer default 0,
  custom_name text
);`
  },
  {
    name: 'smm_services',
    columns: [
      { name: 'service_id', type: 'integer', definition: 'service_id integer primary key' },
      { name: 'category_name', type: 'text', definition: 'category_name text references public.smm_categories(name) ON DELETE CASCADE' },
      { name: 'api_name', type: 'text', definition: 'api_name text not null' },
      { name: 'custom_name', type: 'text', definition: 'custom_name text' },
      { name: 'custom_description', type: 'text', definition: 'custom_description text' },
      { name: 'provider_rate', type: 'numeric', definition: 'provider_rate numeric not null' },
      { name: 'custom_margin', type: 'numeric', definition: 'custom_margin numeric' },
      { name: 'min_order', type: 'integer', definition: 'min_order integer' },
      { name: 'max_order', type: 'integer', definition: 'max_order integer' },
      { name: 'type', type: 'text', definition: 'type text' },
      { name: 'refill', type: 'boolean', definition: 'refill boolean default false' },
      { name: 'is_active', type: 'boolean', definition: 'is_active boolean default true' },
      { name: 'updated_at', type: 'timestamp with time zone', definition: 'updated_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.smm_services (
  service_id integer primary key,
  category_name text references public.smm_categories(name) ON DELETE CASCADE,
  api_name text not null,
  custom_name text,
  custom_description text,
  provider_rate numeric not null,
  custom_margin numeric,
  min_order integer,
  max_order integer,
  type text,
  refill boolean default false,
  is_active boolean default true,
  updated_at timestamp with time zone default now()
);`
  },
  {
    name: 'global_settings',
    columns: [
      { name: 'id', type: 'uuid', definition: 'id uuid primary key default gen_random_uuid()' },
      { name: 'key', type: 'text', definition: 'key text unique not null' },
      { name: 'value', type: 'text', definition: 'value text not null' },
      { name: 'updated_at', type: 'timestamp with time zone', definition: 'updated_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.global_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamp with time zone default now()
);`
  },
  {
    name: 'coupons',
    columns: [
      { name: 'id', type: 'uuid', definition: 'id uuid primary key default gen_random_uuid()' },
      { name: 'code', type: 'text', definition: 'code text unique not null' },
      { name: 'discount_percent', type: 'numeric', definition: 'discount_percent numeric not null default 0.00' },
      { name: 'max_uses', type: 'integer', definition: 'max_uses integer default 100' },
      { name: 'uses', type: 'integer', definition: 'uses integer default 0' },
      { name: 'expires_at', type: 'timestamp with time zone', definition: 'expires_at timestamp with time zone' },
      { name: 'created_at', type: 'timestamp with time zone', definition: 'created_at timestamp with time zone default now()' }
    ],
    sqlCreate: `CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_percent numeric not null default 0.00,
  max_uses integer default 100,
  uses integer default 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now()
);`
  }
];

async function runCheck() {
  console.log('====================================================');
  console.log('🛡️  SMM PANEL DATABASE SCHEMA COMPATIBILITY CHECKER 🛡️');
  console.log('====================================================');
  console.log(`Connecting to: ${SUPABASE_URL}`);
  
  try {
    // Fetch OpenAPI schema from Supabase
    const schemaUrl = `${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}`;
    const response = await fetch(schemaUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch schema metadata from Supabase. Status: ${response.status}`);
    }
    
    const schema = await response.json();
    const definitions = schema.definitions || {};
    
    const missingTables: RequiredTable[] = [];
    const missingColumns: { tableName: string; colName: string; type: string; definition: string }[] = [];
    
    for (const reqTable of REQUIRED_SCHEMAS) {
      const dbTable = definitions[reqTable.name];
      if (!dbTable) {
        missingTables.push(reqTable);
        continue;
      }
      
      const properties = dbTable.properties || {};
      for (const reqCol of reqTable.columns) {
        if (!properties[reqCol.name]) {
          missingColumns.push({
            tableName: reqTable.name,
            colName: reqCol.name,
            type: reqCol.type,
            definition: reqCol.definition
          });
        }
      }
    }
    
    console.log('\n📊 DATABASE AUDIT RESULTS:');
    
    if (missingTables.length === 0 && missingColumns.length === 0) {
      console.log('✅ EXCELLENT! Your Supabase database is 100% COMPATIBLE with the latest updates.');
      console.log('🎉 No tables or columns are missing. All systems are fully aligned.');
      
      // Let\'s check global settings values as well
      await checkGlobalSettings();
      console.log('====================================================');
      return;
    }
    
    console.log(`⚠️  COMPATIBILITY OUT OF SYNC! Detected:`);
    if (missingTables.length > 0) {
      console.log(`   - ${missingTables.length} missing tables: ${missingTables.map(t => t.name).join(', ')}`);
    }
    if (missingColumns.length > 0) {
      console.log(`   - ${missingColumns.length} missing columns inside existing tables:`);
      missingColumns.forEach(c => {
        console.log(`     👉 Table "${c.tableName}" is missing column "${c.colName}" (${c.type})`);
      });
    }
    
    console.log('\n💡 RECOMMENDED ACTIONS:');
    console.log('Copy the following SQL commands and paste them into the SQL Editor of your Supabase Dashboard to repair the schema:\n');
    console.log('-- ====================================================');
    console.log('-- 🚀 SCHEMA REPAIR & COMPATIBILITY MIGRATION SCRIPT  --');
    console.log('-- ====================================================');
    
    if (missingTables.length > 0) {
      console.log('\n-- Create missing tables');
      missingTables.forEach(t => {
        console.log(t.sqlCreate);
        console.log();
      });
    }
    
    if (missingColumns.length > 0) {
      console.log('\n-- Add missing columns to existing tables');
      missingColumns.forEach(c => {
        let typeStr = c.type;
        if (c.colName === 'custom_name' || c.colName === 'phone' || c.colName === 'password_hash' || c.colName === 'picture' || c.colName === 'api_key') {
          typeStr = 'text';
        } else if (c.colName === 'is_active') {
          typeStr = 'boolean default true';
        } else if (c.colName === 'sort_order') {
          typeStr = 'integer default 0';
        }
        console.log(`ALTER TABLE public.${c.tableName} ADD COLUMN IF NOT EXISTS ${c.colName} ${typeStr};`);
      });
    }
    
    console.log('\n-- Ensure essential configurations are seeded');
    console.log(`INSERT INTO public.global_settings (key, value) VALUES ('profit_markup_percent', '15') ON CONFLICT (key) DO NOTHING;`);
    console.log(`INSERT INTO public.global_settings (key, value) VALUES ('landing_video_url', '') ON CONFLICT (key) DO NOTHING;`);
    console.log(`INSERT INTO public.global_settings (key, value) VALUES ('pinned_category', '') ON CONFLICT (key) DO NOTHING;`);
    console.log(`INSERT INTO public.global_settings (key, value) VALUES ('starred_services', '[]') ON CONFLICT (key) DO NOTHING;`);
    console.log('\n-- ====================================================');
    
    console.log('\nOnce applied, re-run this script to confirm your database is 100% updated.');
    
  } catch (err: any) {
    console.error('❌ Error executing database audit:', err.message);
  }
  console.log('====================================================');
}

async function checkGlobalSettings() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('global_settings').select('key, value');
    if (error) throw error;
    
    const keys = (data || []).map(row => row.key);
    const missingKeys = [];
    
    if (!keys.includes('profit_markup_percent')) missingKeys.push('profit_markup_percent');
    if (!keys.includes('landing_video_url')) missingKeys.push('landing_video_url');
    if (!keys.includes('pinned_category')) missingKeys.push('pinned_category');
    if (!keys.includes('starred_services')) missingKeys.push('starred_services');
    
    if (missingKeys.length > 0) {
      console.log(`\n⚙️  Note: Some essential keys are missing from your global_settings table: [${missingKeys.join(', ')}]`);
      console.log('We recommend running the following seed SQL queries in Supabase:');
      missingKeys.forEach(k => {
        const defaultVal = k === 'starred_services' ? '[]' : (k === 'profit_markup_percent' ? '15' : '');
        console.log(`INSERT INTO public.global_settings (key, value) VALUES ('${k}', '${defaultVal}') ON CONFLICT (key) DO NOTHING;`);
      });
    } else {
      console.log('⚙️  All global_settings keys (profit_markup_percent, landing_video_url, pinned_category, starred_services) are correctly seeded.');
    }
  } catch (e: any) {
    console.log('\n⚠️  Could not fetch global_settings row keys directly (this is fine if you have not run the SQL commands yet). Error:', e.message);
  }
}

runCheck();
