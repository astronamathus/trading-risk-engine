# Setup Guide

Everything you need to go from a fresh fork to a running instance.

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is fine)
- A Google Cloud project with OAuth enabled (for sign-in)
- Git

---

## 1. Fork and clone

Fork the repo on GitHub, then clone your fork:

```bash
git clone https://github.com/YOUR_USERNAME/trading-risk-engine.git
cd trading-risk-engine
npm install
```

---

## 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Pick a region close to your users and set a strong database password — save it somewhere.
3. Wait for the project to finish provisioning (~1 min).

---

## 3. Run the SQL migrations

Open the Supabase Dashboard → **SQL Editor** and run each of the following files **in order**. 
Each one is a separate paste-and-run — do not combine them.

> All SQL files are in the `/sql` folder of the repo (or provided separately if you received them as outputs).

### Order to run:

1. **Core schema** — creates `trader_users`, `trades`, `org_memberships`, `org_groups`, `org_group_members`, `org_invites`
2. **`create_portfolio_snapshots.sql`** — creates `portfolio_snapshots` table, RLS policies, and the `record_portfolio_snapshot` RPC
3. **`add_capital_limit.sql`** — adds `capital_limit` and `user_r_ratio` columns to `trader_users`, creates `set_user_capital_limit` RPC
4. **`supabase/migrations/202610240001_market_currency_pools.sql`** — adds a `currency` column to trades (existing trades default to INR) and a separate USD capital limit (`capital_limit_usd`, default $10,000). Run this after the core schema and capital-limit migration.\n5. **All RPC functions** — `get_org_leaderboard`, `get_org_groups`, `set_group_member`, `remove_group_member`, `create_group`, `rename_group`, `delete_group`, `toggle_leaderboard_visibility`

After running, confirm the tables exist under **Database → Tables**.

---

## 4. Configure Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Navigate to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Under **Authorised redirect URIs**, add:
   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```
   (You can find your project ref in the Supabase Dashboard URL)
6. Copy the **Client ID** and **Client Secret**
7. In Supabase Dashboard → **Authentication → Providers → Google**, paste both values and enable the provider

---

## 5. Set environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://oqoheufzznastnklispq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xb2hldWZ6em5hc3Rua2xpc3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mzk1NTAsImV4cCI6MjA5NTIxNTU1MH0.evwu4YfUqm6_cOXhAd3pAL0vWlpLvOKs46k9XOqRfoQ

```

Both values are in Supabase Dashboard → **Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `anon` / `public` key (not the service role key)

That's it — there are no other required environment variables. Prices are fetched from Yahoo Finance with no API key needed.

---

## 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sign in with Google, complete onboarding, and the app is ready to use.

---

## 7. Deploy to Vercel

1. Push your fork to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. In **Environment Variables**, add the same two vars from your `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
4. Deploy

Once deployed, go back to **Supabase → Authentication → URL Configuration** and add your Vercel domain to the **Redirect URLs** list:
```
https://your-app.vercel.app/auth/callback
```

Also add it to your Google OAuth authorised redirect URIs (same as step 4 but with your Vercel domain instead of localhost).

---

## 8. Deploy the Edge Functions (portfolio equity curve)

These are optional but required for the historical equity curve to work.

Install the Supabase CLI:
```bash
brew install supabase/tap/supabase   # macOS
# or: npx supabase
```

Link to your project:
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Deploy both functions:
```bash
supabase functions deploy daily-snapshot --no-verify-jwt
supabase functions deploy backfill-snapshots --no-verify-jwt
```

Run the one-time backfill (reconstructs historical data from your first trade):
```bash
supabase functions invoke backfill-snapshots --no-verify-jwt
```

Schedule the daily snapshot in Supabase Dashboard → **Edge Functions → daily-snapshot → Schedules**:
```
Cron: 0 10 * * 1-5
```
(Runs Monday–Friday at 10:00 UTC = 15:30 IST, right after NSE market close)

---

## Summary of .env.local

```env
# Required — from Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://oqoheufzznastnklispq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xb2hldWZ6em5hc3Rua2xpc3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mzk1NTAsImV4cCI6MjA5NTIxNTU1MH0.evwu4YfUqm6_cOXhAd3pAL0vWlpLvOKs46k9XOqRfoQ

```

No other API keys are needed. Yahoo Finance prices are fetched without authentication via the `/api/search-stocks` route.

---

## Troubleshooting

**Sign in doesn't redirect back correctly**
→ Make sure your Vercel/localhost URL is listed in both Supabase Redirect URLs and Google OAuth authorised redirect URIs.

**"Missing Supabase env vars" error on startup**
→ Check `.env.local` exists at the project root and both vars are set. Restart the dev server after editing it.

**Prices not loading**
→ Yahoo Finance occasionally rate-limits. The app retries automatically; if it persists, wait a minute and refresh.

**Equity curve is flat or empty**
→ Run the backfill function: `supabase functions invoke backfill-snapshots --no-verify-jwt`. The daily snapshot only runs going forward from when it's first deployed.

**Groups tab shows 0 members after assigning**
→ Make sure you've run the latest SQL migrations — the `org_group_members` table needs to exist and the RPC functions need to be deployed.