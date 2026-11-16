-- 013: Google Maps reviews imported by the user from their own Google Takeout file (with consent).
-- Private by default; the owner can make each one public, and signed-in travellers can then see it.
create table if not exists public.google_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  src_key text not null check (char_length(src_key) between 1 and 300),   -- de-duplicates re-imports
  place_name text not null check (char_length(place_name) between 1 and 200),
  address text check (char_length(address) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  rating smallint check (rating between 1 and 5),
  body text check (char_length(body) <= 4000),
  reviewed_at timestamptz,
  maps_url text check (maps_url is null or (maps_url ~ '^https?://' and char_length(maps_url) <= 500)),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, src_key)
);
create index if not exists google_reviews_user on public.google_reviews(user_id, reviewed_at desc);
create index if not exists google_reviews_public_geo on public.google_reviews(lat, lng) where is_public;
alter table public.google_reviews enable row level security;
create policy "own google reviews" on public.google_reviews for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "public google reviews read" on public.google_reviews for select to authenticated using (is_public);

-- At most 2,000 imported reviews per person (keeps the table small and stops abuse)
create or replace function public.google_reviews_cap() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.google_reviews where user_id = new.user_id) >= 2000 then
    raise exception 'Import limit reached (2,000 reviews)';
  end if;
  return new;
end $$;
revoke execute on function public.google_reviews_cap() from public, anon, authenticated;
drop trigger if exists google_reviews_cap on public.google_reviews;
create trigger google_reviews_cap before insert on public.google_reviews for each row execute function public.google_reviews_cap();
