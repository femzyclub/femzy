-- Cashfree payment hardening. This migration is forward-only and is safe both
-- before and after 006_cashfree_payments.sql: it creates the Cashfree columns
-- and functions when missing, then replaces the function privileges explicitly.

alter table public.event_registrations add column if not exists cashfree_order_id text unique;
alter table public.event_registrations add column if not exists cashfree_payment_id text unique;
alter table public.event_registrations drop constraint if exists event_registrations_payment_provider_check;
alter table public.event_registrations add constraint event_registrations_payment_provider_check
  check (payment_provider in ('razorpay', 'cashfree', 'manual'));

-- The old function grants EXECUTE to the browser roles. Its replacement has a
-- fourth amount argument and may only be called with the service-role key.
drop function if exists public.confirm_cashfree_event_registration(uuid, text, text);
-- An earlier draft created the 4-argument version with a differently named
-- amount parameter (p_amount_paid). Postgres cannot rename parameters in place.
drop function if exists public.confirm_cashfree_event_registration(uuid, text, text, numeric);

-- Public: reserve a paid-event seat. Validation matches event_registrations.
create or replace function public.begin_cashfree_event_registration(
  p_event uuid, p_full_name text, p_email text, p_phone text, p_age integer,
  p_answers jsonb default '{}'::jsonb
)
returns table (registration_id uuid, registration_code text, amount int, event_title text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_e events%rowtype;
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_code text;
  v_answers jsonb;
  v_id uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 100 then raise exception 'INVALID_NAME'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 200 then raise exception 'INVALID_EMAIL'; end if;
  if v_phone !~ '^\+?[0-9][0-9 -]{6,19}$' then raise exception 'INVALID_PHONE'; end if;
  if p_age is null or p_age < 1 or p_age > 120 then raise exception 'INVALID_AGE'; end if;

  -- Every state-changing payment function locks the event first. This matches
  -- the expiry sweep below and prevents event/registration lock-order deadlocks.
  select * into v_e from events where id = p_event for update;
  if not found or v_e.status <> 'published' then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_e.fee <= 0 then raise exception 'FREE_EVENT'; end if;
  if v_e.registration_opens_at is not null and now() < v_e.registration_opens_at then raise exception 'NOT_OPEN_YET'; end if;
  if now() > coalesce(v_e.registration_closes_at, v_e.starts_at) then raise exception 'REGISTRATION_CLOSED'; end if;

  update event_registrations set status = 'cancelled', cancelled_at = now(), admin_note = 'Payment session expired'
    where event_id = p_event and status = 'pending_payment' and payment_provider = 'cashfree'
      and payment_expires_at < now();

  if v_e.capacity is not null and v_e.registered_count >= v_e.capacity then raise exception 'EVENT_FULL'; end if;
  if exists (select 1 from event_registrations r where r.event_id = p_event and r.status <> 'cancelled'
    and (r.email = v_email::citext or (v_uid is not null and r.user_id = v_uid))) then raise exception 'ALREADY_REGISTERED'; end if;

  v_answers := clean_event_answers(v_e.form_fields, coalesce(p_answers, '{}'::jsonb));
  v_code := new_event_registration_code();
  insert into event_registrations (event_id, registration_code, user_id, full_name, email, phone, age, answers, status, amount, payment_provider, payment_expires_at)
    values (p_event, v_code, v_uid, v_name, v_email, v_phone, p_age, v_answers, 'pending_payment', v_e.fee, 'cashfree', now() + interval '20 minutes')
    returning id into v_id;
  return query select v_id, v_code, v_e.fee, v_e.title;
end;
$$;

-- Service-role-only: persist the gateway order. Repeating the same attachment
-- is harmless; a different order ID is an integrity failure, not an expiry.
create or replace function public.attach_cashfree_order(p_registration uuid, p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_registration event_registrations%rowtype;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{3,45}$' then raise exception 'INVALID_ORDER_ID'; end if;
  select event_id into v_event_id from event_registrations where id = p_registration;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  perform 1 from events where id = v_event_id for update;
  select * into v_registration from event_registrations where id = p_registration for update;
  if v_registration.payment_provider <> 'cashfree' or v_registration.status <> 'pending_payment' or v_registration.payment_expires_at <= now() then
    raise exception 'PAYMENT_SESSION_EXPIRED';
  end if;
  if v_registration.cashfree_order_id is not null and v_registration.cashfree_order_id <> p_order_id then raise exception 'ORDER_ALREADY_ATTACHED'; end if;
  if v_registration.cashfree_order_id is null then
    update event_registrations set cashfree_order_id = p_order_id where id = p_registration;
  end if;
end;
$$;

-- Service-role-only. p_order_amount is Cashfree's verified order_amount, not
-- payment_amount: Cashfree documents that a customer payment can include a fee.
create or replace function public.confirm_cashfree_event_registration(
  p_registration uuid, p_order_id text, p_payment_id text, p_order_amount numeric
)
returns table (registration_code text) language plpgsql security definer set search_path = public as $$
declare
  v_event_id uuid;
  v_e events%rowtype;
  v_r event_registrations%rowtype;
begin
  if p_order_id is null or p_order_id !~ '^[A-Za-z0-9_-]{3,45}$' then raise exception 'INVALID_ORDER_ID'; end if;
  if p_payment_id is null or btrim(p_payment_id) = '' then raise exception 'INVALID_PAYMENT_ID'; end if;
  if p_order_amount is null or p_order_amount <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;

  select event_id into v_event_id from event_registrations where id = p_registration;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  select * into v_e from events where id = v_event_id for update;
  select * into v_r from event_registrations where id = p_registration for update;
  if v_r.payment_provider <> 'cashfree' then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_r.cashfree_order_id is distinct from p_order_id then raise exception 'PAYMENT_ORDER_MISMATCH'; end if;
  if v_r.amount::numeric is distinct from p_order_amount then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;

  if v_r.status = 'confirmed' then
    if v_r.cashfree_payment_id is not distinct from p_payment_id then
      return query select v_r.registration_code;
      return;
    end if;
    raise exception 'ALREADY_CONFIRMED_WITH_DIFFERENT_PAYMENT';
  end if;

  if v_r.status = 'pending_payment' then
    update event_registrations set status = 'confirmed', cashfree_payment_id = p_payment_id,
      reviewed_at = now(), payment_expires_at = null where id = v_r.id;
  elsif v_r.status = 'cancelled' and v_r.admin_note = 'Payment session expired' then
    if v_e.capacity is not null and v_e.registered_count >= v_e.capacity then raise exception 'LATE_PAYMENT_NO_SEAT'; end if;
    if exists (select 1 from event_registrations r where r.event_id = v_r.event_id and r.id <> v_r.id and r.status <> 'cancelled'
      and (r.email = v_r.email or (v_r.user_id is not null and r.user_id = v_r.user_id))) then raise exception 'LATE_PAYMENT_DUPLICATE'; end if;
    update event_registrations set status = 'confirmed', cancelled_at = null, admin_note = null,
      cashfree_payment_id = p_payment_id, reviewed_at = now(), payment_expires_at = null where id = v_r.id;
  else
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  return query select v_r.registration_code;
end;
$$;

-- Service-role-only: terminal Cashfree failures free a reservation immediately.
create or replace function public.cancel_cashfree_registration(p_registration uuid, p_reason text default 'Payment failed')
returns void language plpgsql security definer set search_path = public as $$
declare v_event_id uuid;
begin
  select event_id into v_event_id from event_registrations where id = p_registration;
  if not found then return; end if;
  perform 1 from events where id = v_event_id for update;
  update event_registrations set status = 'cancelled', cancelled_at = now(), payment_expires_at = null,
    admin_note = left(nullif(btrim(coalesce(p_reason, '')), ''), 200)
    where id = p_registration and status = 'pending_payment' and payment_provider = 'cashfree';
end;
$$;

-- Explicitly replace PostgreSQL's default PUBLIC function grants.
revoke execute on function public.begin_cashfree_event_registration(uuid, text, text, text, integer, jsonb) from public;
grant execute on function public.begin_cashfree_event_registration(uuid, text, text, text, integer, jsonb) to anon, authenticated;

revoke execute on function public.attach_cashfree_order(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_cashfree_order(uuid, text) to service_role;
revoke execute on function public.confirm_cashfree_event_registration(uuid, text, text, numeric) from public, anon, authenticated;
grant execute on function public.confirm_cashfree_event_registration(uuid, text, text, numeric) to service_role;
revoke execute on function public.cancel_cashfree_registration(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_cashfree_registration(uuid, text) to service_role;

-- Razorpay is no longer integrated. Prevent legacy direct-RPC calls from
-- holding seats, attaching arbitrary orders, or confirming a payment.
-- These functions may not exist in every database, so each step is skipped
-- when its function is missing.
do $$
begin
  if to_regprocedure('public.begin_razorpay_event_registration(uuid, text, text, text, integer, jsonb)') is not null then
    revoke execute on function public.begin_razorpay_event_registration(uuid, text, text, text, integer, jsonb) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.attach_razorpay_order(uuid, text)') is not null then
    revoke execute on function public.attach_razorpay_order(uuid, text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.confirm_razorpay_event_registration(uuid, text, text)') is not null then
    revoke execute on function public.confirm_razorpay_event_registration(uuid, text, text) from public, anon, authenticated;
  end if;

  -- These admin functions enforce is_admin() internally; preserve authenticated
  -- access for the existing admin server actions, but remove default PUBLIC use.
  if to_regprocedure('public.admin_review_event_payment(uuid, boolean, text)') is not null then
    revoke execute on function public.admin_review_event_payment(uuid, boolean, text) from public, anon;
    grant execute on function public.admin_review_event_payment(uuid, boolean, text) to authenticated;
  end if;
  if to_regprocedure('public.admin_add_event_registration(uuid, text, text, text, integer, text)') is not null then
    revoke execute on function public.admin_add_event_registration(uuid, text, text, text, integer, text) from public, anon;
    grant execute on function public.admin_add_event_registration(uuid, text, text, text, integer, text) to authenticated;
  end if;
  if to_regprocedure('public.admin_cancel_event_registration(uuid, text)') is not null then
    revoke execute on function public.admin_cancel_event_registration(uuid, text) from public, anon;
    grant execute on function public.admin_cancel_event_registration(uuid, text) to authenticated;
  end if;
end $$;
