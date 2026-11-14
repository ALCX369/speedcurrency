-- SpeedCurrency travel app: database, security rules and photo storage.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

-- PROFILES -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  home_country text,            -- set once from the sign-up location, then locked
  home_country_code text,
  plan text not null default 'free' check (plan in ('free','premium')),
  premium_until timestamptz,
  public_journal boolean not null default false,
  allow_tags boolean not null default true,
  created_at timestamptz not null default now()
);

-- New sign-up -> profile row
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Home country can be written once and never changed
create or replace function public.lock_home_country() returns trigger
language plpgsql as $$
begin
  if old.home_country is not null and new.home_country is distinct from old.home_country then
    raise exception 'Home country is fixed to where the account was created';
  end if;
  if old.home_country_code is not null and new.home_country_code is distinct from old.home_country_code then
    raise exception 'Home country is fixed to where the account was created';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_country on public.profiles;
create trigger profiles_lock_country before update on public.profiles
  for each row execute function public.lock_home_country();

alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
-- Users may only change these columns; country and plan are set by the server
revoke update on public.profiles from authenticated, anon;
grant update (display_name, username, public_journal, allow_tags) on public.profiles to authenticated;

-- Look up another traveller by username (to link people you met)
create or replace function public.find_traveller(handle text)
returns table (username text, display_name text, home_country text)
language sql security definer set search_path = public stable as $$
  select p.username, p.display_name, p.home_country
  from public.profiles p
  where p.username = lower(handle) and p.allow_tags
$$;
grant execute on function public.find_traveller(text) to authenticated;

-- TRIPS ----------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  destination text not null check (char_length(destination) between 1 and 120),
  start_date date,
  end_date date,
  notes text check (char_length(notes) <= 2000),
  budget jsonb not null default '{}'::jsonb,
  reminder jsonb not null default '{}'::jsonb,   -- {on, lat, lng, radius_m, note, place}
  created_at timestamptz not null default now()
);

-- JOURNAL --------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  place_name text check (char_length(place_name) <= 160),
  lat double precision,
  lng double precision,
  visited_on date,
  rating smallint check (rating between 1 and 5),
  story text check (char_length(story) <= 528),
  photos text[] not null default '{}' check (cardinality(photos) <= 6),
  people jsonb not null default '[]'::jsonb,   -- [{name, from_country, username}]
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- MAP PINS -------------------------------------------------------------
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('home','garage','visited','planned','saved')),
  name text not null check (char_length(name) between 1 and 120),
  lat double precision not null,
  lng double precision not null,
  note text check (char_length(note) <= 528),
  created_at timestamptz not null default now()
);

-- PLANNER HISTORY ------------------------------------------------------
create table if not exists public.planner_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New plan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.planner_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.planner_chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  data jsonb,                       -- structured answer: documents, agents, places, costs, sources
  created_at timestamptz not null default now()
);
create index if not exists planner_messages_chat on public.planner_messages(chat_id, created_at);
create index if not exists planner_messages_user_month on public.planner_messages(user_id, created_at);

-- PAYMENTS -------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'dpo',
  plan text not null check (plan in ('monthly','yearly')),
  amount numeric(10,2) not null,
  currency text not null default 'NAD',
  trans_token text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at timestamptz not null default now()
);

-- ROW LEVEL SECURITY: everyone sees only their own data ----------------
alter table public.trips enable row level security;
alter table public.journal_entries enable row level security;
alter table public.pins enable row level security;
alter table public.planner_chats enable row level security;
alter table public.planner_messages enable row level security;
alter table public.payments enable row level security;

create policy "own trips" on public.trips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own pins" on public.pins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chats" on public.planner_chats for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own journal" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "public journal read" on public.journal_entries for select using (
  is_public and exists (select 1 from public.profiles p where p.id = user_id and p.public_journal)
);
-- Messages and payments are written only by the server functions
create policy "own messages read" on public.planner_messages for select using (auth.uid() = user_id);
create policy "own messages delete" on public.planner_messages for delete using (auth.uid() = user_id);
create policy "own payments read" on public.payments for select using (auth.uid() = user_id);

-- PHOTO STORAGE: private bucket, one folder per user -------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "own photos read" on storage.objects for select
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos write" on storage.objects for insert
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects for delete
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
