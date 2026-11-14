-- EFT (bank transfer) payments with manual approval by an admin.
-- Flow: user picks a plan -> gets a reference -> pays by EFT -> uploads or emails proof
--       -> admin checks the bank account -> Activate (plan + tokens) or Reject.

-- Payments: allow EFT fields and a rejected status
alter table public.payments add column if not exists reference text unique;
alter table public.payments add column if not exists proof_path text;
alter table public.payments add column if not exists admin_note text;
alter table public.payments add column if not exists reviewed_at timestamptz;
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('pending','paid','failed','rejected'));

-- Admins (not readable by clients; checked through is_admin())
create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;
insert into public.admins (user_id) select id from auth.users where email = 'cycleswithgrace@gmail.com' on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Plan catalogue used by the database (keep in step with app/config.js)
create or replace function public._plan_info(p text, out amount numeric, out days int, out tier text)
language sql immutable as $$
  select v.a, v.d, v.t from (values
    ('monthly', 149::numeric, 31, 'premium'),
    ('yearly', 1399::numeric, 366, 'premium'),
    ('pro_monthly', 349::numeric, 31, 'pro'),
    ('pro_yearly', 3299::numeric, 366, 'pro')) v(k, a, d, t) where v.k = p;
$$;
revoke execute on function public._plan_info(text) from public, anon, authenticated;

-- Start (or reuse) an EFT payment for the signed-in user
create or replace function public.request_eft(p_plan text)
returns table (id uuid, reference text, amount numeric, plan text, status text)
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); info record; pid uuid; ref text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  select * into info from public._plan_info(p_plan);
  if info.amount is null then raise exception 'Unknown plan'; end if;
  select p.id into pid from public.payments p
    where p.user_id = me and p.provider = 'eft' and p.plan = p_plan and p.status = 'pending' order by p.created_at desc limit 1;
  if pid is null then
    if (select count(*) from public.payments p where p.user_id = me and p.provider = 'eft' and p.status = 'pending') >= 3 then
      raise exception 'You already have open payments. Finish or wait for those first.';
    end if;
    loop
      ref := 'SC' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
      exit when not exists (select 1 from public.payments where payments.reference = ref);
    end loop;
    insert into public.payments (user_id, provider, plan, amount, currency, reference, status)
      values (me, 'eft', p_plan, info.amount, 'NAD', ref, 'pending') returning payments.id into pid;
  end if;
  return query select p.id, p.reference, p.amount, p.plan, p.status from public.payments p where p.id = pid;
end $$;
revoke execute on function public.request_eft(text) from public, anon;
grant execute on function public.request_eft(text) to authenticated;

-- Attach an uploaded proof of payment to your own pending payment
create or replace function public.attach_proof(p_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if p_path is null or split_part(p_path, '/', 1) <> me::text then raise exception 'Invalid file'; end if;
  update public.payments set proof_path = p_path
    where id = p_id and user_id = me and provider = 'eft' and status = 'pending';
  if not found then raise exception 'Payment not found or already reviewed'; end if;
end $$;
revoke execute on function public.attach_proof(uuid, text) from public, anon;
grant execute on function public.attach_proof(uuid, text) to authenticated;

-- Admin: list EFT payments with who paid
create or replace function public.admin_payments(p_status text default 'pending')
returns table (id uuid, user_id uuid, email text, display_name text, plan text, amount numeric, reference text,
               proof_path text, status text, admin_note text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
    select p.id, p.user_id, u.email::text, pr.display_name, p.plan, p.amount, p.reference, p.proof_path, p.status,
           p.admin_note, p.created_at, p.reviewed_at
    from public.payments p join auth.users u on u.id = p.user_id left join public.profiles pr on pr.id = p.user_id
    where p.provider = 'eft' and (p_status = 'all' or p.status = p_status)
    order by p.created_at desc limit 200;
end $$;
revoke execute on function public.admin_payments(text) from public, anon;
grant execute on function public.admin_payments(text) to authenticated;

-- Admin: activate (mark paid + switch plan on + bonus tokens) or reject
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
revoke execute on function public.admin_review_payment(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_payment(uuid, boolean, text) to authenticated;

-- Proof of payment files: private bucket, one folder per user, admins can read all
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "own proofs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
alter function public._plan_info(text) set search_path = public;
