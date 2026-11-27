-- Cashfree payment gateway migration.
-- This preserves historic Razorpay rows while routing all new paid registrations
-- through Cashfree's order + server-verification flow.

alter table public.event_registrations drop constraint if exists event_registrations_payment_provider_check;
alter table public.event_registrations add constraint event_registrations_payment_provider_check
  check (payment_provider in ('razorpay', 'cashfree', 'manual'));
alter table public.event_registrations add column if not exists cashfree_order_id text unique;
alter table public.event_registrations add column if not exists cashfree_payment_id text unique;

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
  v_code text;
  v_answers jsonb;
  v_id uuid;
begin
  select * into v_e from events where id = p_event for update;
  if not found or v_e.status <> 'published' then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_e.fee <= 0 then raise exception 'FREE_EVENT'; end if;
  if v_e.registration_opens_at is not null and now() < v_e.registration_opens_at then raise exception 'NOT_OPEN_YET'; end if;
  if now() > coalesce(v_e.registration_closes_at, v_e.starts_at) then raise exception 'REGISTRATION_CLOSED'; end if;

  -- Abandoned checkout sessions stop holding a seat after 20 minutes.
  update event_registrations set status = 'cancelled', cancelled_at = now(), admin_note = 'Payment session expired'
    where event_id = p_event and status = 'pending_payment' and payment_provider = 'cashfree'
      and payment_expires_at < now();

  if v_e.capacity is not null and v_e.registered_count >= v_e.capacity then raise exception 'EVENT_FULL'; end if;
  if exists (select 1 from event_registrations r where r.event_id = p_event and r.status <> 'cancelled'
    and (r.email = v_email::citext or (v_uid is not null and r.user_id = v_uid))) then raise exception 'ALREADY_REGISTERED'; end if;
  if p_age is null or p_age < 1 or p_age > 120 then raise exception 'INVALID_AGE'; end if;

  v_answers := clean_event_answers(v_e.form_fields, coalesce(p_answers, '{}'::jsonb));
  v_code := new_event_registration_code();
  insert into event_registrations (event_id, registration_code, user_id, full_name, email, phone, age, answers, status, amount, payment_provider, payment_expires_at)
    values (p_event, v_code, v_uid, btrim(p_full_name), v_email, btrim(p_phone), p_age, v_answers, 'pending_payment', v_e.fee, 'cashfree', now() + interval '20 minutes')
    returning id into v_id;
  return query select v_id, v_code, v_e.fee, v_e.title;
end;
$$;

create or replace function public.attach_cashfree_order(p_registration uuid, p_order_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update event_registrations set cashfree_order_id = p_order_id
    where id = p_registration and status = 'pending_payment' and payment_provider = 'cashfree'
      and payment_expires_at > now() and cashfree_order_id is null;
  if not found then raise exception 'PAYMENT_SESSION_EXPIRED'; end if;
end;
$$;

create or replace function public.confirm_cashfree_event_registration(p_registration uuid, p_order_id text, p_payment_id text)
returns table (registration_code text) language plpgsql security definer set search_path = public as $$
declare v_r event_registrations%rowtype;
begin
  select * into v_r from event_registrations where id = p_registration for update;
  if not found or v_r.status <> 'pending_payment' or v_r.payment_provider <> 'cashfree' then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_r.payment_expires_at < now() then raise exception 'PAYMENT_SESSION_EXPIRED'; end if;
  if v_r.cashfree_order_id is distinct from p_order_id then raise exception 'PAYMENT_ORDER_MISMATCH'; end if;
  update event_registrations set status = 'confirmed', cashfree_payment_id = p_payment_id,
    reviewed_at = now(), payment_expires_at = null where id = v_r.id;
  return query select v_r.registration_code;
end;
$$;

grant execute on function public.begin_cashfree_event_registration(uuid, text, text, text, integer, jsonb) to anon, authenticated;
grant execute on function public.attach_cashfree_order(uuid, text) to anon, authenticated;
grant execute on function public.confirm_cashfree_event_registration(uuid, text, text) to anon, authenticated;
