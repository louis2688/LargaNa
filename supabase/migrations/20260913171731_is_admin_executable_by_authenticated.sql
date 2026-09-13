-- RLS policies call is_admin() as the querying role, so signed-in users must be able to execute it.
-- It only reports on the caller, so exposing it is harmless.
grant execute on function public.is_admin() to authenticated;
