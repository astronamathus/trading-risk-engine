## Repository
**GitHub:** `https://github.com/astronamathus/trading-risk-engine`
**Deployment:** `https://trading-risk-engine.vercel.app`
**Stack:** Next.js 16.2, React 19, TypeScript, Tailwind CSS v4, Supabase Auth + DB, Recharts, Vercel

---

## What the app does
Trade Risk Manager is a position sizing calculator and trade journal for Indian equity markets (NSE/BSE). The core philosophy is risk-first trading: define your maximum acceptable loss before entry, and the tool calculates position size, capital required, and monitors trade lifecycle automatically.

Two user modes:
- **Indie** — private solo portfolio, no org features
- **Organisation** — trading desk with admin oversight, group leaderboards, member management

---

## Database: Supabase

### Tables
| Table | Purpose |
|---|---|
| `trader_users` | One row per user. Fields: `id`, `auth_user_id`, `anonymous_id`, `display_name`, `avatar_url`, `user_type`, `org_id` (legacy), `org_role` (legacy) |
| `trades` | Trade records. Soft-delete fields: `deleted_at`, `deleted_by`, `delete_reason` |
| `organisations` | `id`, `name`, `slug`, `domain` |
| `org_memberships` | Junction table (multi-org): `user_id`, `org_id`, `org_role` (`owner`/`admin`/`member`), `on_leaderboard` (bool), `joined_at` |
| `org_invites` | Invite codes: `code`, `role`, `expires_at`, `max_uses`, `use_count` |
| `org_groups` | Groups within orgs: `id`, `org_id`, `name`, `created_by` |
| `org_group_members` | Junction: `group_id`, `user_id`, `org_id`. Unique `(user_id, org_id)` — one group per member per org |
| `trade_audit_log` | Append-only log of all admin edits/deletes on trades |

### RLS Status
| Table | RLS | Notes |
|---|---|---|
| `trader_users` | **DISABLED** | Infinite recursion on INSERT with policies. Re-enable after removing dummy accounts |
| `trades` | **DISABLED** | Dummy accounts have no `auth_user_id`. Re-enable after removing dummy accounts |
| `organisations` | **ENABLED** | `postgres_bypass` policy allows RPC inserts |
| `org_memberships` | **ENABLED** | `postgres_bypass` policy allows RPC writes |
| `org_invites` | **ENABLED** | Admins manage via RLS policy |
| `org_groups` | No RLS | Mutations via RPCs |
| `org_group_members` | No RLS | Mutations via RPCs |
| `trade_audit_log` | **ENABLED** | |

**To re-enable after removing demo data:**
```sql
alter table trades       enable row level security;
alter table trader_users enable row level security;
```

### Helper functions
```sql
auth_trader_id()                    -- resolves auth.uid() → trader_users.id
auth_org_roles                      -- security-definer view: caller's org memberships
trader_users_admin_visible(uuid)    -- security-definer fn for admin member reads
```

### Security-definer RPCs (all owned by `postgres`)
| RPC | Purpose |
|---|---|
| `create_org_with_owner(name, domain)` | Creates org + owner membership atomically |
| `validate_and_accept_invite(code)` | Accepts invite — enforces expiry, max uses, domain |
| `promote_member(member_id, org_id, new_role)` | Promotes/demotes, blocks self-promotion |
| `remove_member(member_id, org_id)` | Removes from org, resets to indie if no orgs remain |
| `update_own_trade(trade_id, qty, sl, target, notes)` | User edits allowed fields only, audited |
| `admin_soft_delete_trade(trade_id, org_id, reason)` | Admin soft-deletes trade, audited |
| `get_org_leaderboard(org_id, sort)` | Ranks only to members, full metrics to admins |
| `get_group_leaderboard(group_id, sort)` | Same but scoped to a group. Also used by org/settings to resolve group membership (returns rows with user_id) |
| `get_org_members_with_profiles(org_id)` | Members with display_name/avatar (no admin API) |
| `get_org_groups(org_id)` | Groups visible to caller. Returns `is_my_group` for the calling user only — does NOT return a full user→group map |
| `create_group(org_id, name)` | Admin creates a group |
| `rename_group(group_id, new_name)` | Admin renames a group |
| `delete_group(group_id)` | Admin deletes group, cascades members |
| `set_group_member(group_id, member_id)` | Adds/moves member to group (upsert) |
| `remove_group_member(group_id, member_id)` | Removes member from group |
| `toggle_leaderboard_visibility(org_id, show)` | User opts in/out of leaderboard |
| `rename_organisation(org_id, new_name)` | Owner or admin renames org |
| `delete_organisation(org_id)` | Owner only — resets all members to indie, cascades |

### ⚠️ Group membership reads — important pattern
**Never query `org_group_members` directly from the client.** Even though the table has no RLS, direct client queries return `[]` in practice. Always resolve group membership via `get_group_leaderboard`:

```typescript
// ✅ Correct — used in org/settings/page.tsx
await Promise.all(
  groupList.map(async (g) => {
    const { data } = await supabase.rpc("get_group_leaderboard", {
      p_group_id: g.id,
      p_sort: "lifetime_pnl",
    });
    if (data?.ok && Array.isArray(data.rows)) {
      data.rows.forEach((row) => {
        groupMap[row.user_id] = { group_id: g.id, group_name: g.name };
      });
    }
  })
);

// ❌ Wrong — returns [] silently
await supabase.from("org_group_members").select("user_id, group_id").eq("org_id", orgId);
```

---

## Migrations Applied (in order)
1. `001_multi_org_hardening.sql` — schema, initial RLS, RPCs
2. `002_fix_rls_recursion.sql` — first recursion fix (superseded by 003)
3. `003_fix_recursion_final.sql` — final recursion fix, `auth_org_roles` view, `trader_users_admin_visible()`
4. `004_reset_users_to_onboarding.sql` — wipes all users to `user_type = null`
5. `005_fix_invites_rls.sql` — `alter table org_invites disable row level security` (later re-enabled)
6. `006_org_delete_and_rename.sql` — `delete_organisation` and `rename_organisation` RPCs
7. `007_leaderboard_optin.sql` — `on_leaderboard` column, `toggle_leaderboard_visibility` RPC
8. `008_groups.sql` — `org_groups`, `org_group_members` tables + all group RPCs
9. `009_super_admin.sql` — `org_groups`, `org_group_members` Adds three SECURITY DEFINER RPCs for platform-level super admin.
10. `010_super_admin.sql` — `org_groups`, `org_group_members` Backfill role = 'admin' for all existing org owners
      `migrations/010_currency.sql`  — `org_groups`, `org_group_members` Added US Currency and Stocks
11. `011_scope_super_admin_to_own_orgs.sql` — `org_groups`, `org_group_members` Replaces the four super_admin_* RPCs so they only operate on orgs the caller is a member of. Super admins are multi-org owners — not platform gods with access to everyone's data.
12. `012_co_owner_and_invisibility.sql` — `org_groups`, `org_group_members` exclude super admins (role = 'admin') so they're invisible to regular members, org owners, and the leaderboard.
13. `013_fix_set_active_org.sql` — `org_groups`, `org_group_members` Fixes: "new row for relation trader_users violates check constraint trader_users_org_role_check"
14. `014_fix_delete_org.sql` — `org_groups`, `org_group_members` Fixes: "new row for relation trader_users violates check constraint trader_users_org_role_check"
15. `015_fix_delete_org_fk.sql` — `org_groups`, `org_group_members` Fixes: "update or delete on table organisations violates foreign key constraint trader_users_org_id_fkey"

### Recommended indexes (not yet applied — add when ledger grows)
```sql
-- Most important: every query filters by user_id
CREATE INDEX idx_trades_user_id ON trades(user_id);

-- Speeds up the soft-delete filter (deleted_at IS NULL)
CREATE INDEX idx_trades_user_active ON trades(user_id, deleted_at)
  WHERE deleted_at IS NULL;

-- Speeds up status filtering (OPEN/QUEUED for live price fetching)
CREATE INDEX idx_trades_user_status ON trades(user_id, status);
```

---

## User Model

### `AppUser` (lib/auth.ts)
```typescript
interface AppUser {
  id:        string;   // trader_users.id
  authId:    string;   // auth.users.id
  email:     string;
  name:      string;
  avatarUrl: string | null;
  role:      "user" | "admin";
  userType:  "indie" | "org_member" | "org_admin" | null; // null = needs onboarding
  orgId:     string | null;  // legacy column, kept for routing fallback
}
```

### User tiers
| `userType` | Access |
|---|---|
| `null` | Not yet onboarded → redirect to `/onboarding` |
| `"indie"` | Own trades/dashboard only, no org features |
| `"org_member"` | Own trades + group leaderboard (rank + trade counts only) |
| `"org_admin"` | Everything + team view, admin trade actions, settings, groups |

### Org roles (`org_memberships.org_role`)
- `owner` — full control, rename/delete org, demote admins
- `admin` — same as owner except rename/delete org
- `member` — standard trader

---

## Auth Flow
1. Google OAuth → Supabase → `/auth/callback`
2. `ensureAuthUser()` in `lib/auth.ts` — creates/loads `trader_users` row, saves `display_name` and `avatar_url` on every login
3. `AuthProvider` redirects `userType === null` → `/onboarding`
4. Allowed paths during onboarding (no redirect): `/onboarding`, `/org/new`, `/org/setup`, `/join/*`

### Anonymous usage
- `lib/user.ts` stores UUID in `localStorage` under `trm_anonymous_id`
- On first login, `migrateAnonymousTrades()` re-assigns trades to the real user
- Anon `trader_users` row (no `auth_user_id`) is then deleted

---

## Onboarding Flow (`app/onboarding/page.tsx`)
Multi-step, `useSearchParams` wrapped in `<Suspense>`:
1. **Pick type** — "I trade solo" / "I'm part of a firm"
2. Solo → confirm → `setIndieUser()` → `/dashboard`
3. Firm → **Create org** → `/org/new` OR **Join** → enter invite code → `/join/[code]`
- Nav "Join an organisation" routes to `/onboarding?step=org_pick`

---

## Key Pages

| Route | Purpose | Auth required |
|---|---|---|
| `/` | Calculator | No (anonymous OK) |
| `/dashboard` | Portfolio analytics | Yes |
| `/ledger` | Trade ledger | Yes |
| `/auth` | Google sign-in | No |
| `/auth/callback` | OAuth callback | No |
| `/onboarding` | First-login user type selection | Yes |
| `/org/new` | Create organisation | Yes (unboarded) |
| `/org/settings` | Invite generation, member management, groups tab, danger zone | `org_admin` |
| `/org/admin` | Team overview, per-member trade tables, soft-delete | `org_admin` |
| `/leaderboard` | Group-scoped leaderboard | Yes (org member) |
| `/join/[code]` | Invite acceptance | Yes |

**Note:** `app/join/[code]/page.tsx` must use square brackets for the dynamic route.

**Note:** `/org/groups` has been merged into `/org/settings` (Groups tab). The standalone groups page is deprecated.

---

## Key Components

| Component | Notes |
|---|---|
| `AuthProvider` | Loads user, redirects unboarded users, exposes `refresh()` |
| `ThemeProvider` | `light`/`dark`/`system` — initialises from localStorage synchronously to prevent flash. Default: `system` |
| `NavBar` | Theme picker in dropdown, org links for admins, "Join org" for non-admins |
| `Ledger` | Full trade table — delete removed for regular users |
| `CalculatorForm` | Ticker search, LTP fetch, entry/SL inputs. Settings icon is a rounded hexagon + inner circle (inline SVG, `SettingsIcon` component) |
| `ResultsPanel` | Position size output with capital limit controls |
| `FloatingBar` | Sticky dashboard stats: portfolio value, lifetime P&L, risk %, avg R |
| `SummaryCards` | 4 cards: Total P&L, Win Rate, Avg R, Portfolio counts |
| `EquityCurve` | Area chart cumulative realised P&L + monthly P&L chips |
| `TradeHealth` | Toggle open health categories / closed trade history |
| `RiskTable` | Toggle open risk table / closed history, both sortable |
| `RiskPieChart` | Donut chart of open positions by risk amount |

---

## Theme System
- **Tailwind v4** — no `tailwind.config.ts`. Dark mode via `@variant dark (&:where(.dark, .dark *))` in `globals.css`
- Blocking `<script>` in `layout.tsx` reads `trm_theme` from localStorage before React hydrates
- `ThemeProvider` initialises `useState` from `localStorage` synchronously (no flash)
- Default for new users: `system` (follows OS `prefers-color-scheme`)
- All components use `dark:` variants — e.g. `bg-white dark:bg-slate-800/50`

---

## lib/db Files

### `lib/db/trades.ts` exports
- `saveTrade`, `getTrades`, `closeTrade`, `activateTrade`, `updateTradeStatus`
- `updateOwnTrade(tradeId, fields)` — calls `update_own_trade` RPC (allowed: qty, SL, target, notes)
- `deleteTrade` **REMOVED** — hard deletes blocked by RLS. Use `adminSoftDeleteTrade` from org.ts

### `lib/db/org.ts` exports
- `createOrganisation`, `setIndieUser`, `createInvite`, `getInviteByCode`, `acceptInvite`
- `getOrgMembers`, `promoteMember`, `demoteMember`, `removeMember`
- `getUserOrg` — tries `org_memberships` first, falls back to legacy `org_id` column
- `adminSoftDeleteTrade(tradeId, orgId, reason)` — calls RPC, reason required, audited
- `renameOrganisation`, `deleteOrganisation`
- `toggleLeaderboardVisibility`

---

## Trade Model
```typescript
interface Trade {
  id, user_id, ticker, entry_price, entry_target, stop_loss, target,
  quantity, risk_amount, capital, exit_price, realised_pnl, notes,
  status: "QUEUED" | "OPEN" | "CLOSED" | "STOPPED" | "TARGET_HIT",
  created_at,
  deleted_at, deleted_by, delete_reason  // soft-delete fields
}
```

**Trade rules:**
- Regular users: edit `quantity`, `stop_loss`, `target`, `notes` via `updateOwnTrade` RPC only
- Regular users: cannot delete (blocked by `no_hard_delete_trades` RLS policy)
- Org admins: soft-delete via `adminSoftDeleteTrade` — requires reason, creates audit log

---

## Leaderboard
- **Members** see: rank, display_name, avatar, trade counts only
- **Admins** see: above + lifetime P&L, monthly P&L, win rate, avg R
- **Admins/owners** hidden by default (`on_leaderboard = false`)
- Opt-in/out via "Join leaderboard" toggle on leaderboard page
- **Group-scoped** — must be in a group to appear; admins switch between groups via tabs

## Groups
- One group per member per org (`unique(user_id, org_id)` on `org_group_members`)
- Admins create/rename/delete groups, assign members via the **Groups tab in `/org/settings`**
- Members auto-land on their own group's leaderboard
- No groups = leaderboard shows "Create groups" prompt for admins
- Group membership for the settings page is resolved via `get_group_leaderboard` RPC (see ⚠️ above)

---

## Performance notes
`getTrades` currently fetches all trades with no limit. When the ledger grows:
1. Add the indexes above first (biggest gain, zero code change)
2. Add `.range(from, from + pageSize - 1)` to `getTrades` for pagination
3. The 15-min poll in `app/ledger/page.tsx` should eventually only re-fetch `OPEN`/`QUEUED` trades, not the full history
4. `fetchLivePrices` already deduplicates by ticker — no change needed there

---

## Demo Data
6 dummy `trader_users` with no `auth_user_id` (display-only, cannot sign in).
`anonymous_id = id` used as NOT NULL placeholder.
**Why RLS is disabled on `trader_users` and `trades`.**

Delete a dummy user:
```sql
delete from org_group_members where user_id = 'USER_ID';
delete from org_memberships   where user_id = 'USER_ID';
delete from trades            where user_id = 'USER_ID';
delete from trader_users      where id      = 'USER_ID';
```

---

## Known Issues / Debt
- `trader_users` and `trades` have RLS disabled (demo data workaround)
- `org_id` / `org_role` on `trader_users` are legacy — source of truth is `org_memberships`. RPCs keep them in sync. Safe to drop once nothing reads them directly.
- `org/setup/page.tsx` is superseded by `org/new/page.tsx`
- `org/groups/page.tsx` is superseded by the Groups tab in `org/settings/page.tsx`
- Light mode: all pages have been patched with `dark:` variants. If any new components are added, use `bg-white dark:bg-slate-800/50` pattern throughout.
- `getTrades` has no pagination yet — will become slow at large trade counts (see Performance notes)

---

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Service role key is NOT in the codebase. All privileged operations go through security-definer RPCs.

---

## What to build next
- Server-side price monitoring via Vercel Cron (trade automation without browser open)
- Trailing stop / editable stop loss on open trades
- Portfolio-level risk limits (total deployed capital cap enforcement)
- Admin edit trade fields UI (`admin_edit_trade` RPC already exists in migration 001, no UI yet)
- Org invite revocation UI in settings
- Full audit log viewer for admins
- Pagination for `getTrades` + ledger UI (see Performance notes)
