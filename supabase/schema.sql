-- =====================================================================
-- FEMZY — EVENTS PLATFORM BASE SCHEMA (Supabase / Postgres)
-- Run this first in the Supabase SQL editor, then run
-- supabase/migrations/004_events.sql.
--
-- This intentionally contains only the shared pieces required by the
-- events platform: member profiles, admin access and an audit log.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$ begin
  create type public.user_role as enum ('participant', 'admin');
exception when duplicate_object then null; end $$;

-- A lightweight profile is created automatically for every Supabase Auth user.
-- It is only used for admin access and linking an optional logged-in attendee
-- to their registration; guests can still register without an account.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'Member' check (char_length(full_name) between 1 and 100),
  email citext unique,
  role public.user_role not null default 'participant',
  created_at timestamptz not null default now()
);

create table if not exists public.admin_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  affected_user_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_logs_created_at_idx on public.admin_logs (created_at desc);

-- Used by event row-level security policies and database functions.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Keep the profile table in sync with Supabase Auth, including Google sign-in.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Member'
  );

  insert into public.profiles (id, full_name, email)
  values (new.id, left(v_name, 100), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.admin_logs enable row level security;

drop policy if exists "members read own profile" on public.profiles;
create policy "members read own profile" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "admins read audit log" on public.admin_logs;
create policy "admins read audit log" on public.admin_logs for select
  using (public.is_admin());
