-- The planner now runs in the browser (Perplexity Sonar via Puter.js, no API keys),
-- so signed-in users save their own planner messages into their own chats.
create policy "own messages insert" on public.planner_messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.planner_chats c where c.id = chat_id and c.user_id = (select auth.uid()))
  );
