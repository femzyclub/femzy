-- The payment server code uses the Supabase secret (service-role) key to read
-- registrations and write the refund-review log. Make sure that role has table
-- access. Safe to run more than once.
grant usage on schema public to service_role;
grant select, insert, update on public.event_registrations to service_role;
grant select, update on public.events to service_role;
grant select, insert on public.admin_logs to service_role;
grant usage, select on all sequences in schema public to service_role;
