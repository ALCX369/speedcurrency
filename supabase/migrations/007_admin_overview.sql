-- Admin dashboard numbers (admins only)
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m timestamptz := date_trunc('month', now()); r jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select jsonb_build_object(
    'pending', (select count(*) from payments where provider = 'eft' and status = 'pending'),
    'pending_with_proof', (select count(*) from payments where provider = 'eft' and status = 'pending' and proof_path is not null),
    'revenue_month', (select coalesce(sum(amount), 0) from payments where status = 'paid' and reviewed_at >= m),
    'revenue_total', (select coalesce(sum(amount), 0) from payments where status = 'paid'),
    'paid_count_month', (select count(*) from payments where status = 'paid' and reviewed_at >= m),
    'members', (select count(*) from profiles),
    'new_members_month', (select count(*) from profiles where created_at >= m),
    'premium', (select count(*) from profiles where plan = 'premium' and premium_until > now()),
    'pro', (select count(*) from profiles where plan = 'pro' and premium_until > now()),
    'expiring_7d', (select count(*) from profiles where plan in ('premium','pro') and premium_until between now() and now() + interval '7 days'),
    'q_month', (select count(*) from planner_messages where role = 'assistant' and created_at >= m),
    'q_claude_haiku', (select count(*) from planner_messages where role = 'assistant' and created_at >= m and data->>'model' like 'claude-haiku%'),
    'q_claude_sonnet', (select count(*) from planner_messages where role = 'assistant' and created_at >= m and data->>'model' like 'claude-sonnet%'),
    'q_gemini', (select count(*) from planner_messages where role = 'assistant' and created_at >= m and data->>'model' like 'gemini%'),
    'reviews_month', (select count(*) from place_reviews where created_at >= m),
    'reports_open', (select count(*) from reports where created_at >= now() - interval '30 days'),
    'recent', (select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) from (
        (select jsonb_build_object('at', created_at, 'kind', 'signup', 'text', coalesce(display_name, 'New member') || ' joined' || coalesce(' from ' || home_country, '')) x from profiles order by created_at desc limit 8)
        union all
        (select jsonb_build_object('at', created_at, 'kind', 'payment', 'text', 'Payment ' || reference || ' · N$' || amount || ' · ' || status) from payments where provider = 'eft' order by created_at desc limit 8)
        union all
        (select jsonb_build_object('at', created_at, 'kind', 'review', 'text', 'Review of ' || place_name || ' (' || rating || '★)') from place_reviews order by created_at desc limit 5)
      ) t)
  ) into r;
  return r;
end $$;
revoke execute on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
