CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  balance numeric default 0.00,
  is_admin boolean default false,
  status text default 'active',
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,
  created_at timestamp with time zone default now()
);

-- Insert default admin (Please change the password in production)
INSERT INTO public.admin_users (username, password) VALUES ('admin', 'admin123') ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.orders (
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
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  amount numeric not null,
  type text not null,
  status text not null default 'completed',
  description text,
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.smm_categories (
  name text primary key,
  custom_margin numeric,
  is_active boolean default true,
  sort_order integer default 0
);

CREATE TABLE IF NOT EXISTS public.smm_services (
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
);

CREATE TABLE IF NOT EXISTS public.global_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text not null,
  updated_at timestamp with time zone default now()
);

-- Initial Settings
INSERT INTO public.global_settings (key, value) VALUES ('profit_markup_percent', '15') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.global_settings (key, value) VALUES ('landing_video_url', 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0&mute=1&controls=1') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_percent numeric not null default 0.00,
  max_uses integer default 100,
  uses integer default 0,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_email text not null,
  subject text not null,
  message text not null,
  status text not null default 'Open',
  reply text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);
