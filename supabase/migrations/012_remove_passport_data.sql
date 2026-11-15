-- 012: the app no longer collects passport details (removed 2026-11-15).
-- Clear what was stored earlier and stop clients from writing these columns again.
update public.profiles set passport_country = null, passport_expiry = null
  where passport_country is not null or passport_expiry is not null;
revoke update (passport_country, passport_expiry) on public.profiles from authenticated;
