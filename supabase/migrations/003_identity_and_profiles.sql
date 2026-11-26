-- Migration 003: Identity, Profiles, Preferences, Sessions & RBAC Roles
-- Non-destructive incremental migration preserving 001 and 002.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum (
      'user',
      'analyst',
      'support_admin',
      'security_admin',
      'super_admin',
      'auditor'
    );
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  country text not null default 'IN',
  role public.app_role not null default 'user',
  mfa_enabled boolean not null default false,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  language text not null default 'EN' check (language in ('EN', 'HI')),
  teacher_mode_enabled boolean not null default true,
  confirm_before_order boolean not null default false,
  default_timeframe text not null default '15m',
  chart_theme text not null default 'editorial-light',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  device_label text not null default 'Web Browser',
  ip_address inet,
  user_agent text not null default '',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
