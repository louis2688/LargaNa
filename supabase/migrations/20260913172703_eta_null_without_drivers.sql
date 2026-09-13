-- greatest(60, null) is 60 in Postgres, which turned "no drivers" into a 1-minute ETA. Keep null when nobody is nearby.
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
    select count(*)::integer as nearby,
           case when count(*) = 0 then null else greatest(60, (min(a.distance_m) * 1.3 / 5.56)::integer) end as eta_s
    from public.available_drivers(t.id, r.pickup) a
  ) n on true
  where t.active
  order by t.sort_order;
$$;
