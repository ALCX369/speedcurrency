-- Community reviews with optional photo: everyone signed in can read, Premium/Pro members can write.
create table if not exists public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_key text not null check (length(place_key) <= 80),
  place_name text not null check (length(place_name) <= 120),
  town text check (length(town) <= 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text not null check (length(body) between 3 and 500),
  photo_path text check (photo_path is null or length(photo_path) <= 200),
  created_at timestamptz not null default now(),
  unique (place_key, user_id)
);
create index if not exists place_reviews_key on public.place_reviews(place_key, created_at desc);
alter table public.place_reviews enable row level security;
create or replace function public.is_paid_member() returns boolean language sql stable security definer set search_path = public as $$ select public._is_paid(auth.uid()); $$;
revoke execute on function public.is_paid_member() from public, anon;
grant execute on function public.is_paid_member() to authenticated;
create policy "reviews readable" on public.place_reviews for select to authenticated using (true);
create policy "paid members review" on public.place_reviews for insert to authenticated
  with check (auth.uid() = user_id and public.is_paid_member() and (photo_path is null or split_part(photo_path, '/', 1) = auth.uid()::text));
create policy "own review delete" on public.place_reviews for delete to authenticated using (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reviews', 'reviews', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "paid review photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'reviews' and (storage.foldername(name))[1] = auth.uid()::text and public.is_paid_member());
create policy "own review photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'reviews' and (storage.foldername(name))[1] = auth.uid()::text);
