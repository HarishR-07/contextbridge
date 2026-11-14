-- Run this in the Supabase SQL editor. Row Level Security is the ownership boundary.
create table if not exists public.saved_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saved_projects enable row level security;
revoke all on public.saved_projects from anon;
grant select, insert, update, delete on public.saved_projects to authenticated;

drop policy if exists "Users manage only their own project states" on public.saved_projects;
create policy "Users manage only their own project states" on public.saved_projects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists saved_projects_user_updated_idx on public.saved_projects(user_id, updated_at desc);

-- Cloud snapshots are append-only versions so users can compare and restore prior saves.
create table if not exists public.saved_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.saved_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.saved_project_versions enable row level security;
revoke all on public.saved_project_versions from anon;
grant select, insert on public.saved_project_versions to authenticated;

drop policy if exists "Users read only their own project versions" on public.saved_project_versions;
create policy "Users read only their own project versions" on public.saved_project_versions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users create only their own project versions" on public.saved_project_versions;
create policy "Users create only their own project versions" on public.saved_project_versions
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.saved_projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create index if not exists saved_project_versions_project_created_idx on public.saved_project_versions(project_id, created_at desc);
