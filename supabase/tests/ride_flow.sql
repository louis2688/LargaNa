-- Ride-loop smoke test in pure SQL. Run as postgres in ONE batch (SQL editor, MCP execute_sql, or psql -1).
-- Plays a rider and two drivers by switching to the authenticated role with a fake JWT claim, asserts every
-- step, and removes its fixtures. A failed assert aborts and rolls the whole batch back.
-- Same scenario as packages/core/test/ride-flow.ts, which additionally covers the PostgREST surface.

-- fixtures: three auth users (the profiles trigger fills public.profiles) and two approved go drivers
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'smoke-rider@test.largana.local', '{"provider":"email","providers":["email"]}', '{"role":"rider","full_name":"Test Rider"}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'smoke-driver1@test.largana.local', '{"provider":"email","providers":["email"]}', '{"role":"driver","full_name":"Juan Dela Cruz"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'smoke-driver2@test.largana.local', '{"provider":"email","providers":["email"]}', '{"role":"driver","full_name":"Second Driver"}', now(), now());
insert into public.driver_profiles (user_id, status, tier_id, vehicle_make, vehicle_model, vehicle_color, plate_number) values
  ('00000000-0000-4000-8000-000000000002', 'approved', 'go', 'Toyota', 'Vios', 'Silver', 'ABC 1234'),
  ('00000000-0000-4000-8000-000000000003', 'approved', 'go', 'Toyota', 'Vios', 'White', 'XYZ 5678');

-- rider, nobody online: quotes exist, request dies immediately
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare n int; nb int; r public.rides;
begin
  select count(*), min(nearby) into n, nb from public.fare_quote(10.3111, 123.9186, 10.33, 123.906);
  assert n = 3, 'three tiers quoted, got ' || n;
  assert nb = 0, 'nobody nearby yet';
  r := public.request_ride('go', 10.3111, 123.9186, 'SM City Cebu', 10.33, 123.906, 'IT Park');
  assert r.status = 'no_driver', 'no drivers -> no_driver, got ' || r.status;
end $$;

-- both drivers go online near the pickup, driver 2 a bit further away
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
select public.set_driver_online(true);
select public.update_driver_location(10.3111, 123.9186);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
select public.set_driver_online(true);
select public.update_driver_location(10.3111, 123.9236);

-- rider: quote sees both, request creates offers, a second request is refused
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare q record; r public.rides;
begin
  select * into q from public.fare_quote(10.3111, 123.9186, 10.33, 123.906) where tier_id = 'go';
  assert q.nearby = 2, 'two go drivers nearby, got ' || q.nearby;
  assert q.fare >= 6000 and q.fare % 100 = 0, 'whole-peso fare above the minimum, got ' || q.fare;
  assert q.eta_s >= 60, 'eta from the nearest driver floors at 60 s, got ' || q.eta_s;
  r := public.request_ride('go', 10.3111, 123.9186, 'SM City Cebu', 10.33, 123.906, 'IT Park');
  assert r.status = 'requested', 'ride requested';
  assert r.quoted_fare = q.fare, 'ride carries the quoted fare';
  perform set_config('smoke.ride_id', r.id::text, true);
  begin
    perform public.request_ride('go', 10.3111, 123.9186, 'x', 10.33, 123.906, 'y');
    raise exception 'second request should have failed';
  exception when others then
    if sqlerrm not like '%active ride%' then raise; end if;
  end;
  raise notice 'quote: % m, % s, go = P%, eta % s', q.distance_m, q.duration_s, q.fare / 100, q.eta_s;
end $$;

-- driver 1 sees one pending offer and accepts
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare rid uuid := current_setting('smoke.ride_id')::uuid; n int; r public.rides;
begin
  select count(*) into n from public.ride_offers where ride_id = rid and response = 'pending';
  assert n = 1, 'driver sees exactly one pending offer, got ' || n;
  r := public.accept_ride(rid);
  assert r.status = 'accepted' and r.driver_id = '00000000-0000-4000-8000-000000000002', 'accepted by driver 1';
end $$;

-- driver 2 is too late
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
do $$
declare rid uuid := current_setting('smoke.ride_id')::uuid;
begin
  begin
    perform public.accept_ride(rid);
    raise exception 'late accept should have failed';
  exception when others then
    if sqlerrm not like '%no pending offer%' then raise; end if;
  end;
end $$;

-- rider sees the ride, the driver's plate and live location, nothing else, and cannot edit
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare rid uuid := current_setting('smoke.ride_id')::uuid; s public.ride_status; p text; n int;
begin
  select status into s from public.rides where id = rid;
  assert s = 'accepted', 'rider reads ride status';
  select plate_number into p from public.driver_profiles where user_id = '00000000-0000-4000-8000-000000000002';
  assert p = 'ABC 1234', 'rider reads the assigned driver plate';
  select count(*) into n from public.driver_locations where driver_id = '00000000-0000-4000-8000-000000000002';
  assert n = 1, 'rider reads the assigned driver location';
  select count(*) into n from public.driver_locations where driver_id = '00000000-0000-4000-8000-000000000003';
  assert n = 0, 'rider cannot read other drivers';
  begin
    update public.rides set quoted_fare = 1 where id = rid;
    raise exception 'rider edit should have failed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- driver 1 runs the trip, in order only
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
declare rid uuid := current_setting('smoke.ride_id')::uuid; r public.rides;
begin
  begin
    perform public.advance_ride(rid, 'in_progress');
    raise exception 'skipping arrived should have failed';
  exception when others then
    if sqlerrm not like '%not arrived%' then raise; end if;
  end;
  perform public.advance_ride(rid, 'arrived');
  perform public.advance_ride(rid, 'in_progress');
  r := public.advance_ride(rid, 'completed');
  assert r.status = 'completed' and r.final_fare = r.quoted_fare, 'completed with the upfront fare';
end $$;

-- rider sees the full event trail and rates the driver
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
declare rid uuid := current_setting('smoke.ride_id')::uuid; seq text;
begin
  select string_agg(to_status::text, '>' order by id) into seq from public.ride_events where ride_id = rid;
  assert seq = 'requested>accepted>arrived>in_progress>completed', 'event trail, got ' || seq;
  perform public.rate_ride(rid, 5::smallint);
end $$;

-- rating applied, then clean up
reset role;
do $$
declare rc int; rt numeric;
begin
  select rating_count, rating into rc, rt from public.driver_profiles where user_id = '00000000-0000-4000-8000-000000000002';
  assert rc = 1 and rt = 5, 'driver rating applied';
end $$;
delete from public.rides where rider_id = '00000000-0000-4000-8000-000000000001';
delete from auth.users where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003');
select 'ride flow OK' as result;
