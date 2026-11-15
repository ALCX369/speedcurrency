-- 011: invite rewards are paid when the invited friend asks their first assistant question,
-- not at sign-up. Stops throwaway accounts farming 50 tokens each (email confirmation is off).

-- New members still get their welcome bonus (+20 if invited); the inviter's 50 now waits.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare ref_owner uuid;
begin
  insert into public.profiles (id, display_name, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''), lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))
  on conflict (id) do nothing;
  insert into public.token_ledger (user_id, delta, reason) values (new.id, 20, 'Welcome bonus');
  select id into ref_owner from public.profiles where referral_code = lower(coalesce(new.raw_user_meta_data->>'ref', '')) and id <> new.id;
  if ref_owner is not null then
    update public.profiles set referred_by = ref_owner where id = new.id;
    insert into public.token_ledger (user_id, delta, reason, ref_id) values (new.id, 20, 'Joined with an invite', ref_owner);
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Pay the inviter once, when their friend's first question is saved (max 10 rewards a month).
create or replace function public._reward_inviter() returns trigger
language plpgsql security definer set search_path = public as $$
declare inviter uuid; rewards_this_month int;
begin
  if new.role <> 'user' then return new; end if;
  select referred_by into inviter from public.profiles where id = new.user_id;
  if inviter is null then return new; end if;
  -- only once per invited friend
  if exists (select 1 from public.token_ledger where user_id = inviter and reason = 'Friend joined' and ref_id = new.user_id) then return new; end if;
  perform pg_advisory_xact_lock(hashtext(inviter::text));
  select count(*) into rewards_this_month from public.token_ledger
    where user_id = inviter and reason = 'Friend joined' and created_at > date_trunc('month', now());
  if rewards_this_month < 10 then
    insert into public.token_ledger (user_id, delta, reason, ref_id) values (inviter, 50, 'Friend joined', new.user_id);
  end if;
  return new;
end $$;
revoke execute on function public._reward_inviter() from public, anon, authenticated;
drop trigger if exists planner_messages_reward_inviter on public.planner_messages;
create trigger planner_messages_reward_inviter after insert on public.planner_messages
  for each row execute function public._reward_inviter();
