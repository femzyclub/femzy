-- =====================================================================
-- FEM RISE CLUB — EVENTS (listing, registration, calendar, admin)
-- Run this once in the Supabase SQL editor AFTER schema.sql.
-- Safe to run on the live database: it only adds new tables, functions,
-- policies and storage buckets. Nothing existing is changed.
--
-- Golden rule (same as the challenge): visitors never write registrations
-- directly. Registering, approving payments, adding and removing people
-- all happen inside SECURITY DEFINER functions that lock the event row,
-- so capacity can never be exceeded — even with many people registering
-- at the same second.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type public.event_status as enum ('draft', 'published', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  -- pending_payment = paid event, UPI proof submitted, waiting for an admin to verify (the seat is held)
  create type public.event_registration_status as enum ('pending_payment', 'confirmed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------- EVENTS ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 3 and 120),
  summary text not null default '' check (char_length(summary) <= 280),
  description text not null default '',
  category text not null default 'Meetup'
    check (category in ('Sports', 'Tournament', 'Workshop', 'Wellness', 'Meetup', 'Webinar', 'Other')),
  cover_path text, -- file in the public "event-covers" bucket
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Asia/Kolkata',
  venue text,
  location text, -- address / area / city
  map_url text check (map_url is null or map_url ~* '^https?://'),
  is_online boolean not null default false,
  fee int not null default 0 check (fee >= 0 and fee <= 100000), -- in rupees, 0 = free
  capacity int check (capacity is null or capacity between 1 and 100000), -- null = unlimited
  registered_count int not null default 0, -- confirmed + pending payment (kept in sync by a trigger)
  registration_opens_at timestamptz, -- null = open as soon as published
  registration_closes_at timestamptz, -- null = closes when the event starts
  status public.event_status not null default 'draft',
  is_featured boolean not null default false,
  agenda jsonb not null default '[]'::jsonb check (jsonb_typeof(agenda) = 'array'),
  organizer_name text,
  organizer_email text,
  organizer_phone text,
  -- Custom registration questions: [{ "id": "tshirt", "label": "T-shirt size", "type": "select", "required": true, "options": ["S","M"] }]
  form_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(form_fields) = 'array'),
  published_at timestamptz,
  cancelled_at timestamptz,
  cancellation_note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (registration_opens_at is null or registration_closes_at is null or registration_closes_at > registration_opens_at)
);
create index if not exists events_status_starts_idx on public.events (status, starts_at);

-- ---------- REGISTRATIONS (private — only the person and admins can read) ----------
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  registration_code text not null unique,
  user_id uuid references public.profiles (id) on delete set null, -- null for guest registrations
  full_name text not null check (char_length(full_name) between 2 and 100),
  email citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  phone text not null check (phone ~ '^\+?[0-9][0-9 -]{6,19}$'),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  status public.event_registration_status not null,
  amount int not null default 0, -- rupees
  utr text, -- UPI transaction ID for paid events
  proof_path text, -- screenshot in the private "event-payment-proofs" bucket
  admin_note text,
  source text not null default 'web' check (source in ('web', 'admin')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id, status, created_at desc);
-- One active registration per email / account per event. Cancelled ones don't block re-registering.
create unique index if not exists event_registrations_email_unique
  on public.event_registrations (event_id, email) where status <> 'cancelled';
create unique index if not exists event_registrations_user_unique
  on public.event_registrations (event_id, user_id) where user_id is not null and status <> 'cancelled';
create unique index if not exists event_registrations_utr_unique
  on public.event_registrations (upper(utr)) where utr is not null and status <> 'cancelled';

-- =====================================================================
-- TRIGGERS
-- =====================================================================

-- Keep events.registered_count = confirmed + pending payment.
create or replace function public.sync_event_registered_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event uuid := coalesce(new.event_id, old.event_id);
begin
  update events set registered_count = (
    select count(*) from event_registrations where event_id = v_event and status in ('confirmed', 'pending_payment')
  ) where id = v_event;
  if tg_op = 'UPDATE' and old.event_id <> new.event_id then
    update events set registered_count = (
      select count(*) from event_registrations where event_id = old.event_id and status in ('confirmed', 'pending_payment')
    ) where id = old.event_id;
  end if;
  return null;
end;
$$;
drop trigger if exists sync_event_registered_count on public.event_registrations;
create trigger sync_event_registered_count after insert or update or delete on public.event_registrations
  for each row execute function public.sync_event_registered_count();

create or replace function public.touch_event_registration()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_event_registration on public.event_registrations;
create trigger touch_event_registration before update on public.event_registrations
  for each row execute function public.touch_event_registration();

-- updated_at, published_at / cancelled_at stamps, and an admin log for every change an admin makes.
create or replace function public.log_event_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' then new.published_at := coalesce(new.published_at, now()); end if;
    if auth.uid() is not null then
      new.created_by := coalesce(new.created_by, auth.uid());
      insert into admin_logs (admin_id, action, details)
        values (auth.uid(), 'Created event', jsonb_build_object('event', new.slug, 'status', new.status));
    end if;
    return new;
  end if;

  new.updated_at := now();
  if new.status = 'published' and old.status <> 'published' then new.published_at := coalesce(new.published_at, now()); end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then new.cancelled_at := now(); end if;
  if new.status <> 'cancelled' then new.cancelled_at := null; end if;
  -- Only log real edits (not the registered_count sync).
  if auth.uid() is not null and (to_jsonb(new) - 'registered_count' - 'updated_at') <> (to_jsonb(old) - 'registered_count' - 'updated_at') then
    insert into admin_logs (admin_id, action, details)
      values (auth.uid(),
              case when new.status <> old.status then 'Changed event status to ' || new.status::text else 'Edited event' end,
              jsonb_build_object('event', new.slug));
  end if;
  return new;
end;
$$;
drop trigger if exists log_event_change on public.events;
create trigger log_event_change before insert or update on public.events
  for each row execute function public.log_event_change();

create or replace function public.log_event_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into admin_logs (admin_id, action, details)
      values (auth.uid(), 'Deleted event', jsonb_build_object('event', old.slug, 'registrations', old.registered_count));
  end if;
  return old;
end;
$$;
drop trigger if exists log_event_delete on public.events;
create trigger log_event_delete before delete on public.events
  for each row execute function public.log_event_delete();

-- =====================================================================
-- HELPERS
-- =====================================================================

-- Random, readable registration ID like FRE-7K2Q9XMD (no 0/O/1/I to avoid confusion).
create or replace function public.new_event_registration_code()
returns text language plpgsql set search_path = public as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text;
  i int;
begin
  loop
    v_bytes := gen_random_bytes(8);
    v_code := 'FRE-';
    for i in 0 .. 7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from event_registrations where registration_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Keep only answers to questions the event actually asks, and enforce required ones.
create or replace function public.clean_event_answers(p_fields jsonb, p_answers jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_field jsonb;
  v_id text;
  v_val text;
  v_out jsonb := '{}'::jsonb;
begin
  for v_field in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    v_id := v_field ->> 'id';
    continue when v_id is null;
    v_val := nullif(btrim(coalesce(p_answers ->> v_id, '')), '');
    if v_val is null and coalesce((v_field ->> 'required')::boolean, false) then
      raise exception 'MISSING_FIELD:%', coalesce(v_field ->> 'label', v_id);
    end if;
    if v_val is not null then
      v_out := v_out || jsonb_build_object(v_id, left(v_val, 1000));
    end if;
  end loop;
  return v_out;
end;
$$;

-- =====================================================================
-- PUBLIC: REGISTER FOR AN EVENT (guests and signed-in members)
-- =====================================================================
create or replace function public.register_for_event(
  p_event uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_answers jsonb default '{}'::jsonb,
  p_utr text default null,
  p_proof_path text default null
)
returns table (registration_code text, status public.event_registration_status)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_e events%rowtype;
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_utr text := nullif(upper(regexp_replace(coalesce(p_utr, ''), '\s', '', 'g')), '');
  v_status event_registration_status;
  v_code text;
  v_answers jsonb;
begin
  -- Lock the event row: every registration for this event queues here, so the seat count is always exact.
  select * into v_e from events where id = p_event for update;
  if not found or v_e.status = 'draft' then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_e.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if v_e.registration_opens_at is not null and now() < v_e.registration_opens_at then raise exception 'NOT_OPEN_YET'; end if;
  if now() > coalesce(v_e.registration_closes_at, v_e.starts_at) then raise exception 'REGISTRATION_CLOSED'; end if;
  if v_e.capacity is not null and v_e.registered_count >= v_e.capacity then raise exception 'EVENT_FULL'; end if;

  if exists (
    select 1 from event_registrations r
    where r.event_id = p_event and r.status <> 'cancelled'
      and (r.email = v_email::citext or (v_uid is not null and r.user_id = v_uid))
  ) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  v_answers := clean_event_answers(v_e.form_fields, coalesce(p_answers, '{}'::jsonb));

  if v_e.fee > 0 then
    if v_utr is null or v_utr !~ '^[A-Z0-9]{10,22}$' then raise exception 'INVALID_UTR'; end if;
    if p_proof_path is null or p_proof_path !~ ('^' || p_event::text || '/[A-Za-z0-9._-]{1,120}$') then
      raise exception 'MISSING_PROOF';
    end if;
    if exists (select 1 from event_registrations r where upper(r.utr) = v_utr and r.status <> 'cancelled')
       or exists (select 1 from payments p where upper(p.utr) = v_utr and p.status <> 'rejected') then
      raise exception 'UTR_USED';
    end if;
    v_status := 'pending_payment';
  else
    v_utr := null;
    v_status := 'confirmed';
  end if;

  v_code := new_event_registration_code();
  insert into event_registrations (event_id, registration_code, user_id, full_name, email, phone, answers, status, amount, utr, proof_path)
  values (p_event, v_code, v_uid, btrim(p_full_name), v_email, btrim(p_phone), v_answers, v_status, v_e.fee, v_utr,
          case when v_e.fee > 0 then p_proof_path end);

  if v_status = 'pending_payment' then
    perform notify_admins('event_payment', 'New event payment to verify', v_e.title || ' · UTR ' || v_utr);
  end if;

  return query select v_code, v_status;
end;
$$;

-- =====================================================================
-- ADMIN ACTIONS (every action is written to admin_logs)
-- =====================================================================

-- Approve / reject a pending UPI payment. Rejecting frees the seat.
create or replace function public.admin_review_event_payment(p_registration uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_r event_registrations%rowtype;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into v_r from event_registrations where id = p_registration for update;
  if not found then raise exception 'Registration not found'; end if;
  if v_r.status <> 'pending_payment' then raise exception 'This payment was already reviewed'; end if;

  update event_registrations set
    status = case when p_approve then 'confirmed' else 'cancelled' end::event_registration_status,
    admin_note = coalesce(p_note, admin_note),
    reviewed_by = auth.uid(), reviewed_at = now(),
    cancelled_at = case when p_approve then null else now() end
  where id = p_registration;

  insert into admin_logs (admin_id, action, affected_user_id, details)
    values (auth.uid(), case when p_approve then 'Approved event payment' else 'Rejected event payment' end, v_r.user_id,
            jsonb_build_object('registration', v_r.registration_code, 'note', p_note));
end;
$$;

-- Manually add someone (e.g. paid in cash at the desk). Respects capacity; ignores the registration window.
create or replace function public.admin_add_event_registration(
  p_event uuid, p_full_name text, p_email text, p_phone text, p_note text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_e events%rowtype;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into v_e from events where id = p_event for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_e.capacity is not null and v_e.registered_count >= v_e.capacity then raise exception 'EVENT_FULL'; end if;
  if exists (select 1 from event_registrations where event_id = p_event and status <> 'cancelled' and email = v_email::citext) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  v_code := new_event_registration_code();
  insert into event_registrations (event_id, registration_code, full_name, email, phone, status, amount, admin_note, source, reviewed_by, reviewed_at)
  values (p_event, v_code, btrim(p_full_name), v_email, btrim(p_phone), 'confirmed', v_e.fee, p_note, 'admin', auth.uid(), now());

  insert into admin_logs (admin_id, action, details)
    values (auth.uid(), 'Added event registration manually', jsonb_build_object('event', v_e.slug, 'registration', v_code));
  return v_code;
end;
$$;

-- Remove someone from an event (kept on record as "cancelled", seat is freed).
create or replace function public.admin_cancel_event_registration(p_registration uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_r event_registrations%rowtype;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update event_registrations set status = 'cancelled', cancelled_at = now(), admin_note = coalesce(p_note, admin_note),
    reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_registration and status <> 'cancelled'
  returning * into v_r;
  if not found then return; end if;
  insert into admin_logs (admin_id, action, affected_user_id, details)
    values (auth.uid(), 'Removed event registration', v_r.user_id,
            jsonb_build_object('registration', v_r.registration_code, 'note', p_note));
end;
$$;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;

drop policy if exists "events readable" on public.events;
create policy "events readable" on public.events for select
  using (status in ('published', 'cancelled') or is_admin());
drop policy if exists "admin inserts events" on public.events;
create policy "admin inserts events" on public.events for insert with check (is_admin());
drop policy if exists "admin updates events" on public.events;
create policy "admin updates events" on public.events for update using (is_admin()) with check (is_admin());
drop policy if exists "admin deletes events" on public.events;
create policy "admin deletes events" on public.events for delete using (is_admin());

-- Registrations: nobody can insert/update directly — only through the functions above.
drop policy if exists "own event registrations" on public.event_registrations;
create policy "own event registrations" on public.event_registrations for select
  using ((user_id is not null and user_id = auth.uid()) or is_admin());

revoke all on function public.sync_event_registered_count() from public, anon, authenticated;
revoke all on function public.new_event_registration_code() from public, anon, authenticated;
grant execute on function public.register_for_event(uuid, text, text, text, jsonb, text, text) to anon, authenticated;
revoke execute on function public.admin_review_event_payment(uuid, boolean, text) from anon;
revoke execute on function public.admin_add_event_registration(uuid, text, text, text, text) from anon;
revoke execute on function public.admin_cancel_event_registration(uuid, text) from anon;

-- =====================================================================
-- STORAGE
--   event-covers          public  · posters / banners · admins upload
--   event-payment-proofs  private · UPI screenshots   · anyone can upload into a
--                                   published paid event's folder, only admins can view
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-covers', 'event-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-payment-proofs', 'event-payment-proofs', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin uploads event covers" on storage.objects;
create policy "admin uploads event covers" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and public.is_admin());
drop policy if exists "admin updates event covers" on storage.objects;
create policy "admin updates event covers" on storage.objects for update to authenticated
  using (bucket_id = 'event-covers' and public.is_admin());
drop policy if exists "admin deletes event covers" on storage.objects;
create policy "admin deletes event covers" on storage.objects for delete to authenticated
  using (bucket_id = 'event-covers' and public.is_admin());

drop policy if exists "upload event payment proof" on storage.objects;
create policy "upload event payment proof" on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'event-payment-proofs'
    and exists (
      select 1 from public.events e
      where e.id::text = (storage.foldername(name))[1] and e.status = 'published' and e.fee > 0
    )
  );
drop policy if exists "admin views event payment proofs" on storage.objects;
create policy "admin views event payment proofs" on storage.objects for select to authenticated
  using (bucket_id = 'event-payment-proofs' and public.is_admin());
