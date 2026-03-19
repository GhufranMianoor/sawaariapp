# Sawaari App

A premium ride-aggregator frontend prototype built with plain HTML, CSS, and JavaScript.

## Project Structure

- `index.html`: Main app markup and screen layout.
- `assets/css/main.css`: All styling (theme, layout, responsive rules).
- `assets/js/app.js`: App state, user flows, offers logic, ride simulation, and UI rendering.

## Upgrades Applied

- Split monolithic single-file app into separate HTML, CSS, and JS assets.
- Added head metadata for SEO and browser theming (`description`, `theme-color`).
- Added resource hints (`preconnect`) for Google Fonts.
- Switched to deferred external script loading for cleaner startup behavior.
- Fixed ride-arrival timeout validation to avoid stale timer updates.
- Added Escape-key support to close overlays/modals quickly.
- Replaced app data persistence from browser `localStorage` with Supabase database storage.

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor and run:

```sql
create table if not exists public.sw_users (
	id uuid primary key default gen_random_uuid(),
	phone text not null unique,
	name text not null,
	joined_at timestamptz not null default now(),
	log jsonb not null default '{"booked":[],"current":null,"completed":[]}'::jsonb,
	active jsonb,
	theme text not null default 'dark',
	updated_at timestamptz not null default now()
);

alter table public.sw_users enable row level security;

drop policy if exists "public read sw_users" on public.sw_users;
create policy "public read sw_users"
on public.sw_users
for select
to anon
using (true);

drop policy if exists "public insert sw_users" on public.sw_users;
create policy "public insert sw_users"
on public.sw_users
for insert
to anon
with check (true);

drop policy if exists "public update sw_users" on public.sw_users;
create policy "public update sw_users"
on public.sw_users
for update
to anon
using (true)
with check (true);
```

3. In [index.html](index.html), set:

```html
window.SUPABASE_URL='https://YOUR-PROJECT-REF.supabase.co';
window.SUPABASE_ANON_KEY='YOUR-ANON-KEY';
```

## Normalized Database Schema (Recommended)

If you want proper normalization, run [supabase/normalized_schema.sql](supabase/normalized_schema.sql) in Supabase SQL Editor.

What it creates:
- `users` + `prefs`
- `locations`
- `vehicle_types` + `platforms`
- `drivers` + `vehicles`
- `rides` + `ride_offers` + `ride_status`
- `reviews`

Notes:
- The script keeps `sw_users` available for current app compatibility.
- It also applies grants and RLS policies for anon access (same model your app currently uses).
- You can migrate frontend reads/writes table-by-table later without breaking current signup/login.

## Run Locally

You can open `index.html` directly, or use any static server:

```bash
# Python example
python3 -m http.server 5500
```

Then open `http://localhost:5500`.

## Notes

User and ride data is stored in Supabase.
The app uses cookies only for a lightweight session pointer (`sw_session_phone`) and theme (`sw_theme`).
