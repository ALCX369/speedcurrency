-- News cache for the Updates newspaper (written only by the news server function)
create table if not exists public.news_cache (
  key text primary key,
  data jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);
alter table public.news_cache enable row level security;

-- Keep payment records after an account is deleted (tax law), without the link to the account
alter table public.payments add column if not exists payer_email text;
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

create or replace function public._payment_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.payer_email is null and new.user_id is not null then
    select email into new.payer_email from auth.users where id = new.user_id;
  end if;
  return new;
end $$;
revoke execute on function public._payment_email() from public, anon, authenticated;
drop trigger if exists payments_email on public.payments;
create trigger payments_email before insert on public.payments for each row execute function public._payment_email();
update public.payments p set payer_email = u.email from auth.users u where u.id = p.user_id and p.payer_email is null;

-- Admin list: include payments whose account was deleted
create or replace function public.admin_payments(p_status text default 'pending')
returns table (id uuid, user_id uuid, email text, display_name text, plan text, amount numeric, reference text,
               proof_path text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.user_id, coalesce(u.email::text, p.payer_email), coalesce(pr.display_name, case when p.user_id is null then '(deleted account)' end),
           p.plan, p.amount, p.reference, p.proof_path, p.status, p.admin_note, p.created_at, p.reviewed_at
    from public.payments p left join auth.users u on u.id = p.user_id left join public.profiles pr on pr.id = p.user_id
    where p.provider = 'eft' and (p_status = 'all' or p.status = p_status)
    order by p.created_at desc limit 500;
end $$;

-- Activation must not run for a deleted account
create or replace function public.admin_review_payment(p_id uuid, p_approve boolean, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare pay record; info record; prof record; base timestamptz; new_tier text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into pay from public.payments where id = p_id and provider = 'eft' for update;
  if pay.id is null then raise exception 'Payment not found'; end if;
  if pay.status <> 'pending' then raise exception 'This payment was already reviewed'; end if;
  if not p_approve then
    update public.payments set status = 'rejected', admin_note = left(p_note, 300), reviewed_at = now() where id = p_id;
    return null;
  end if;
  if pay.user_id is null then raise exception 'This account was deleted. Refund the payment instead.'; end if;
  select * into info from public._plan_info(pay.plan);
  select plan, premium_until into prof from public.profiles where id = pay.user_id for update;
  base := greatest(coalesce(prof.premium_until, now()), now()) + make_interval(days => info.days);
  new_tier := case when info.tier = 'pro' or (prof.plan = 'pro' and prof.premium_until > now()) then 'pro' else 'premium' end;
  update public.payments set status = 'paid', admin_note = left(p_note, 300), reviewed_at = now() where id = p_id;
  update public.profiles set plan = new_tier, premium_until = base where id = pay.user_id;
  insert into public.token_ledger (user_id, delta, reason, ref_id)
    values (pay.user_id, case when new_tier = 'pro' then 300 else 100 end, case when new_tier = 'pro' then 'Pro tokens' else 'Premium tokens' end, pay.id);
  return base;
end $$;
