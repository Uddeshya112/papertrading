-- Migration 009: 28-Course Bilingual Trading Academy & Learning Progress

create table if not exists public.courses (
  id text primary key,
  course_number integer not null unique,
  tier text not null check (tier in ('Beginner', 'Intermediate', 'Technical & Risk', 'Advanced')),
  title_en text not null,
  title_hi text not null,
  summary_en text not null,
  summary_hi text not null,
  prerequisite_ids text[] not null default '{}',
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  lesson_order integer not null,
  content_en text not null,
  content_hi text not null,
  chart_example text not null default '',
  created_at timestamptz not null default now(),
  constraint uq_lessons_course_order unique (course_id, lesson_order)
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references public.courses(id) on delete cascade,
  question_en text not null,
  question_hi text not null,
  options_en jsonb not null,
  options_hi jsonb not null,
  correct_index integer not null check (correct_index >= 0),
  explanation_en text not null,
  explanation_hi text not null
);

create table if not exists public.learning_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  best_quiz_score integer not null default 0 check (best_quiz_score between 0 and 100),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
