-- ☥ ALCX · 3·6·9 · life path 33/6 · love, peace, 520 741 8
-- 017: the comment speed-limit helper runs only as a trigger; nobody may call it directly through the API.
revoke execute on function public.place_comments_rate_limit() from public, anon, authenticated;
