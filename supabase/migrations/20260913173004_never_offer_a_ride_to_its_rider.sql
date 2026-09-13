-- A user who is both rider and driver must never be dispatched their own request.
create or replace function public.request_ride(tier_id text, pickup_lat double precision, pickup_lng double precision,
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

  -- Dispatch: offer to the nearest 5 (never the rider themselves); first accept_ride() wins.
  insert into public.ride_offers (ride_id, driver_id, expires_at)
  select ride.id, a.driver_id, now() + interval '30 seconds'
  from public.available_drivers(t.id, p) a
  where a.driver_id <> rider
  limit 5;
  get diagnostics offers = row_count;
  if offers = 0 then
    update public.rides x set status = 'no_driver' where x.id = ride.id returning * into ride;
  end if;
  return ride;
end $$;
