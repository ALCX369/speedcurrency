-- ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
-- 015: business accounts (lodges, restaurants, guides, shops, transport) + simple profile-view insights.
alter table public.profiles add column if not exists account_type text not null default 'personal' check (account_type in ('personal', 'business'));
alter table public.profiles add column if not exists biz_category text check (biz_category is null or biz_category in ('lodge', 'restaurant', 'tour', 'shop', 'transport', 'guide', 'other'));
alter table public.profiles add column if not exists biz_town text check (biz_town is null or char_length(biz_town) <= 60);
alter table public.profiles add column if not exists biz_phone text check (biz_phone is null or biz_phone ~ '^\+?[0-9 ]{6,20}$');
alter table public.profiles add column if not exists biz_whatsapp text check (biz_whatsapp is null or biz_whatsapp ~ '^\+?[0-9 ]{6,20}$');
alter table public.profiles add column if not exists biz_email text check (biz_email is null or (char_length(biz_email) <= 120 and biz_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
alter table public.profiles add column if not exists biz_website text check (biz_website is null or (char_length(biz_website) <= 200 and biz_website ~ '^https://'));
alter table public.profiles add column if not exists biz_booking text check (biz_booking is null or (char_length(biz_booking) <= 200 and biz_booking ~ '^https://'));
alter table public.profiles add column if not exists biz_hours text check (biz_hours is null or char_length(biz_hours) <= 80);
grant update (account_type, biz_category, biz_town, biz_phone, biz_whatsapp, biz_email, biz_website, biz_booking, biz_hours) on public.profiles to authenticated;

-- public profile card now includes the business details (personal profiles return nulls)
drop function if exists public.get_profiles(uuid[]);
create function public.get_profiles(ids uuid[])
returns table (id uuid, username text, display_name text, home_country text, bio text, account_type text, biz_category text, biz_town text,
  biz_phone text, biz_whatsapp text, biz_email text, biz_website text, biz_booking text, biz_hours text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.home_country, p.bio, p.account_type,
    case when p.account_type = 'business' then p.biz_category end, case when p.account_type = 'business' then p.biz_town end,
    case when p.account_type = 'business' then p.biz_phone end, case when p.account_type = 'business' then p.biz_whatsapp end,
    case when p.account_type = 'business' then p.biz_email end, case when p.account_type = 'business' then p.biz_website end,
    case when p.account_type = 'business' then p.biz_booking end, case when p.account_type = 'business' then p.biz_hours end
  from public.profiles p where p.id = any(ids)
$$;
revoke execute on function public.get_profiles(uuid[]) from public, anon;
grant execute on function public.get_profiles(uuid[]) to authenticated;

-- insights: one view per visitor per day; only the owner can read their counts
create table if not exists public.profile_views (
  profile_id uuid not null references auth.users(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  primary key (profile_id, viewer_id, day)
);
alter table public.profile_views enable row level security; -- no policies: only the functions below touch it

create or replace function public.record_profile_view(target uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.profile_views (profile_id, viewer_id) select target, auth.uid()
  where auth.uid() is not null and target <> auth.uid() on conflict do nothing
$$;
revoke execute on function public.record_profile_view(uuid) from public, anon;
grant execute on function public.record_profile_view(uuid) to authenticated;

create or replace function public.my_profile_views() returns table (last_7 bigint, last_30 bigint, total bigint)
language sql stable security definer set search_path = public as $$
  select count(*) filter (where day > current_date - 7), count(*) filter (where day > current_date - 30), count(*)
  from public.profile_views where profile_id = auth.uid()
$$;
revoke execute on function public.my_profile_views() from public, anon;
grant execute on function public.my_profile_views() to authenticated;

-- local ads: business accounts in a town (shown as "AD · near you" to travellers in that town)
create or replace function public.local_businesses(town_name text)
returns table (id uuid, display_name text, biz_category text, biz_hours text)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.biz_category, p.biz_hours from public.profiles p
  where p.account_type = 'business' and lower(p.biz_town) = lower(trim(town_name)) limit 20
$$;
revoke execute on function public.local_businesses(text) from public, anon;
grant execute on function public.local_businesses(text) to authenticated;
