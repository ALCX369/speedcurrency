-- 010: security fixes from the 2026-11-15 review.

-- 1) Assistant limits are counted from planner_messages. Users could delete their own messages
--    through the API to reset the monthly count (unlimited AI questions billed to the owner),
--    or insert fake rows. The app never does either: the assistant function writes with the
--    service role, and account deletion removes rows by ON DELETE CASCADE. So remove both doors.
drop policy if exists "own messages delete" on public.planner_messages;
drop policy if exists "own messages insert" on public.planner_messages;

-- 2) Let the assistant function spend tokens through the locked helper (no double spending).
grant execute on function public._spend_tokens(uuid, int, text, uuid) to service_role;
