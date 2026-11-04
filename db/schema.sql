create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('COACH','SUBSCRIBER')),
  email text not null unique,
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references users(id) on delete cascade,
  user_id uuid unique references users(id) on delete set null,
  name text not null,
  weight_kg numeric(6,2) not null default 0 check (weight_kg >= 0 and weight_kg <= 400),
  adherence integer not null default 0 check (adherence between 0 and 100),
  subscription_days integer not null default 30 check (subscription_days between 0 and 3650),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','FOLLOW_UP')),
  sleep_hours numeric(4,1) not null default 0 check (sleep_hours between 0 and 24),
  last_activity text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references users(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  title text not null,
  description text not null default '',
  days jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists nutrition_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references users(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  title text not null,
  calories integer not null default 0 check (calories between 0 and 10000),
  protein_g integer not null default 0 check (protein_g between 0 and 1000),
  carbs_g integer not null default 0 check (carbs_g between 0 and 2000),
  fat_g integer not null default 0 check (fat_g between 0 and 1000),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists progress_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg >= 0 and weight_kg <= 400),
  sleep_hours numeric(4,1) not null default 0 check (sleep_hours between 0 and 24),
  adherence integer not null default 0 check (adherence between 0 and 100),
  recorded_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references users(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists login_attempts (
  id bigserial primary key,
  identifier_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  successful boolean not null default false
);

create table if not exists audit_logs (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  action text not null,
  resource_type text not null default '',
  resource_id text not null default '',
  ip_hash text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists exercise_videos (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references users(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  title text not null check (length(title) between 2 and 120),
  description text not null default '',
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_members_coach on members(coach_id);
create index if not exists idx_members_user on members(user_id);
create index if not exists idx_progress_member on progress_entries(member_id, recorded_at desc);
create index if not exists idx_messages_member on messages(member_id, created_at desc);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expiry on sessions(expires_at);
create index if not exists idx_login_attempts_identifier_time on login_attempts(identifier_hash, created_at desc);
create index if not exists idx_login_attempts_ip_time on login_attempts(ip_hash, created_at desc);
create index if not exists idx_videos_coach on exercise_videos(coach_id, created_at desc);
create index if not exists idx_videos_member on exercise_videos(member_id);
