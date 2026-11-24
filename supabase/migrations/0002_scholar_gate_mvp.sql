-- Scholar-Gate MVP upgrade for databases created from the original 0001_init.sql.
-- Idempotent: safe to run more than once in the Supabase SQL Editor.

-- 1. Paper metadata + stance -------------------------------------------------
alter table public.papers
  add column if not exists stance text not null default 'neutral',
  add column if not exists doi text,
  add column if not exists publication_year int,
  add column if not exists open_access_url text;

alter table public.papers drop constraint if exists papers_stance_check;
alter table public.papers
  add constraint papers_stance_check
  check (stance in ('supporting', 'conflicting', 'foundational', 'neutral'));

update public.papers
  set publication_year = year
  where publication_year is null and year is not null;

-- 2. Orient comprehension checks ---------------------------------------------
create table if not exists public.orient_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  questions_json jsonb not null default '[]'::jsonb,
  student_answers_json jsonb not null default '[]'::jsonb,
  score numeric(5, 2) not null default 0 check (score >= 0 and score <= 100),
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists orient_checks_project_idx
  on public.orient_checks (project_id, created_at desc);

alter table public.orient_checks enable row level security;

drop policy if exists "orient checks are own" on public.orient_checks;
create policy "orient checks are own"
  on public.orient_checks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
