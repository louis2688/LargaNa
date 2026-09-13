-- A driver holding an offer needs the ride's pickup, dropoff and fare before deciding.
alter policy "rides: participants or admin" on public.rides
  using (rider_id = (select auth.uid()) or driver_id = (select auth.uid()) or (select public.is_admin())
    or exists (select 1 from public.ride_offers o where o.ride_id = rides.id and o.driver_id = (select auth.uid())));
