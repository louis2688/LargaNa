-- Demo accounts for development. Password for all three: largana-demo. Never run against production.
-- Idempotent: safe to re-run. The four token columns must be '' (not null) or GoTrue fails the login query.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rider@largana.demo', extensions.crypt('largana-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"rider","full_name":"Demo Rider"}', now(), now(), '', '', '', ''),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'driver@largana.demo', extensions.crypt('largana-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"driver","full_name":"Juan Dela Cruz"}', now(), now(), '', '', '', ''),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'admin@largana.demo', extensions.crypt('largana-demo', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"role":"rider","full_name":"Demo Admin"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select id, id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), now(), now(), now()
from auth.users where email like '%@largana.demo'
on conflict (provider_id, provider) do nothing;

update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000003';

insert into public.driver_profiles (user_id, status, tier_id, vehicle_make, vehicle_model, vehicle_color, plate_number)
values ('10000000-0000-4000-8000-000000000002', 'approved', 'go', 'Toyota', 'Vios', 'Silver', 'ABC 1234')
on conflict (user_id) do nothing;
