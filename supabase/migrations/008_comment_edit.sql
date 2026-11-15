-- Let people edit their own comments (shows "edited")
alter table public.journal_comments add column if not exists edited_at timestamptz;
create or replace function public.edit_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 300 then raise exception 'Comments are 1 to 300 characters'; end if;
  update public.journal_comments set body = trim(p_body), edited_at = now() where id = p_id and user_id = auth.uid();
  if not found then raise exception 'You can only edit your own comments'; end if;
end $$;
revoke execute on function public.edit_comment(uuid, text) from public, anon;
grant execute on function public.edit_comment(uuid, text) to authenticated;
