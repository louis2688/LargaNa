-- Follow-up to init: advisor fixes, ETA floor, and an admin RPC for driver approval.

-- ETA floors at 60 s: a driver already at the pickup is "1 min", never "0 s".
create or replace function public.fare_quote(pickup_lat double precision, pickup_lng double precision,
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
    select count(*)::integer as nearby, greatest(60, (min(a.distance_m) * 1.3 / 5.56)::integer) as eta_s
    from public.available_drivers(t.id, r.pickup) a
  ) n on true
  where t.active
  order by t.sort_order;
$$;

-- Pin search_path on the pure helpers (advisor 0011).
alter function public.geo_point(double precision, double precision) set search_path = '';
alter function public.estimate_route(extensions.geography, extensions.geography) set search_path = '';
alter function public.fare_for(public.ride_tiers, integer, integer) set search_path = '';

-- Trigger functions are not an API (advisors 0028/0029).
revoke execute on function public.handle_new_user(), public.log_ride_event(), public.apply_rating()
  from public, anon, authenticated;

-- Column-level grants stop admins too, so approval goes through an RPC.
create function public.admin_set_driver_status(driver_id uuid, new_status public.driver_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.driver_profiles dp
  set status = new_status,
      is_online = case when new_status = 'approved' then dp.is_online else false end,
      updated_at = now()
  where dp.user_id = admin_set_driver_status.driver_id;
  if not found then raise exception 'no such driver'; end if;
end $$;
revoke execute on function public.admin_set_driver_status(uuid, public.driver_status) from public, anon;

-- RLS: evaluate auth.uid()/is_admin() once per statement (advisor 0003), one policy per action (0006).
alter policy "profiles: self, admin, or ride counterpart" on public.profiles
  using (id = (select auth.uid()) or (select public.is_admin()) or exists (
    select 1 from public.rides r
    where (r.rider_id = (select auth.uid()) and r.driver_id = profiles.id)
       or (r.driver_id = (select auth.uid()) and r.rider_id = profiles.id)));
alter policy "profiles: update self" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "tiers: admin write" on public.ride_tiers;
create policy "tiers: admin insert" on public.ride_tiers for insert to authenticated with check ((select public.is_admin()));
create policy "tiers: admin update" on public.ride_tiers for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "tiers: admin delete" on public.ride_tiers for delete to authenticated using ((select public.is_admin()));

alter policy "drivers: self, admin, or my driver" on public.driver_profiles
  using (user_id = (select auth.uid()) or (select public.is_admin()) or exists (
    select 1 from public.rides r where r.rider_id = (select auth.uid()) and r.driver_id = driver_profiles.user_id));
alter policy "drivers: onboard self as pending" on public.driver_profiles
  with check (user_id = (select auth.uid()) and status = 'pending' and is_online = false);
drop policy "drivers: admin update" on public.driver_profiles;
alter policy "drivers: update self" on public.driver_profiles
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "locations: self, admin, or my driver on an active ride" on public.driver_locations
  using (driver_id = (select auth.uid()) or (select public.is_admin()) or exists (
    select 1 from public.rides r where r.rider_id = (select auth.uid()) and r.driver_id = driver_locations.driver_id
      and r.status in ('accepted', 'arrived', 'in_progress')));

alter policy "rides: participants or admin" on public.rides
  using (rider_id = (select auth.uid()) or driver_id = (select auth.uid()) or (select public.is_admin()));

alter policy "events: ride participants or admin" on public.ride_events
  using ((select public.is_admin()) or exists (
    select 1 from public.rides r where r.id = ride_events.ride_id and (select auth.uid()) in (r.rider_id, r.driver_id)));

alter policy "offers: own or admin" on public.ride_offers
  using (driver_id = (select auth.uid()) or (select public.is_admin()));

alter policy "ratings: participants or admin" on public.ratings
  using (rater_id = (select auth.uid()) or ratee_id = (select auth.uid()) or (select public.is_admin()));

-- Driver rating lookups.
create index ratings_ratee_idx on public.ratings (ratee_id);
