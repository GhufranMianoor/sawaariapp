-- Sawaari normalized schema (3NF-oriented) for Supabase/Postgres
-- Keeps existing sw_users table compatibility for the current frontend.

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1) Reference/master tables
-- ============================================================

create table if not exists public.vehicle_types (
  id smallserial primary key,
  code text not null unique,
  name text not null,
  base_fare numeric(10,2) not null check (base_fare >= 0),
  carpool boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.platforms (
  id smallserial primary key,
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text,
  city text not null default 'Karachi',
  created_at timestamptz not null default now(),
  unique (name, area, city)
);

-- ============================================================
-- 2) User domain tables
-- ============================================================

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  theme text not null default 'dark',
  updated_at timestamptz not null default now(),
  check (theme in ('dark','light'))
);

-- ============================================================
-- 3) Driver and vehicle tables
-- ============================================================

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating numeric(2,1) not null default 5.0 check (rating >= 1.0 and rating <= 5.0),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  type_id smallint not null references public.vehicle_types(id),
  model text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4) Ride workflow tables
-- ============================================================

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pickup_id uuid not null references public.locations(id),
  drop_id uuid not null references public.locations(id),
  type_id smallint not null references public.vehicle_types(id),
  platform_id smallint references public.platforms(id),
  status text not null default 'searching' check (
    status in ('searching','booked','arriving','in_transit','completed','cancelled')
  ),
  est_km numeric(6,2) check (est_km >= 0),
  est_min integer check (est_min >= 0),
  offer_fare numeric(10,2) check (offer_fare >= 0),
  final_fare numeric(10,2) check (final_fare >= 0),
  cancel_reason text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  platform_id smallint not null references public.platforms(id),
  driver_id uuid references public.drivers(id),
  vehicle_id uuid references public.vehicles(id),
  type_id smallint not null references public.vehicle_types(id),
  fare numeric(10,2) not null check (fare >= 0),
  driver_km numeric(6,2) check (driver_km >= 0),
  eta_min integer check (eta_min >= 0),
  smart_score integer check (smart_score >= 0 and smart_score <= 100),
  seats smallint check (seats is null or seats >= 1),
  status text not null default 'live' check (status in ('live','expired','accepted','rejected')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  accepted_at timestamptz
);

create table if not exists public.ride_status (
  id bigserial primary key,
  ride_id uuid not null references public.rides(id) on delete cascade,
  status text not null check (
    status in ('searching','booked','arriving','in_transit','completed','cancelled')
  ),
  note text,
  at_time timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  driver_id uuid references public.drivers(id),
  stars smallint not null check (stars between 1 and 5),
  text text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 5) Seed reference values (idempotent)
-- ============================================================

insert into public.vehicle_types (code, name, base_fare, carpool)
values
  ('Bike', 'Bike', 130, false),
  ('Rickshaw', 'Rickshaw', 180, false),
  ('Mini', 'Mini', 280, false),
  ('Sedan', 'Sedan', 380, false),
  ('Business', 'Business', 620, false),
  ('Carpool', 'Carpool', 120, true)
on conflict (code) do update
set name = excluded.name,
    base_fare = excluded.base_fare,
    carpool = excluded.carpool;

insert into public.platforms (code, name)
values
  ('yango', 'Yango'),
  ('bykea', 'Bykea'),
  ('indrive', 'InDrive'),
  ('carpool', 'Carpool')
on conflict (code) do update
set name = excluded.name;

-- ============================================================
-- 6) Performance indexes
-- ============================================================

create index if not exists idx_users_phone on public.users(phone);
create index if not exists idx_rides_user_id on public.rides(user_id);
create index if not exists idx_rides_status on public.rides(status);
create index if not exists idx_rides_created_at on public.rides(created_at desc);
create index if not exists idx_ride_offers_ride_id on public.ride_offers(ride_id);
create index if not exists idx_ride_offers_status on public.ride_offers(status);
create index if not exists idx_ride_status_ride_id on public.ride_status(ride_id);
create index if not exists idx_reviews_user_id on public.reviews(user_id);

-- ============================================================
-- 7) Grants for anon key usage (demo/dev setup)
-- ============================================================

grant usage on schema public to anon;
grant select, insert, update on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;

-- ============================================================
-- 8) RLS policies (permissive for current app behavior)
-- ============================================================

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'sw_users',
        'users',
        'prefs',
        'locations',
        'vehicle_types',
        'platforms',
        'drivers',
        'vehicles',
        'rides',
        'ride_offers',
        'ride_status',
        'reviews'
      )
  loop
    execute format('alter table public.%I enable row level security', t.tablename);

    execute format('drop policy if exists "anon_select_%s" on public.%I', t.tablename, t.tablename);
    execute format('drop policy if exists "anon_insert_%s" on public.%I', t.tablename, t.tablename);
    execute format('drop policy if exists "anon_update_%s" on public.%I', t.tablename, t.tablename);

    execute format(
      'create policy "anon_select_%s" on public.%I for select to anon using (true)',
      t.tablename,
      t.tablename
    );

    execute format(
      'create policy "anon_insert_%s" on public.%I for insert to anon with check (true)',
      t.tablename,
      t.tablename
    );

    execute format(
      'create policy "anon_update_%s" on public.%I for update to anon using (true) with check (true)',
      t.tablename,
      t.tablename
    );
  end loop;
end $$;

commit;

-- Verify created tables
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'sw_users',
    'users',
    'prefs',
    'locations',
    'vehicle_types',
    'platforms',
    'drivers',
    'vehicles',
    'rides',
    'ride_offers',
    'ride_status',
    'reviews'
  )
order by table_name;