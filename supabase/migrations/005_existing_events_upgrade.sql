-- Run this only when 004_events.sql was executed before the current
-- guest-registration + Razorpay version. Run this first, then re-run
-- 004_events.sql to replace the database functions and policies.

alter table public.event_registrations add column if not exists age smallint;
update public.event_registrations set age = 18 where age is null;
alter table public.event_registrations alter column age set not null;
alter table public.event_registrations drop constraint if exists event_registrations_age_check;
alter table public.event_registrations add constraint event_registrations_age_check check (age between 1 and 120);

alter table public.event_registrations add column if not exists payment_provider text not null default 'razorpay';
alter table public.event_registrations drop constraint if exists event_registrations_payment_provider_check;
alter table public.event_registrations add constraint event_registrations_payment_provider_check check (payment_provider in ('razorpay', 'manual'));
alter table public.event_registrations add column if not exists razorpay_order_id text unique;
alter table public.event_registrations add column if not exists razorpay_payment_id text unique;
alter table public.event_registrations add column if not exists payment_expires_at timestamptz;

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select on public.event_registrations to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
