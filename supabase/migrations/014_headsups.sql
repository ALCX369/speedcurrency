-- ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
-- 014: travel heads-ups. Short, editable warnings/tips travellers share on their profile and in a town
-- (e.g. "Road to Opuwo is gravel, go slow"). Signed-in members can read all; you edit only your own.
create table if not exists public.headsups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  town text check (town is null or char_length(town) between 1 and 60),
  body text not null check (char_length(body) between 3 and 160),
  kind text not null default 'tip' check (kind in ('tip', 'warning', 'road', 'safety')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists headsups_town on public.headsups (lower(town), created_at desc);
create index if not exists headsups_user on public.headsups (user_id, created_at desc);
alter table public.headsups enable row level security;

drop policy if exists "read headsups" on public.headsups;
create policy "read headsups" on public.headsups for select to authenticated using (
  not exists (select 1 from public.blocks b where b.blocker = (select auth.uid()) and b.blocked = headsups.user_id)
);
drop policy if exists "add own headsup" on public.headsups;
create policy "add own headsup" on public.headsups for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "edit own headsup" on public.headsups;
create policy "edit own headsup" on public.headsups for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "delete own headsup" on public.headsups;
create policy "delete own headsup" on public.headsups for delete to authenticated using (user_id = (select auth.uid()));

-- keep it small and spam-free: at most 30 heads-ups per person, 10 per day
create or replace function public.headsup_limits() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.headsups where user_id = new.user_id) >= 30 then raise exception 'You can keep up to 30 heads-ups. Delete an old one first.'; end if;
  if (select count(*) from public.headsups where user_id = new.user_id and created_at > now() - interval '1 day') >= 10 then raise exception 'That is enough heads-ups for today. Try again tomorrow.'; end if;
  return new;
end $$;
revoke execute on function public.headsup_limits() from public, anon, authenticated;
drop trigger if exists headsup_limits on public.headsups;
create trigger headsup_limits before insert on public.headsups for each row execute function public.headsup_limits();

create or replace function public.headsup_touch() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
revoke execute on function public.headsup_touch() from public, anon, authenticated;
drop trigger if exists headsup_touch on public.headsups;
create trigger headsup_touch before update on public.headsups for each row execute function public.headsup_touch();
