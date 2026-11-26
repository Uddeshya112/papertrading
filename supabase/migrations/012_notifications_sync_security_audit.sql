-- Migration 012: Notifications, Offline Sync Operations, Security Events & Hash-Chained Audit Logs

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dedupe_key text,
  category text not null,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  price_alerts boolean not null default true,
  order_executions boolean not null default true,
  risk_warnings boolean not null default true,
  teacher_feedback boolean not null default true,
  refill_notices boolean not null default true,
  email_digest_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  last_synced_at timestamptz not null default now(),
  constraint uq_sync_device unique (user_id, device_key)
);

create table if not exists public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.sync_devices(id) on delete set null,
  idempotency_key text not null,
  operation_type text not null,
  status text not null default 'APPLIED' check (status in ('PENDING', 'APPLIED', 'CONFLICT', 'REJECTED')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint uq_sync_op_idem unique (user_id, idempotency_key)
);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  label text not null default 'Browser',
  trusted boolean not null default false,
  last_ip inet,
  last_seen_at timestamptz not null default now(),
  constraint uq_user_device_fp unique (user_id, device_fingerprint)
);

create table if not exists public.login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  ip_address inet,
  user_agent text not null default '',
  outcome text not null check (outcome in ('SUCCESS', 'FAILED_PASSWORD', 'MFA_REQUIRED', 'LOCKED_OUT')),
  created_at timestamptz not null default now()
);

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  admin_role public.app_role not null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action_code text not null,
  justification text not null,
  mfa_verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Tamper-evident hash-chained immutable audit log
create table if not exists public.audit_logs (
  seq bigserial primary key,
  id uuid not null default gen_random_uuid() unique,
  user_id uuid references public.profiles(id) on delete set null,
  actor text not null,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  details jsonb not null default '{}'::jsonb,
  prev_hash text not null default 'GENESIS',
  entry_hash text not null,
  created_at timestamptz not null default now()
);
