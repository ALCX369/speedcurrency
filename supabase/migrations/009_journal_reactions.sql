-- Emoji reactions on journal entries (free, one of each emoji per person)
create table if not exists public.journal_reactions (
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️','🔥','😍','👏','🌍','😂')),
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id, emoji)
);
alter table public.journal_reactions enable row level security;
create policy "reactions read" on public.journal_reactions for select to authenticated using (
  exists (select 1 from public.journal_entries e where e.id = entry_id and (e.is_public or e.user_id = (select auth.uid()))));
create policy "react own" on public.journal_reactions for insert to authenticated with check (
  (select auth.uid()) = user_id and exists (select 1 from public.journal_entries e where e.id = entry_id and (e.is_public or e.user_id = (select auth.uid()))));
create policy "unreact own" on public.journal_reactions for delete to authenticated using ((select auth.uid()) = user_id);
