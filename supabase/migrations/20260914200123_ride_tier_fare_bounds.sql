-- Fat-finger guard on the fare table: no negative fares, no single component above P1,000.
-- ponytail: flat cap; raise it in a migration if a tier ever legitimately needs more.
alter table public.ride_tiers add constraint ride_tiers_fare_bounds check (
  base_fare between 0 and 100000 and per_km between 0 and 100000
  and per_min between 0 and 100000 and min_fare between 0 and 100000
);
