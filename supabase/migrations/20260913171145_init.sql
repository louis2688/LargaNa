-- LargaNa schema v1: riders, drivers, tiers, rides, dispatch offers, events, ratings.
-- Every state change goes through the RPCs at the bottom. Clients never write rides,
-- offers, locations or ratings directly (no insert/update policies exist for them).

create extension if not exists postgis with schema extensions;
create extension if not exists pg_cron;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ---------------------------------------------------------------- types
create type public.user_role as enum ('rider', 'driver', 'admin');
create type public.driver_status as enum ('pending', 'approved', 'suspended');
create type public.ride_status as enum (
  'requested', 'accepted', 'arrived', 'in_progress', 'completed',
  'cancelled_by_rider', 'cancelled_by_driver', 'no_driver'
);
create type public.offer_response as enum ('pending', 'accepted', 'declined', 'expired');
create type public.payment_method as enum ('cash');

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'rider',
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Money is integer centavos. Fare = max(min_fare, base + per_km*km + per_min*min), rounded to the peso.
create table public.ride_tiers (
  id text primary key,
  name text not null,
  description text not null,
  seats smallint not null,
  base_fare integer not null,
  per_km integer not null,
  per_min integer not null,
  min_fare integer not null,
  sort_order smallint not null default 0,
  active boolean not null default true
);

create table public.driver_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status public.driver_status not null default 'pending',
  tier_id text not null references public.ride_tiers (id), -- ponytail: one tier per vehicle; eligibility matrix later
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_color text not null,
  plate_number text not null,
  is_online boolean not null default false,
  rating numeric(3, 2) not null default 5.00,
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.driver_locations (
  driver_id uuid primary key references public.driver_profiles (user_id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  heading real,
  speed real,
  updated_at timestamptz not null default now()
);
create index driver_locations_location_idx on public.driver_locations using gist (location);

create table public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id),
  driver_id uuid references public.driver_profiles (user_id),
  tier_id text not null references public.ride_tiers (id),
  status public.ride_status not null default 'requested',
  pickup extensions.geography(point, 4326) not null,
  pickup_address text not null,
  dropoff extensions.geography(point, 4326) not null,
  dropoff_address text not null,
  distance_m integer not null,
  duration_s integer not null,
  quoted_fare integer not null,
  final_fare integer,
  payment_method public.payment_method not null default 'cash',
  cancel_reason text,
  requested_at timestamptz not null default now(),
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);
create index rides_rider_idx on public.rides (rider_id, requested_at desc);
create index rides_driver_idx on public.rides (driver_id, requested_at desc);
-- Invariants the DB enforces: one active ride per rider, one active trip per driver.
create unique index rides_one_active_per_rider on public.rides (rider_id)
  where status in ('requested', 'accepted', 'arrived', 'in_progress');
create unique index rides_one_active_per_driver on public.rides (driver_id)
  where status in ('accepted', 'arrived', 'in_progress');

create table public.ride_events (
  id bigint generated always as identity primary key,
  ride_id uuid not null references public.rides (id) on delete cascade,
  actor_id uuid,
  from_status public.ride_status,
  to_status public.ride_status not null,
  created_at timestamptz not null default now()
);
create index ride_events_ride_idx on public.ride_events (ride_id, created_at);

create table public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  driver_id uuid not null references public.driver_profiles (user_id) on delete cascade,
  response public.offer_response not null default 'pending',
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  unique (ride_id, driver_id)
);
create index ride_offers_pending_idx on public.ride_offers (driver_id) where response = 'pending';

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides (id) on delete cascade,
  rater_id uuid not null references public.profiles (id),
  ratee_id uuid not null references public.profiles (id),
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (ride_id, rater_id)
);

-- ---------------------------------------------------------------- triggers
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' = 'driver' then 'driver' else 'rider' end::public.user_role,
    new.raw_user_meta_data ->> 'full_name',
    new.phone
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.log_ride_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.ride_events (ride_id, actor_id, from_status, to_status)
    values (new.id, auth.uid(), case when tg_op = 'UPDATE' then old.status end, new.status);
  end if;
  return new;
end $$;
create trigger rides_log_event after insert or update of status on public.rides
  for each row execute function public.log_ride_event();

create function public.apply_rating() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.driver_profiles dp
  set rating = round((dp.rating * dp.rating_count + new.stars) / (dp.rating_count + 1.0), 2),
      rating_count = dp.rating_count + 1,
      updated_at = now()
  where dp.user_id = new.ratee_id;
  return new;
end $$;
create trigger ratings_apply after insert on public.ratings
  for each row execute function public.apply_rating();

-- ---------------------------------------------------------------- internal helpers (not exposed)
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create function public.geo_point(lat double precision, lng double precision) returns extensions.geography
language sql immutable as $$
  select extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;
$$;

-- ponytail: straight-line distance x 1.3 road factor at a flat 20 km/h Cebu average.
-- Swap for a Directions API call (Edge Function) once the Google Maps key exists.
create function public.estimate_route(pickup extensions.geography, dropoff extensions.geography,
  out distance_m integer, out duration_s integer)
language sql immutable as $$
  select greatest(200, round(extensions.st_distance(pickup, dropoff) * 1.3))::integer,
         greatest(60, round(extensions.st_distance(pickup, dropoff) * 1.3 / 5.56))::integer;
$$;

create function public.fare_for(tier public.ride_tiers, distance_m integer, duration_s integer) returns integer
language sql immutable as $$
  select greatest(tier.min_fare,
    round((tier.base_fare + tier.per_km * distance_m / 1000.0 + tier.per_min * duration_s / 60.0) / 100.0)::integer * 100);
$$;

-- Online, approved, recently-seen drivers of a tier within radius, nearest first, not on a trip.
create function public.available_drivers(tier text, near extensions.geography, radius_m integer default 3000)
returns table (driver_id uuid, distance_m integer)
language sql stable security definer set search_path = '' as $$
  select dp.user_id, extensions.st_distance(dl.location, near)::integer
  from public.driver_profiles dp
  join public.driver_locations dl on dl.driver_id = dp.user_id
  where dp.is_online and dp.status = 'approved' and dp.tier_id = tier
    and dl.updated_at > now() - interval '2 minutes'
    and extensions.st_dwithin(dl.location, near, radius_m)
    and not exists (select 1 from public.rides x where x.driver_id = dp.user_id
                    and x.status in ('accepted', 'arrived', 'in_progress'))
  order by dl.location operator(extensions.<->) near;
$$;

create function public.expire_stale_requests() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.ride_offers o set response = 'expired', responded_at = now()
  where o.response = 'pending' and o.expires_at < now();
  -- ponytail: no second wave; re-dispatch to the next ring of drivers when demand justifies it
  update public.rides r set status = 'no_driver'
  where r.status = 'requested' and r.requested_at < now() - interval '45 seconds'
    and not exists (select 1 from public.ride_offers o where o.ride_id = r.id and o.response = 'pending');
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.is_admin(), public.geo_point(double precision, double precision),
  public.estimate_route(extensions.geography, extensions.geography),
  public.fare_for(public.ride_tiers, integer, integer),
  public.available_drivers(text, extensions.geography, integer),
  public.expire_stale_requests()
  from public, anon, authenticated;

-- ---------------------------------------------------------------- RPCs (the app's API)
-- Quotes for every active tier, plus how many drivers are nearby and the nearest one's ETA.
create function public.fare_quote(pickup_lat double precision, pickup_lng double precision,
  dropoff_lat double precision, dropoff_lng double precision)
returns table (tier_id text, name text, description text, seats smallint, fare integer,
  distance_m integer, duration_s integer, nearby integer, eta_s integer)
language sql stable security definer set search_path = '' as $$
  with r as (
    select public.geo_point(pickup_lat, pickup_lng) as pickup, e.distance_m, e.duration_s
    from public.estimate_route(public.geo_point(pickup_lat, pickup_lng), public.geo_point(dropoff_lat, dropoff_lng)) e
  )
  select t.id, t.name, t.description, t.seats, public.fare_for(t, r.distance_m, r.duration_s),
    r.distance_m, r.duration_s, n.nearby, n.eta_s
  from public.ride_tiers t
  cross join r
  left join lateral (
    select count(*)::integer as nearby, (min(a.distance_m) * 1.3 / 5.56)::integer as eta_s
    from public.available_drivers(t.id, r.pickup) a
  ) n on true
  where t.active
  order by t.sort_order;
$$;

create function public.request_ride(tier_id text, pickup_lat double precision, pickup_lng double precision,
  pickup_address text, dropoff_lat double precision, dropoff_lng double precision, dropoff_address text)
returns public.rides
language plpgsql security definer set search_path = '' as $$
declare
  rider uuid := auth.uid();
  t public.ride_tiers;
  p extensions.geography := public.geo_point(pickup_lat, pickup_lng);
  d extensions.geography := public.geo_point(dropoff_lat, dropoff_lng);
  route record;
  ride public.rides;
  offers integer;
begin
  if rider is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into t from public.ride_tiers x where x.id = request_ride.tier_id and x.active;
  if not found then raise exception 'unknown tier %', request_ride.tier_id; end if;
  if exists (select 1 from public.rides x where x.rider_id = rider
             and x.status in ('requested', 'accepted', 'arrived', 'in_progress')) then
    raise exception 'you already have an active ride';
  end if;

  select * into route from public.estimate_route(p, d);
  insert into public.rides (rider_id, tier_id, pickup, pickup_address, dropoff, dropoff_address,
    distance_m, duration_s, quoted_fare)
  values (rider, t.id, p, request_ride.pickup_address, d, request_ride.dropoff_address,
    route.distance_m, route.duration_s, public.fare_for(t, route.distance_m, route.duration_s))
  returning * into ride;

  -- Dispatch: offer to the nearest 5; first accept_ride() wins.
  insert into public.ride_offers (ride_id, driver_id, expires_at)
  select ride.id, a.driver_id, now() + interval '30 seconds'
  from public.available_drivers(t.id, p) a
  limit 5;
  get diagnostics offers = row_count;
  if offers = 0 then
    update public.rides x set status = 'no_driver' where x.id = ride.id returning * into ride;
  end if;
  return ride;
end $$;

create function public.accept_ride(ride_id uuid) returns public.rides
language plpgsql security definer set search_path = '' as $$
declare
  drv uuid := auth.uid();
  ride public.rides;
begin
  if not exists (select 1 from public.ride_offers o where o.ride_id = accept_ride.ride_id
                 and o.driver_id = drv and o.response = 'pending' and o.expires_at > now()) then
    raise exception 'no pending offer for this driver';
  end if;
  -- Atomic first-wins: the row lock + status predicate make concurrent accepts lose here.
  update public.rides r set driver_id = drv, status = 'accepted', accepted_at = now()
  where r.id = accept_ride.ride_id and r.status = 'requested'
  returning * into ride;
  if not found then raise exception 'ride no longer available'; end if;
  update public.ride_offers o set response = 'accepted', responded_at = now()
  where o.ride_id = ride.id and o.driver_id = drv;
  update public.ride_offers o set response = 'expired', responded_at = now()
  where o.ride_id = ride.id and o.response = 'pending';
  return ride;
end $$;

create function public.decline_offer(ride_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.ride_offers o set response = 'declined', responded_at = now()
  where o.ride_id = decline_offer.ride_id and o.driver_id = auth.uid() and o.response = 'pending';
  if not found then raise exception 'no pending offer for this driver'; end if;
  update public.rides r set status = 'no_driver'
  where r.id = decline_offer.ride_id and r.status = 'requested'
    and not exists (select 1 from public.ride_offers o where o.ride_id = r.id and o.response = 'pending');
end $$;

-- Driver-side trip transitions: accepted -> arrived -> in_progress -> completed.
create function public.advance_ride(ride_id uuid, to_status public.ride_status) returns public.rides
language plpgsql security definer set search_path = '' as $$
declare
  drv uuid := auth.uid();
  from_status public.ride_status;
  ride public.rides;
begin
  from_status := case to_status
    when 'arrived' then 'accepted'
    when 'in_progress' then 'arrived'
    when 'completed' then 'in_progress'
  end;
  if from_status is null then raise exception 'invalid transition to %', to_status; end if;
  update public.rides r set
    status = to_status,
    arrived_at = case when to_status = 'arrived' then now() else r.arrived_at end,
    started_at = case when to_status = 'in_progress' then now() else r.started_at end,
    completed_at = case when to_status = 'completed' then now() else r.completed_at end,
    final_fare = case when to_status = 'completed' then r.quoted_fare else r.final_fare end -- ponytail: upfront pricing
  where r.id = advance_ride.ride_id and r.driver_id = drv and r.status = from_status
  returning * into ride;
  if not found then raise exception 'ride is not % for this driver', from_status; end if;
  return ride;
end $$;

create function public.cancel_ride(ride_id uuid, reason text default null) returns public.rides
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ride public.rides;
begin
  update public.rides r set
    status = case when r.rider_id = uid then 'cancelled_by_rider' else 'cancelled_by_driver' end::public.ride_status,
    cancelled_at = now(),
    cancel_reason = reason
  where r.id = cancel_ride.ride_id
    and ((r.rider_id = uid and r.status in ('requested', 'accepted', 'arrived'))
      or (r.driver_id = uid and r.status in ('accepted', 'arrived')))
  returning * into ride;
  if not found then raise exception 'ride cannot be cancelled'; end if;
  update public.ride_offers o set response = 'expired', responded_at = now()
  where o.ride_id = ride.id and o.response = 'pending';
  return ride;
end $$;

create function public.set_driver_online(online boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare result boolean;
begin
  update public.driver_profiles dp set is_online = online, updated_at = now()
  where dp.user_id = auth.uid() and dp.status = 'approved'
  returning dp.is_online into result;
  if not found then raise exception 'driver is not approved'; end if;
  return result;
end $$;

create function public.update_driver_location(lat double precision, lng double precision,
  heading real default null, speed real default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.driver_locations (driver_id, location, heading, speed, updated_at)
  select dp.user_id, public.geo_point(lat, lng), heading, speed, now()
  from public.driver_profiles dp where dp.user_id = auth.uid() and dp.status = 'approved'
  on conflict (driver_id) do update
    set location = excluded.location, heading = excluded.heading, speed = excluded.speed, updated_at = now();
$$;

create function public.rate_ride(ride_id uuid, stars smallint, comment text default null) returns void
language sql security definer set search_path = '' as $$
  insert into public.ratings (ride_id, rater_id, ratee_id, stars, comment)
  select r.id, auth.uid(), case when r.rider_id = auth.uid() then r.driver_id else r.rider_id end, stars, comment
  from public.rides r
  where r.id = rate_ride.ride_id and r.status = 'completed' and auth.uid() in (r.rider_id, r.driver_id);
$$;

revoke execute on function public.request_ride(text, double precision, double precision, text, double precision, double precision, text),
  public.accept_ride(uuid), public.decline_offer(uuid), public.advance_ride(uuid, public.ride_status),
  public.cancel_ride(uuid, text), public.set_driver_online(boolean),
  public.update_driver_location(double precision, double precision, real, real),
  public.rate_ride(uuid, smallint, text)
  from public, anon;

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.ride_tiers enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.rides enable row level security;
alter table public.ride_events enable row level security;
alter table public.ride_offers enable row level security;
alter table public.ratings enable row level security;

-- Tables that only RPCs may write.
revoke insert, update, delete on public.rides, public.ride_events, public.ride_offers,
  public.ratings, public.driver_locations from anon, authenticated;
-- Column-level: users edit their own contact details, never their role; drivers edit their
-- vehicle, never their approval status, online flag or rating.
revoke update on public.profiles, public.driver_profiles from anon, authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant update (tier_id, vehicle_make, vehicle_model, vehicle_color, plate_number) on public.driver_profiles to authenticated;

create policy "profiles: self, admin, or ride counterpart" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r
    where (r.rider_id = auth.uid() and r.driver_id = profiles.id)
       or (r.driver_id = auth.uid() and r.rider_id = profiles.id)));
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "tiers: public read" on public.ride_tiers for select to anon, authenticated using (true);
create policy "tiers: admin write" on public.ride_tiers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "drivers: self, admin, or my driver" on public.driver_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r where r.rider_id = auth.uid() and r.driver_id = driver_profiles.user_id));
create policy "drivers: onboard self as pending" on public.driver_profiles for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and is_online = false);
create policy "drivers: update self" on public.driver_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "drivers: admin update" on public.driver_profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "locations: self, admin, or my driver on an active ride" on public.driver_locations for select to authenticated
  using (driver_id = auth.uid() or public.is_admin() or exists (
    select 1 from public.rides r where r.rider_id = auth.uid() and r.driver_id = driver_locations.driver_id
      and r.status in ('accepted', 'arrived', 'in_progress')));

create policy "rides: participants or admin" on public.rides for select to authenticated
  using (rider_id = auth.uid() or driver_id = auth.uid() or public.is_admin());

create policy "events: ride participants or admin" on public.ride_events for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.rides r where r.id = ride_events.ride_id and auth.uid() in (r.rider_id, r.driver_id)));

create policy "offers: own or admin" on public.ride_offers for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

create policy "ratings: participants or admin" on public.ratings for select to authenticated
  using (rater_id = auth.uid() or ratee_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- realtime + cron
alter publication supabase_realtime add table public.rides, public.ride_offers, public.driver_locations;
select cron.schedule('expire-stale-ride-requests', '15 seconds', $$select public.expire_stale_requests()$$);

-- ---------------------------------------------------------------- reference data (admin-editable)
insert into public.ride_tiers (id, name, description, seats, base_fare, per_km, per_min, min_fare, sort_order) values
  ('go',   'LargaGo',   'Everyday rides',     4, 4500, 1500, 200,  6000, 1),
  ('plus', 'LargaPlus', 'Extra comfort',      4, 6000, 2000, 300,  9000, 2),
  ('van',  'LargaVan',  'For the whole crew', 6, 8000, 2800, 400, 12000, 3);
