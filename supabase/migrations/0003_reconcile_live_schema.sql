-- Reconcile a Supabase database created from an older/different schema with
-- the columns this app reads and writes (see 0001_init.sql).
--
-- Symptoms this fixes:
--   "Could not find the 'display_name' column of 'profiles'" (sign-in loop),
--   missing projects.name, decisions.summary, summaries.content,
--   proposed_patches.tool, papers stance/doi/..., and the orient_checks table.
--
-- Idempotent: safe to run more than once in the Supabase SQL Editor.
-- It only ADDS columns, backfills them from legacy names, and relaxes NOT NULL
-- on legacy columns the app never writes. It does not drop data.

create extension if not exists "pgcrypto";

-- 0. Legacy CHECK constraints can reject the app's values; drop them up front.
--    The app's own checks are re-added below.
do $$
declare con record;
begin
  for con in
    select n.nspname, t.relname, c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and c.contype = 'c'
      and t.relname in ('profiles','projects','papers','decisions','messages','summaries','proposed_patches')
  loop
    execute format('alter table %I.%I drop constraint %I', con.nspname, con.relname, con.conname);
  end loop;
end $$;

-- 1. profiles ----------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'full_name') then
    update public.profiles set display_name = full_name
      where display_name is null and full_name is not null;
  end if;
end $$;

update public.profiles p
  set email = u.email
  from auth.users u
  where p.id = u.id and p.email is null;

-- 2. projects ----------------------------------------------------------------
alter table public.projects
  add column if not exists name text,
  add column if not exists state jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects'
               and column_name = 'title') then
    update public.projects set name = title where name is null;
  end if;
end $$;

update public.projects set name = 'Untitled project' where name is null;
alter table public.projects alter column name set not null;

-- 3. papers ------------------------------------------------------------------
alter table public.papers
  add column if not exists year int,
  add column if not exists abstract text,
  add column if not exists url text,
  add column if not exists citation_count int,
  add column if not exists stance text not null default 'neutral',
  add column if not exists doi text,
  add column if not exists publication_year int,
  add column if not exists open_access_url text,
  add column if not exists created_at timestamptz not null default now();

alter table public.papers drop constraint if exists papers_stance_check;
alter table public.papers drop constraint if exists papers_source_check;
-- NOT VALID: enforced for new rows; legacy rows are not re-checked.
alter table public.papers
  add constraint papers_stance_check
  check (stance in ('supporting', 'conflicting', 'foundational', 'neutral')) not valid;
alter table public.papers
  add constraint papers_source_check
  check (source in ('semantic_scholar', 'openalex', 'arxiv')) not valid;

update public.papers
  set publication_year = year
  where publication_year is null and year is not null;

do $$
begin
  create unique index if not exists papers_project_source_external_key
    on public.papers (project_id, source, external_id);
exception when unique_violation then
  raise notice 'papers has duplicate (project_id, source, external_id) rows; unique index skipped.';
end $$;

-- 4. decisions ---------------------------------------------------------------
alter table public.decisions
  add column if not exists summary text,
  add column if not exists rationale text,
  add column if not exists created_at timestamptz not null default now();

do $$
declare legacy text;
begin
  foreach legacy in array array['decision', 'text', 'content', 'title'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'decisions'
                 and column_name = legacy) then
      execute format(
        'update public.decisions set summary = %I::text where summary is null',
        legacy);
    end if;
  end loop;
end $$;

update public.decisions set summary = '(no summary)' where summary is null;
alter table public.decisions alter column summary set not null;

-- 5. summaries ---------------------------------------------------------------
alter table public.summaries
  add column if not exists content text,
  add column if not exists message_count_at int,
  add column if not exists created_at timestamptz not null default now();

do $$
declare legacy text;
begin
  foreach legacy in array array['summary', 'text', 'body'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'summaries'
                 and column_name = legacy) then
      execute format(
        'update public.summaries set content = %I::text where content is null',
        legacy);
    end if;
  end loop;
end $$;

update public.summaries set content = '' where content is null;
update public.summaries set message_count_at = 0 where message_count_at is null;
alter table public.summaries alter column content set not null;
alter table public.summaries alter column message_count_at set not null;

-- 6. proposed_patches --------------------------------------------------------
alter table public.proposed_patches
  add column if not exists tool text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now();

do $$
declare legacy text;
begin
  foreach legacy in array array['tool_name', 'kind', 'type'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'proposed_patches'
                 and column_name = legacy) then
      execute format(
        'update public.proposed_patches set tool = %I::text where tool is null',
        legacy);
    end if;
  end loop;
end $$;

alter table public.proposed_patches drop constraint if exists proposed_patches_tool_check;
alter table public.proposed_patches drop constraint if exists proposed_patches_status_check;

-- Unknown legacy patch rows cannot be applied safely; mark them rejected.
update public.proposed_patches
  set tool = 'update_state', status = 'rejected'
  where tool is null
     or tool not in ('update_state', 'add_paper', 'log_decision');
update public.proposed_patches
  set status = 'rejected'
  where status not in ('pending', 'accepted', 'rejected');

alter table public.proposed_patches alter column tool set not null;
alter table public.proposed_patches
  add constraint proposed_patches_tool_check
  check (tool in ('update_state', 'add_paper', 'log_decision'));
alter table public.proposed_patches
  add constraint proposed_patches_status_check
  check (status in ('pending', 'accepted', 'rejected'));

alter table public.messages
  add constraint messages_role_check
  check (role in ('user', 'assistant', 'system')) not valid;

-- 7. orient_checks (new) -----------------------------------------------------
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

-- 8. Relax NOT NULL on legacy columns the app never writes -------------------
-- (e.g. projects.title). Otherwise inserts from the app fail.
do $$
declare
  expected jsonb := '{
    "profiles": ["id","email","display_name","created_at"],
    "projects": ["id","user_id","name","state","created_at","updated_at"],
    "papers": ["id","user_id","project_id","source","external_id","title","authors","year","abstract","url","citation_count","stance","doi","publication_year","open_access_url","created_at"],
    "decisions": ["id","user_id","project_id","summary","rationale","created_at"],
    "messages": ["id","user_id","project_id","role","content","created_at"],
    "summaries": ["id","user_id","project_id","content","message_count_at","created_at"],
    "proposed_patches": ["id","user_id","project_id","tool","payload","status","created_at"]
  }'::jsonb;
  col record;
begin
  for col in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name in (select jsonb_object_keys(expected))
      and c.is_nullable = 'NO'
      and c.column_default is null
      and not (expected -> c.table_name) ? c.column_name
  loop
    execute format('alter table public.%I alter column %I drop not null',
                   col.table_name, col.column_name);
  end loop;
end $$;

-- 9. RLS ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.papers enable row level security;
alter table public.decisions enable row level security;
alter table public.messages enable row level security;
alter table public.summaries enable row level security;
alter table public.proposed_patches enable row level security;
alter table public.orient_checks enable row level security;

drop policy if exists "profiles are self" on public.profiles;
create policy "profiles are self" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "projects are own" on public.projects;
create policy "projects are own" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "papers are own" on public.papers;
create policy "papers are own" on public.papers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "decisions are own" on public.decisions;
create policy "decisions are own" on public.decisions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "messages are own" on public.messages;
create policy "messages are own" on public.messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "summaries are own" on public.summaries;
create policy "summaries are own" on public.summaries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "patches are own" on public.proposed_patches;
create policy "patches are own" on public.proposed_patches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "orient checks are own" on public.orient_checks;
create policy "orient checks are own" on public.orient_checks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10. New-user trigger writes display_name ------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Make PostgREST see the new columns immediately.
notify pgrst, 'reload schema';
