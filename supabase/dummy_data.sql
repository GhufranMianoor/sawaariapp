-- Dummy data for Sawaari normalized schema
-- Idempotent: re-running updates existing rows and avoids duplicate copies.
-- Uses short aliases (u1, l1, d1, r1, o1) instead of hard-coded long UUID literals.

begin;

-- 1) Reference tables
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

-- 2) Locations (upsert by natural key)
insert into public.locations (name, area, city)
values
  ('DHA Phase 6', 'Defence Housing Authority', 'Karachi'),
  ('Dolmen Mall', 'Clifton Block 4', 'Karachi'),
  ('Saddar', 'Central Business District', 'Karachi'),
  ('Karachi Airport (JIAP)', 'PAF Base Faisal', 'Karachi'),
  ('Johar Chowrangi', 'Gulshan-e-Iqbal', 'Karachi'),
  ('Bahadurabad', 'PECHS', 'Karachi'),
  ('Clifton Beach', 'Block 5 Clifton', 'Karachi'),
  ('North Nazimabad', 'Hyderi Market', 'Karachi'),
  ('Shahrah-e-Faisal', 'PECHS', 'Karachi'),
  ('Scheme 33', 'Gulzar-e-Hijri', 'Karachi')
on conflict (name, area, city) do update
set city = excluded.city;

-- 3) Users + prefs (upsert by phone)
insert into public.users (phone, name, joined_at, updated_at)
values
  ('923001112233', 'Ahmed Raza', now() - interval '25 days', now()),
  ('923004445566', 'Sara Khan', now() - interval '18 days', now()),
  ('923007778899', 'Bilal Ahmed', now() - interval '11 days', now()),
  ('923001234567', 'Hina Malik', now() - interval '6 days', now()),
  ('923009876543', 'Umar Farooq', now() - interval '2 days', now())
on conflict (phone) do update
set name = excluded.name,
    updated_at = now();

with pref_src(phone, theme) as (
  values
    ('923001112233', 'dark'),
    ('923004445566', 'light'),
    ('923007778899', 'dark'),
    ('923001234567', 'light'),
    ('923009876543', 'dark')
)
insert into public.prefs (user_id, theme, updated_at)
select u.id, p.theme, now()
from pref_src p
join public.users u on u.phone = p.phone
on conflict (user_id) do update
set theme = excluded.theme,
    updated_at = now();

-- 4) Drivers (update by name, insert missing)
with src(alias, name, rating, created_at) as (
  values
    ('d1','Ali Hassan',4.8::numeric, now() - interval '60 days'),
    ('d2','Saad Malik',4.6::numeric, now() - interval '45 days'),
    ('d3','Hamza Butt',4.7::numeric, now() - interval '30 days'),
    ('d4','Kashif Raza',4.5::numeric, now() - interval '22 days'),
    ('d5','Faisal Khan',4.9::numeric, now() - interval '17 days'),
    ('d6','Asad Mehmood',4.4::numeric, now() - interval '10 days'),
    ('d7','Tariq Nawaz',4.3::numeric, now() - interval '8 days'),
    ('d8','Imran Shah',4.7::numeric, now() - interval '4 days')
)
update public.drivers d
set rating = s.rating
from src s
where d.name = s.name;

with src(alias, name, rating, created_at) as (
  values
    ('d1','Ali Hassan',4.8::numeric, now() - interval '60 days'),
    ('d2','Saad Malik',4.6::numeric, now() - interval '45 days'),
    ('d3','Hamza Butt',4.7::numeric, now() - interval '30 days'),
    ('d4','Kashif Raza',4.5::numeric, now() - interval '22 days'),
    ('d5','Faisal Khan',4.9::numeric, now() - interval '17 days'),
    ('d6','Asad Mehmood',4.4::numeric, now() - interval '10 days'),
    ('d7','Tariq Nawaz',4.3::numeric, now() - interval '8 days'),
    ('d8','Imran Shah',4.7::numeric, now() - interval '4 days')
)
insert into public.drivers (name, rating, created_at)
select s.name, s.rating, s.created_at
from src s
where not exists (select 1 from public.drivers d where d.name = s.name);

-- 5) Vehicles (update by model+type, insert missing)
with src(alias, type_code, model, created_at) as (
  values
    ('v1','Bike','Honda CD 70 (2023)', now() - interval '50 days'),
    ('v2','Bike','Yamaha YBR 125', now() - interval '44 days'),
    ('v3','Rickshaw','CNG Rickshaw', now() - interval '40 days'),
    ('v4','Mini','Suzuki Alto (2023)', now() - interval '28 days'),
    ('v5','Sedan','Toyota Corolla (2024)', now() - interval '20 days'),
    ('v6','Business','Hyundai Tucson', now() - interval '13 days'),
    ('v7','Carpool','Honda BR-V', now() - interval '7 days')
)
insert into public.vehicles (type_id, model, created_at)
select vt.id, s.model, s.created_at
from src s
join public.vehicle_types vt on vt.code = s.type_code
where not exists (
  select 1 from public.vehicles v
  where v.type_id = vt.id and v.model = s.model
);

-- 6) Rides (use short aliases + deterministic business keys)
with ride_src(alias, user_phone, p_name, p_area, d_name, d_area, type_code, plat_code, status, est_km, est_min, offer_fare, final_fare, cancel_reason) as (
  values
    ('r1','923001112233','DHA Phase 6','Defence Housing Authority','Dolmen Mall','Clifton Block 4','Bike','bykea','completed',8.4::numeric,22,320::numeric,305::numeric,null),
    ('r2','923004445566','Karachi Airport (JIAP)','PAF Base Faisal','Bahadurabad','PECHS','Sedan','yango','cancelled',13.2::numeric,34,950::numeric,null,'Changed my mind'),
    ('r3','923007778899','Johar Chowrangi','Gulshan-e-Iqbal','Clifton Beach','Block 5 Clifton','Rickshaw','indrive','arriving',6.1::numeric,18,420::numeric,null,null)
), resolved as (
  select
    rs.alias,
    u.id as user_id,
    lp.id as pickup_id,
    ld.id as drop_id,
    vt.id as type_id,
    pl.id as platform_id,
    rs.status,
    rs.est_km,
    rs.est_min,
    rs.offer_fare,
    rs.final_fare,
    rs.cancel_reason
  from ride_src rs
  join public.users u on u.phone = rs.user_phone
  join public.locations lp on lp.name = rs.p_name and lp.area = rs.p_area and lp.city = 'Karachi'
  join public.locations ld on ld.name = rs.d_name and ld.area = rs.d_area and ld.city = 'Karachi'
  join public.vehicle_types vt on vt.code = rs.type_code
  join public.platforms pl on pl.code = rs.plat_code
)
update public.rides r
set
  est_km = x.est_km,
  est_min = x.est_min,
  offer_fare = x.offer_fare,
  final_fare = x.final_fare,
  cancel_reason = x.cancel_reason,
  updated_at = now()
from resolved x
where r.user_id = x.user_id
  and r.pickup_id = x.pickup_id
  and r.drop_id = x.drop_id
  and r.platform_id = x.platform_id
  and r.status = x.status;

with ride_src(alias, user_phone, p_name, p_area, d_name, d_area, type_code, plat_code, status, est_km, est_min, offer_fare, final_fare, cancel_reason) as (
  values
    ('r1','923001112233','DHA Phase 6','Defence Housing Authority','Dolmen Mall','Clifton Block 4','Bike','bykea','completed',8.4::numeric,22,320::numeric,305::numeric,null),
    ('r2','923004445566','Karachi Airport (JIAP)','PAF Base Faisal','Bahadurabad','PECHS','Sedan','yango','cancelled',13.2::numeric,34,950::numeric,null,'Changed my mind'),
    ('r3','923007778899','Johar Chowrangi','Gulshan-e-Iqbal','Clifton Beach','Block 5 Clifton','Rickshaw','indrive','arriving',6.1::numeric,18,420::numeric,null,null)
)
insert into public.rides (user_id, pickup_id, drop_id, type_id, platform_id, status, est_km, est_min, offer_fare, final_fare, cancel_reason, created_at, updated_at)
select
  u.id,
  lp.id,
  ld.id,
  vt.id,
  pl.id,
  rs.status,
  rs.est_km,
  rs.est_min,
  rs.offer_fare,
  rs.final_fare,
  rs.cancel_reason,
  now() - interval '1 day',
  now()
from ride_src rs
join public.users u on u.phone = rs.user_phone
join public.locations lp on lp.name = rs.p_name and lp.area = rs.p_area and lp.city = 'Karachi'
join public.locations ld on ld.name = rs.d_name and ld.area = rs.d_area and ld.city = 'Karachi'
join public.vehicle_types vt on vt.code = rs.type_code
join public.platforms pl on pl.code = rs.plat_code
where not exists (
  select 1 from public.rides r
  where r.user_id = u.id
    and r.pickup_id = lp.id
    and r.drop_id = ld.id
    and r.platform_id = pl.id
    and r.status = rs.status
);

-- 7) Ride offers (match rides by business key)
with offer_src(alias, ride_alias, plat_code, driver_name, type_code, model, fare, driver_km, eta_min, smart_score, seats, status) as (
  values
    ('o1','r3','indrive','Ali Hassan','Rickshaw','CNG Rickshaw',430::numeric,1.7::numeric,8,89,null,'live'),
    ('o2','r1','bykea','Faisal Khan','Bike','Honda CD 70 (2023)',305::numeric,0.9::numeric,4,96,null,'accepted')
), rides_resolved as (
  select * from (
    select 'r1'::text as alias, r.id as ride_id
    from public.rides r
    join public.users u on u.id = r.user_id and u.phone = '923001112233'
    join public.platforms p on p.id = r.platform_id and p.code = 'bykea'
    where r.status = 'completed'
    order by r.created_at desc
    limit 1
  ) r1
  union all
  select * from (
    select 'r3'::text as alias, r.id as ride_id
    from public.rides r
    join public.users u on u.id = r.user_id and u.phone = '923007778899'
    join public.platforms p on p.id = r.platform_id and p.code = 'indrive'
    where r.status = 'arriving'
    order by r.created_at desc
    limit 1
  ) r3
)
insert into public.ride_offers (ride_id, platform_id, driver_id, vehicle_id, type_id, fare, driver_km, eta_min, smart_score, seats, status, created_at)
select
  rr.ride_id,
  p.id,
  d.id,
  v.id,
  vt.id,
  os.fare,
  os.driver_km,
  os.eta_min,
  os.smart_score,
  os.seats::smallint,
  os.status,
  now() - interval '10 minutes'
from offer_src os
join rides_resolved rr on rr.alias = os.ride_alias
join public.platforms p on p.code = os.plat_code
join public.drivers d on d.name = os.driver_name
join public.vehicle_types vt on vt.code = os.type_code
join public.vehicles v on v.type_id = vt.id and v.model = os.model
where not exists (
  select 1 from public.ride_offers ro
  where ro.ride_id = rr.ride_id
    and ro.platform_id = p.id
    and ro.driver_id = d.id
    and ro.status = os.status
);

-- 8) Ride status log (insert-if-missing)
with status_src(ride_alias, status, note, at_time) as (
  values
    ('r1','searching','User started search', now() - interval '5 days'),
    ('r1','booked','Offer accepted', now() - interval '5 days' + interval '2 minutes'),
    ('r1','completed','Ride finished', now() - interval '5 days' + interval '28 minutes'),
    ('r2','cancelled','User cancelled before start', now() - interval '2 days' + interval '7 minutes')
), rides_resolved as (
  select * from (
    select 'r1'::text as alias, r.id as ride_id
    from public.rides r
    join public.users u on u.id = r.user_id and u.phone = '923001112233'
    where r.status = 'completed'
    order by r.created_at desc
    limit 1
  ) r1
  union all
  select * from (
    select 'r2'::text as alias, r.id as ride_id
    from public.rides r
    join public.users u on u.id = r.user_id and u.phone = '923004445566'
    where r.status = 'cancelled'
    order by r.created_at desc
    limit 1
  ) r2
)
insert into public.ride_status (ride_id, status, note, at_time)
select rr.ride_id, s.status, s.note, s.at_time
from status_src s
join rides_resolved rr on rr.alias = s.ride_alias
where not exists (
  select 1 from public.ride_status rs
  where rs.ride_id = rr.ride_id and rs.status = s.status and coalesce(rs.note,'') = coalesce(s.note,'')
);

-- 9) Reviews (upsert by ride_id)
with target_ride as (
  select r.id as ride_id, u.id as user_id
  from public.rides r
  join public.users u on u.id = r.user_id and u.phone = '923001112233'
  where r.status = 'completed'
  order by r.created_at desc
  limit 1
), target_driver as (
  select id as driver_id from public.drivers where name = 'Faisal Khan' limit 1
)
insert into public.reviews (ride_id, user_id, driver_id, stars, text, created_at)
select tr.ride_id, tr.user_id, td.driver_id, 5, 'Very smooth ride and polite driver.', now() - interval '5 days' + interval '35 minutes'
from target_ride tr
cross join target_driver td
on conflict (ride_id) do update
set stars = excluded.stars,
    text = excluded.text;

-- 10) Legacy compatibility table (sw_users) upsert by phone
insert into public.sw_users (phone, name, joined_at, log, active, theme, updated_at)
values
  (
    '923001112233',
    'Ahmed Raza',
    now() - interval '25 days',
    '{"booked":[],"current":null,"completed":[]}'::jsonb,
    null,
    'dark',
    now()
  ),
  (
    '923004445566',
    'Sara Khan',
    now() - interval '18 days',
    '{"booked":[],"current":null,"completed":[]}'::jsonb,
    null,
    'light',
    now()
  )
on conflict (phone) do update
set name = excluded.name,
    theme = excluded.theme,
    updated_at = now();

commit;

-- Quick checks
select 'users' as table_name, count(*) as rows from public.users
union all
select 'prefs', count(*) from public.prefs
union all
select 'drivers', count(*) from public.drivers
union all
select 'vehicles', count(*) from public.vehicles
union all
select 'rides', count(*) from public.rides
union all
select 'ride_offers', count(*) from public.ride_offers
union all
select 'ride_status', count(*) from public.ride_status
union all
select 'reviews', count(*) from public.reviews
union all
select 'locations', count(*) from public.locations;
