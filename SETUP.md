# SpeedCurrency app – setup (free services only)

The app lives in `app/` and is live at https://alcx369.github.io/speedcurrency/app/
Supabase project: `speedcurrency` (ref wuhrbpuwjwmlnmvvkcaa, London). Database, photo storage and the register, planner and dpo functions are already set up.
Until step 1–2 are done it runs in **demo mode** (data stays on the device).

| Service | Used for | Free plan |
|---|---|---|
| GitHub Pages | hosting the app | free |
| Supabase | accounts, database, photos, server functions | 500 MB database, 1 GB photos, 50,000 users/month, 500,000 function calls/month; pauses after 7 days with no visits |
| Puter.js + Perplexity Sonar | the AI planner with live web search | no API keys; each user signs in to a free Puter account and uses their own free AI allowance |
| OpenFreeMap + MapLibre | map | free, no key |
| Photon (komoot) | place search | free, fair use |
| country.is | detects home country at sign-up | free, no key |
| DPO Pay | Premium payments | fee per payment only |

## 1. Supabase
1. Create a free project at supabase.com.
2. SQL Editor → paste `supabase/migrations/001_init.sql` → Run.
3. Authentication → URL configuration → Site URL: `https://alcx369.github.io/speedcurrency/app/`
4. Project Settings → API: copy the **Project URL** and **anon public key** into `app/config.js`.

## 2. Server functions and keys
Install the Supabase CLI, then from this folder:
```
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy register
supabase functions deploy planner
supabase functions deploy dpo
```
The planner no longer needs keys: it runs in the browser through Puter.js (the `planner` server function is kept as an optional backup that uses Gemini + Tavily keys).

## 3. Payments (after DPO approves the merchant account)
```
supabase secrets set DPO_COMPANY_TOKEN=... DPO_SERVICE_TYPE=... PRICE_MONTHLY=129 PRICE_YEARLY=1099
```
Ask DPO to also enable recurring payments (tokenisation) for automatic monthly renewals.

## 4. Ads
Free users see the ALCX369 shop ad. Google AdSense (publisher `ca-pub-3155975488847083`) only serves on a domain you own,
so after connecting your own domain and getting it approved, put the ad unit ID in `ADSENSE_SLOT` in `app/config.js`.

## Keep the free Supabase project awake
Free projects pause after 7 days without visits. Normal daily use keeps it awake.
