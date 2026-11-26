-- Migration 011: AI Trading Teacher, Weakness Profiles, Challenges, Achievements & Report Jobs

create table if not exists public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  period_type text not null check (period_type in ('DAILY', 'WEEKLY', 'MONTHLY', 'ON_DEMAND')),
  overall_score integer not null check (overall_score between 0 and 100),
  discipline_score integer not null check (discipline_score between 0 and 100),
  improvement_score integer not null check (improvement_score between 0 and 100),
  grade text not null,
  summary text not null,
  homework jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.detected_mistakes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references public.teacher_reviews(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  journal_id uuid references public.trade_journals(id) on delete set null,
  mistake_code text not null,
  severity text not null check (severity in ('CRITICAL', 'WARNING', 'COACHING')),
  title text not null,
  eight_point_analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.weakness_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  top_weaknesses jsonb not null default '[]'::jsonb,
  mistake_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id text primary key,
  title text not null,
  focus_area text not null,
  xp_reward integer not null check (xp_reward > 0),
  target_count integer not null check (target_count > 0)
);

create table if not exists public.challenge_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  current_count integer not null default 0 check (current_count >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_code text not null,
  awarded_at timestamptz not null default now(),
  constraint uq_user_badge unique (user_id, badge_code)
);

create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  report_kind text not null,
  export_format text not null check (export_format in ('PDF', 'CSV', 'XLS', 'HTML')),
  status text not null default 'QUEUED' check (status in ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  date_from date,
  date_to date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.report_jobs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  sha256_checksum text not null,
  created_at timestamptz not null default now()
);
