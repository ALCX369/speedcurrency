-- SpeedCurrency v2: richer profile, Pro plan, tokens, referrals, comments, messages, safety.

-- PROFILE DETAILS ------------------------------------------------------
alter table public.profiles
  add column if not exists bio text check (char_length(bio) <= 160),
  add column if not exists residential_address text check (char_length(residential_address) <= 200),
  add column if not exists residential_lat double precision,
  add column if not exists residential_lng double precision,
  add column if not exists nationality text check (char_length(nationality) <= 60),
  add column if not exists passport_country text check (char_length(passport_country) <= 60),
  add column if not exists passport_expiry date,
  add column if not exists emergency_name text check (char_length(emergency_name) <= 80),
  add column if not exists emergency_phone text check (char_length(emergency_phone) <= 30),
  add column if not exists preferred_currency text check (preferred_currency ~ '^[A-Z]{3}$'),
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references auth.users(id) on delete set null;

grant update (display_name, username, public_journal, allow_tags, bio, residential_address, residential_lat, residential_lng,
  nationality, passport_country, passport_expiry, emergency_name, emergency_phone, preferred_currency) on public.profiles to authenticated;

alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('free','premium','pro'));
alter table public.payments drop constraint if exists payments_plan_check;
alter table public.payments add constraint payments_plan_check check (plan in ('monthly','yearly','pro_monthly','pro_yearly'));

update public.profiles set referral_code = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)) where referral_code is null;

-- TOKENS ---------------------------------------------------------------
create table if not exists public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists token_ledger_user on public.token_ledger(user_id, created_at);
alter table public.token_ledger enable row level security;
create policy "own tokens read" on public.token_ledger for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.token_balance(uid uuid default auth.uid()) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.token_ledger where user_id = uid and uid = auth.uid()
$$;
revoke execute on function public.token_balance(uuid) from public, anon;
grant execute on function public.token_balance(uuid) to authenticated;

-- internal: spend tokens (raises if not enough)
create or replace function public._spend_tokens(uid uuid, amount int, why text, ref uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  perform pg_advisory_xact_lock(hashtext(uid::text));
  select coalesce(sum(delta), 0) into bal from public.token_ledger where user_id = uid;
  if bal < amount then raise exception 'Not enough tokens. Invite friends or go Premium to get more.'; end if;
  insert into public.token_ledger (user_id, delta, reason, ref_id) values (uid, -amount, why, ref);
end $$;
revoke execute on function public._spend_tokens(uuid, int, text, uuid) from public, anon, authenticated;

create or replace function public._is_paid(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and plan in ('premium','pro') and premium_until > now())
$$;
revoke execute on function public._is_paid(uuid) from public, anon, authenticated;

-- NEW USER: profile, referral code, welcome tokens, referral reward ------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ref_owner uuid; rewards_this_month int;
begin
  insert into public.profiles (id, display_name, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''), lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
  on conflict (id) do nothing;
  insert into public.token_ledger (user_id, delta, reason) values (new.id, 20, 'Welcome bonus');

  select id into ref_owner from public.profiles where referral_code = lower(coalesce(new.raw_user_meta_data->>'ref', '')) and id <> new.id;
  if ref_owner is not null then
    update public.profiles set referred_by = ref_owner where id = new.id;
    insert into public.token_ledger (user_id, delta, reason, ref_id) values (new.id, 20, 'Joined with an invite', ref_owner);
    select count(*) into rewards_this_month from public.token_ledger
      where user_id = ref_owner and reason = 'Friend joined' and created_at > date_trunc('month', now());
    if rewards_this_month < 10 then
      insert into public.token_ledger (user_id, delta, reason, ref_id) values (ref_owner, 50, 'Friend joined', new.id);
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- PUBLIC PROFILE CARDS (safe columns only) ------------------------------
create or replace function public.get_profiles(ids uuid[])
returns table (id uuid, username text, display_name text, home_country text, bio text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.home_country, p.bio from public.profiles p where p.id = any(ids)
$$;
revoke execute on function public.get_profiles(uuid[]) from public, anon;
grant execute on function public.get_profiles(uuid[]) to authenticated;

create or replace function public.find_traveller(handle text)
returns table (id uuid, username text, display_name text, home_country text)
language sql security definer set search_path = public stable as $$
  select p.id, p.username, p.display_name, p.home_country from public.profiles p
  where p.username = lower(handle) and p.allow_tags
$$;

-- SAFETY: blocks and reports ---------------------------------------------
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.blocks enable row level security;
create policy "own blocks" on public.blocks for all to authenticated
  using ((select auth.uid()) = blocker) with check ((select auth.uid()) = blocker);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('user','message','comment','entry')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "file reports" on public.reports for insert to authenticated with check ((select auth.uid()) = reporter);
create policy "own reports read" on public.reports for select to authenticated using ((select auth.uid()) = reporter);

create or replace function public._blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a))
$$;
revoke execute on function public._blocked_between(uuid, uuid) from public, anon, authenticated;

-- PUBLIC PHOTOS: anyone signed in can view photos of public journal entries
create policy "public entry photos read" on storage.objects for select to authenticated using (
  bucket_id = 'journal' and exists (
    select 1 from public.journal_entries e join public.profiles p on p.id = e.user_id
    where e.is_public and p.public_journal and storage.objects.name = any(e.photos)
  )
);

-- COMMENTS on public journal entries (1 token, free on Premium/Pro) --------
create table if not exists public.journal_comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists journal_comments_entry on public.journal_comments(entry_id, created_at);
alter table public.journal_comments enable row level security;
create policy "comments read" on public.journal_comments for select to authenticated using (
  exists (select 1 from public.journal_entries e where e.id = entry_id and (e.user_id = (select auth.uid()) or e.is_public))
);
create policy "comments delete" on public.journal_comments for delete to authenticated using (
  (select auth.uid()) = user_id or exists (select 1 from public.journal_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
);

create or replace function public.add_comment(entry uuid, body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner uuid; new_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select e.user_id into owner from public.journal_entries e join public.profiles p on p.id = e.user_id
    where e.id = entry and (e.user_id = me or (e.is_public and p.public_journal));
  if owner is null then raise exception 'This entry is not public'; end if;
  if public._blocked_between(me, owner) then raise exception 'You can''t comment here'; end if;
  insert into public.journal_comments (entry_id, user_id, body) values (entry, me, left(trim(body), 300)) returning id into new_id;
  if owner <> me and not public._is_paid(me) then perform public._spend_tokens(me, 1, 'Comment', new_id); end if;
  return new_id;
end $$;
revoke execute on function public.add_comment(uuid, text) from public, anon;
grant execute on function public.add_comment(uuid, text) to authenticated;

-- DIRECT MESSAGES (1 token per message, free on Premium/Pro) ---------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  last_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
alter table public.conversations enable row level security;
create policy "my conversations" on public.conversations for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;
create policy "my messages" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and (select auth.uid()) in (c.user_a, c.user_b))
);

create or replace function public.send_message(to_user uuid, body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a uuid; b uuid; conv uuid; new_id uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if to_user is null or to_user = me then raise exception 'Choose someone to message'; end if;
  if not exists (select 1 from public.profiles where id = to_user) then raise exception 'Traveller not found'; end if;
  if public._blocked_between(me, to_user) then raise exception 'You can''t message this traveller'; end if;
  a := least(me, to_user); b := greatest(me, to_user);
  insert into public.conversations (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do update set last_at = now() returning id into conv;
  insert into public.messages (conversation_id, sender_id, body) values (conv, me, left(trim(body), 1000)) returning id into new_id;
  if not public._is_paid(me) then perform public._spend_tokens(me, 1, 'Message', new_id); end if;
  return conv;
end $$;
revoke execute on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

-- live updates for chats
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

-- existing accounts get the welcome bonus too
insert into public.token_ledger (user_id, delta, reason)
select p.id, 20, 'Welcome bonus' from public.profiles p
where not exists (select 1 from public.token_ledger t where t.user_id = p.id and t.reason = 'Welcome bonus');

-- balance is read with the caller's own permissions (ledger rows are private per user)
create or replace function public.token_balance(uid uuid default auth.uid()) returns integer
language sql stable security invoker set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.token_ledger where user_id = uid
$$;
