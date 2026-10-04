-- ==============================================================================
-- StudyBuddy Database Schema & Security Policies
-- ==============================================================================

-- 1. PROFILES TABLE
-- Stores user identity, live study status, and active session timestamp
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  status text not null default 'offline' check (status in ('active', 'break', 'offline')),
  session_start timestamptz,
  break_start timestamptz,
  break_duration_minutes integer,
  daily_quota_hours numeric not null default 3.0,
  updated_at timestamptz default timezone('utc'::text, now())
);

-- Migration helpers for incremental upgrades:
alter table public.profiles
add column if not exists break_start timestamptz,
add column if not exists break_duration_minutes integer,
add column if not exists daily_quota_hours numeric not null default 3.0;

-- 2. SESSIONS TABLE
-- Stores completed study sprints, durations, topic tags, proof links, and notes
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_minutes integer not null,
  topics text[] not null default '{}',
  problems_solved jsonb default '{"easy":0,"medium":0,"hard":0}'::jsonb,
  proof_url text,
  note text,
  created_at timestamptz default timezone('utc'::text, now())
);

alter table public.sessions
add column if not exists problems_solved jsonb default '{"easy":0,"medium":0,"hard":0}'::jsonb,
add column if not exists proof_url text;

-- 3. TASKS TABLE
-- Tasks & assignments given to each other with problem and solution URLs
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  topic text not null default 'DSA',
  problem_url text,
  solution_url text,
  notes text,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now())
);

-- Migration helpers for incremental upgrades:
alter table public.tasks
drop constraint if exists tasks_status_check;

alter table public.tasks
add constraint tasks_status_check check (status in ('pending', 'in_progress', 'completed'));

alter table public.tasks
add column if not exists due_date date,
add column if not exists started_at timestamptz;


-- 4. MESSAGES TABLE
-- Private real-time chat with code snippets, problem links, and reactions
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  code_snippet text,
  problem_link text,
  problem_title text,
  reactions jsonb default '{}'::jsonb,
  is_read boolean default false,
  created_at timestamptz default timezone('utc'::text, now())
);

-- Performance Indexes
create index if not exists idx_sessions_user_id on public.sessions(user_id);
create index if not exists idx_sessions_start_time on public.sessions(start_time desc);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_creator_id on public.tasks(creator_id);
create index if not exists idx_messages_created_at on public.messages(created_at asc);



-- ==============================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

-- Profiles: Authenticated users can view all profiles (both partners)
create policy "Authenticated users can view profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Profiles: Users can only update their own profile (status, session_start, display_name)
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profiles: Users can insert their own profile
create policy "Users can insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Sessions: Authenticated users can view all sessions (for shared logs & stats)
create policy "Authenticated users can view sessions"
  on public.sessions
  for select
  to authenticated
  using (true);

-- Sessions: Users can insert their own study sessions
create policy "Users can insert own sessions"
  on public.sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Sessions: Users can update or delete their own sessions
create policy "Users can update own sessions"
  on public.sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Tasks: Authenticated users can view all tasks
alter table public.tasks enable row level security;

create policy "Authenticated users can view tasks"
  on public.tasks
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert tasks"
  on public.tasks
  for insert
  to authenticated
  with check (auth.uid() = creator_id);

create policy "Users can update assigned or created tasks"
  on public.tasks
  for update
  to authenticated
  using (auth.uid() = creator_id or auth.uid() = assigned_to);

create policy "Creators can delete tasks"
  on public.tasks
  for delete
  to authenticated
  using (auth.uid() = creator_id);

-- Messages: Authenticated users can view all messages
alter table public.messages enable row level security;

create policy "Authenticated users can view messages"
  on public.messages
  for select
  to authenticated
  using (true);

create policy "Authenticated users can insert messages"
  on public.messages
  for insert
  to authenticated
  with check (auth.uid() = sender_id);

create policy "Authenticated users can update messages"
  on public.messages
  for update
  to authenticated
  using (true);

-- ==============================================================================
-- 4. REALTIME REPLICATION CONFIGURATION
-- ==============================================================================

-- Enable full replica identity so updates deliver the entire row payload
alter table public.profiles replica identity full;
alter table public.sessions replica identity full;
alter table public.tasks replica identity full;
alter table public.messages replica identity full;

-- Add tables to the supabase_realtime publication
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.messages;

-- ==============================================================================
-- 5. AUTOMATIC PROFILE CREATION TRIGGER
-- Whenever a user account is created in Supabase Auth, populate public.profiles
-- ==============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, status, session_start)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'offline',
    null
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==============================================================================
-- 6. MANUAL ACCOUNT SETUP INSTRUCTIONS
-- ==============================================================================
/*
  STEP 1:
  In your Supabase Project Dashboard -> Authentication -> Users -> "Add User" -> "Create User"
  Create 2 accounts:
    - User 1: you@domain.com (password: chosen password, auto-confirm email: YES)
    - User 2: partner@domain.com (password: chosen password, auto-confirm email: YES)

  STEP 2 (Optional custom display names):
  If you want custom display names (e.g. "Sahor" and "Ananya"), run:

  update public.profiles
  set display_name = 'YourName'
  where email = 'you@domain.com';

  update public.profiles
  set display_name = 'PartnerName'
  where email = 'partner@domain.com';
*/
