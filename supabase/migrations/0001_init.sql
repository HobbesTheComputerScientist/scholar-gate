-- Research Coach MVP schema. Apply with the Supabase CLI or SQL editor.
-- RLS: every table is scoped to auth.uid() = user_id.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  source text not null check (source in ('semantic_scholar', 'openalex', 'arxiv')),
  external_id text not null,
  title text not null,
  authors jsonb not null default '[]'::jsonb,
  year int,
  abstract text,
  url text,
  citation_count int,
  created_at timestamptz not null default now(),
  unique (project_id, source, external_id)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  summary text not null,
  rationale text,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  content text not null,
  message_count_at int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.proposed_patches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  tool text not null check (tool in ('update_state', 'add_paper', 'log_decision')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects (user_id);
create index if not exists papers_project_id_idx on public.papers (project_id);
create index if not exists messages_project_id_idx on public.messages (project_id, created_at);
create index if not exists patches_project_pending_idx
  on public.proposed_patches (project_id)
  where status = 'pending';

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.papers enable row level security;
alter table public.decisions enable row level security;
alter table public.messages enable row level security;
alter table public.summaries enable row level security;
alter table public.proposed_patches enable row level security;

create policy "profiles are self"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "projects are own"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "papers are own"
  on public.papers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "decisions are own"
  on public.decisions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "messages are own"
  on public.messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "summaries are own"
  on public.summaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "patches are own"
  on public.proposed_patches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.touch_project_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.touch_project_updated_at();
