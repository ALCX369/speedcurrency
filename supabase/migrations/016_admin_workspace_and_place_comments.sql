-- ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
-- 016: (1) place comments: anyone signed in can comment on a place in Explore / Town Guide.
--      (2) admin workspace: members list + a daily data tracker (one snapshot row per day).

-- (1) place comments -------------------------------------------------------
create table if not exists public.place_comments (
  id uuid primary key default gen_random_uuid(),
  place_key text not null check (char_length(place_key) between 1 and 120),
  place_name text not null check (char_length(place_name) between 1 and 120),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists place_comments_place_idx on public.place_comments (place_key, created_at desc);
alter table public.place_comments enable row level security;
drop policy if exists "place comments readable" on public.place_comments;
create policy "place comments readable" on public.place_comments for select using (true);
drop policy if exists "signed in can comment" on public.place_comments;
create policy "signed in can comment" on public.place_comments for insert to authenticated
  with check (auth.uid() = user_id
    -- gentle spam guard: at most 30 comments per person per hour
    and (select count(*) from public.place_comments c where c.user_id = auth.uid() and c.created_at > now() - interval '1 hour') < 30);
drop policy if exists "own or admin delete comment" on public.place_comments;
create policy "own or admin delete comment" on public.place_comments for delete to authenticated
  using (auth.uid() = user_id or public.is_admin());
grant select on public.place_comments to anon, authenticated;
grant insert (place_key, place_name, body) on public.place_comments to authenticated;
grant delete on public.place_comments to authenticated;

-- (2a) members list for the admin workspace --------------------------------
create or replace function public.admin_members()
returns table (id uuid, display_name text, username text, email text, home_country text, plan text, premium_until timestamptz,
               account_type text, created_at timestamptz, last_sign_in timestamptz, memories bigint, questions bigint, comments bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.display_name, p.username, u.email::text, p.home_country, p.plan, p.premium_until, p.account_type, p.created_at, u.last_sign_in_at,
      (select count(*) from journal_entries j where j.user_id = p.id),
      (select count(*) from planner_messages m join planner_chats c on c.id = m.chat_id where c.user_id = p.id and m.role = 'user'),
      (select count(*) from place_comments pc where pc.user_id = p.id)
    from profiles p join auth.users u on u.id = p.id
    order by p.created_at desc
    limit 500;
end $$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

-- (2b) daily data tracker ----------------------------------------------------
create table if not exists public.admin_daily (
  day date primary key,
  members int not null, paying int not null, revenue_total numeric not null, payments_pending int not null,
  questions_total int not null, memories_total int not null, comments_total int not null, reports_30d int not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_daily enable row level security; -- no policies: only the functions below touch it

-- records today's numbers (updates today's row if it exists) and returns the last 90 days, oldest first
create or replace function public.admin_track()
returns setof public.admin_daily
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into admin_daily (day, members, paying, revenue_total, payments_pending, questions_total, memories_total, comments_total, reports_30d, updated_at)
  values ((now() at time zone 'Africa/Windhoek')::date,
    (select count(*) from profiles),
    (select count(*) from profiles where plan in ('premium','pro') and premium_until > now()),
    (select coalesce(sum(amount), 0) from payments where status = 'paid'),
    (select count(*) from payments where status = 'pending'),
    (select count(*) from planner_messages where role = 'user'),
    (select count(*) from journal_entries),
    (select count(*) from place_comments),
    (select count(*) from reports where created_at >= now() - interval '30 days'),
    now())
  on conflict (day) do update set members = excluded.members, paying = excluded.paying, revenue_total = excluded.revenue_total,
    payments_pending = excluded.payments_pending, questions_total = excluded.questions_total, memories_total = excluded.memories_total,
    comments_total = excluded.comments_total, reports_30d = excluded.reports_30d, updated_at = now();
  return query select * from admin_daily where day > (now() at time zone 'Africa/Windhoek')::date - 90 order by day;
end $$;
revoke all on function public.admin_track() from public, anon;
grant execute on function public.admin_track() to authenticated;

-- (3) profile pictures ------------------------------------------------------
-- public "avatars" bucket: anyone can see a profile picture; each person writes only their own folder (<uid>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists "own avatar write" on storage.objects;
create policy "own avatar write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own avatar update" on storage.objects;
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "own avatar delete" on storage.objects;
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.profiles add column if not exists avatar_path text
  check (avatar_path is null or (char_length(avatar_path) <= 200 and avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$'));
grant update (avatar_path) on public.profiles to authenticated;
-- status update: a short line like "Currently in Swakopmund" (shown for 7 days)
alter table public.profiles add column if not exists status_text text check (status_text is null or char_length(status_text) <= 60);
alter table public.profiles add column if not exists status_at timestamptz;
grant update (status_text, status_at) on public.profiles to authenticated;

-- public profile card now also returns the picture (same rules as before for business details)
drop function if exists public.get_profiles(uuid[]);
create function public.get_profiles(ids uuid[])
returns table (id uuid, username text, display_name text, home_country text, bio text, account_type text, biz_category text, biz_town text,
               biz_phone text, biz_whatsapp text, biz_email text, biz_website text, biz_booking text, biz_hours text, avatar_path text,
               status_text text, status_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.home_country, p.bio, p.account_type,
    case when p.account_type = 'business' then p.biz_category end, case when p.account_type = 'business' then p.biz_town end,
    case when p.account_type = 'business' then p.biz_phone end, case when p.account_type = 'business' then p.biz_whatsapp end,
    case when p.account_type = 'business' then p.biz_email end, case when p.account_type = 'business' then p.biz_website end,
    case when p.account_type = 'business' then p.biz_booking end, case when p.account_type = 'business' then p.biz_hours end,
    case when p.avatar_path like p.id::text || '/%' then p.avatar_path end,
    case when p.status_at > now() - interval '7 days' then p.status_text end, p.status_at
  from public.profiles p where p.id = any(ids)
$$;
revoke all on function public.get_profiles(uuid[]) from public, anon;
grant execute on function public.get_profiles(uuid[]) to authenticated;
-- (4) Nami's short memory of each traveller (towns + topics from past chats), private to the account owner
alter table public.profiles add column if not exists nami_memory text check (nami_memory is null or char_length(nami_memory) <= 600);
grant update (nami_memory) on public.profiles to authenticated;
-- (5) replies under journal comments (one level: a reply to a reply joins the same thread)
alter table public.journal_comments add column if not exists parent_id uuid references public.journal_comments (id) on delete cascade;
create index if not exists journal_comments_parent_idx on public.journal_comments (parent_id);
drop function if exists public.add_comment(uuid, text);
create or replace function public.add_comment(entry uuid, body text, parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); owner uuid; new_id uuid; root uuid;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select e.user_id into owner from public.journal_entries e join public.profiles p on p.id = e.user_id
    where e.id = entry and (e.user_id = me or (e.is_public and p.public_journal));
  if owner is null then raise exception 'This entry is not public'; end if;
  if public._blocked_between(me, owner) then raise exception 'You can''t comment here'; end if;
  if parent is not null then
    select coalesce(c.parent_id, c.id) into root from public.journal_comments c where c.id = parent and c.entry_id = entry;
    if root is null then raise exception 'That comment is gone'; end if;
  end if;
  insert into public.journal_comments (entry_id, user_id, body, parent_id) values (entry, me, left(trim(body), 300), root) returning id into new_id;
  if owner <> me and not public._is_paid(me) then perform public._spend_tokens(me, 1, 'Comment', new_id); end if;
  return new_id;
end $$;
revoke all on function public.add_comment(uuid, text, uuid) from public, anon;
grant execute on function public.add_comment(uuid, text, uuid) to authenticated;