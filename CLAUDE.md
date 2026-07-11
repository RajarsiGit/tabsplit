# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

TabSplit is a lightweight alternative to Splitwise for splitting recurring shared expenses (roommates, trips). Vite + React frontend, Tailwind CSS, Vercel serverless functions, Neon Postgres. Architecture mirrors `smart-task-manager` (cookie-based JWT auth, `@neondatabase/serverless`, one handler file per resource under `api/`). Licensed under GPL-3.0-or-later (see `LICENSE`).

## Commands

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run dev:api      # vercel dev - serves api/* functions (needs `vercel link` + env pulled)
npm run build        # Production build to dist/
npm run preview      # Preview production build
```

### Environment Variables

```bash
DATABASE_URL=postgresql://...   # Neon Postgres connection string
JWT_SECRET=your_secret_key      # Secret for JWT signing
CRON_SECRET=                    # Set automatically by Vercel Cron; used to authorize api/cron/process-recurring
GITHUB_CLIENT_ID=               # GitHub OAuth App, for "Continue with GitHub" login
GITHUB_CLIENT_SECRET=           # callback URL must be <app-url>/api/auth/github/callback
BLOB_READ_WRITE_TOKEN=          # Vercel Blob store token, for expense receipt uploads
```

### Neon role/ownership gotcha

This project's `DATABASE_URL` connects as a non-owner Postgres role (e.g. `tabsplit`), while the tables live under the database's default `neondb_owner` role. A fresh `CREATE TABLE` run through the app's connection is owned by the creating role and works fine (including `CREATE INDEX` on it), but **`ALTER TABLE` on any of the original tables** (`users`, `groups`, `expenses`, etc.) **fails with `must be owner of table X`** because the app role only has DML grants (SELECT/INSERT/UPDATE/DELETE) on those, not ownership. Schema changes that alter an existing table (as opposed to creating a new one) need to be run from the Neon Console's SQL Editor (which runs as the owner role), not via `psql $DATABASE_URL`.

## Data Model

- `users` — id, name, email, password (bcrypt hash, nullable for GitHub-only accounts), github_id (nullable, unique)
- `groups` — a household or trip; `currency` defaults to INR
- `group_members` — join table, `role` is `owner` or `member`
- `expenses` — one-off charges; `recurring_expense_id` set when materialized from a template; `paid_by` is nullable (NULL for multi-payer expenses — see `expense_payments`); `receipt_url` optional (Vercel Blob URL)
- `expense_splits` — per-user share of an expense; rows are replaced (not updated) whenever an expense's split changes
- `expense_payments` — per-payer contribution to an expense (supports splitting the *payment* itself across more than one payer, e.g. two roommates who split paying for one grocery run); every expense has at least one row here, even single-payer ones — this table, not `expenses.paid_by`, is the source of truth for "who paid what" (see Balance Calculation)
- `recurring_expenses` — templates (rent, subscriptions); always split **equally across all current group members** at generation time — there's no per-template participant list; stay single-payer (materialized `expenses` rows still get exactly one `expense_payments` row)
- `settlements` — manual "I paid you back $X" records between two members
- `group_invites` — one active invite token per group (`UNIQUE` on `group_id`); regenerating replaces the old token outright
- `notifications` — in-app notifications (`user_id`, `group_id`, `type`, `message`, `read_at`)

Schema lives in `schema/schema.sql`. Apply it directly against the Neon database (`psql $DATABASE_URL -f schema/schema.sql`) — there's no migration runner.

## Backend Architecture (`api/*.js`)

One file per resource, method-based routing inside a single `export default handler`, following the reference project's pattern:

- `api/db.js` — `getDb()` (lazy Neon client), `requireAuth(req)` (verifies JWT cookie, throws if missing/invalid), `requireGroupMember(sql, groupId, userId)` (throws if not a member), cookie helpers (auth cookie + a short-lived OAuth `state` cookie for CSRF), CORS helper
- `api/auth.js` — `/api/auth/register|login|logout|me`, routed via `?path=` query param through `vercel.json` rewrites (see reference project's auth.js for the same pattern). Also `/api/auth/github` (redirects to GitHub's authorize URL) and `/api/auth/github/callback` (exchanges the code, finds-or-creates/links a user by `github_id`/email, sets the auth cookie, redirects to `/`). The callback never returns JSON errors — any failure redirects to `/?authError=...` since it's a full-page browser flow, not a fetch call. `me` also returns `has_password`/`has_github` booleans (never the password hash) so the UI knows which account-settings actions are safe to offer. `PUT /api/auth/profile` updates `name`; `PUT /api/auth/password` changes the password (or sets one for a GitHub-only account, skipping the current-password check when none is set yet); `POST /api/auth/github/unlink` disconnects GitHub but is blocked if the account has no password (would lock the user out). The `github/callback` handler also doubles as the **link** flow: if a valid session cookie is already present when it runs (i.e. the user started from the Settings page while logged in, not the login screen), it attaches the GitHub identity to that session's user instead of doing find-or-create/login, and redirects to `/settings?linked=github` (or `/settings?authError=...` on failure) instead of `/`.
- `api/groups.js` — group CRUD, membership (add by email lookup, remove), returns computed `balances` + `settleUp` suggestions on `GET ?id=`; notifies a member when added or when their role changes
- `api/expenses.js` — expense CRUD; owns the split-calculation logic (`splitEqually`, exact-split validation) and the payer-calculation logic (`writePayments`, which validates a `payments: [{userId, amount}]` array sums to the total the same way `writeSplits` validates exact splits); a single `paidBy` in the request body is normalized into a one-entry `payments` array (`normalizePayments`) so every expense — single- or multi-payer — always has `expense_payments` rows; accepts an optional `receiptUrl`; notifies other group members when a new expense is added; exports `splitEqually` for reuse by the cron job
- `api/recurring.js` — recurring expense template CRUD (stays single-payer, no `payments` array)
- `api/settlements.js` — record/undo manual settlements; notifies the counterparty (whichever of `fromUser`/`toUser` isn't the actor) when a settlement is recorded
- `api/balances.js` — `computeBalances(sql, groupId)` (net balance per user, "paid" side summed from `expense_payments` — not `expenses.paid_by` — so multi-payer expenses attribute correctly; plus splits + settlements) and `simplifyDebts(balances)` (greedy min-transaction settle-up suggestions)
- `api/account.js` — always operates on the caller's own account. `GET /api/account` returns a full JSON export (profile, groups, expenses, expense splits, recurring templates, settlements) with a `Content-Disposition: attachment` header, for the Settings page's "Export my data" link. `DELETE /api/account`, body `{ mode: "associated" | "own" }`: `associated` hard-deletes the user row (groups they solely own are deleted outright first; everything else cascades per `schema/schema.sql`'s `ON DELETE CASCADE` rules). `own` hands off sole-owned groups to the longest-tenured other member (or deletes the group if they're the only member), removes the user from every `group_members` row, then scrubs the `users` row in place (name/email/password/github_id) instead of deleting it, so shared expenses/splits/settlements they were part of stay visible to other members.
- `api/recurrence.js` — `nextOccurrence(dateStr, frequency)` date math (weekly/monthly, monthly clamps to end-of-month)
- `api/cron/process-recurring.js` — Vercel Cron target (see `vercel.json` `crons`, runs daily at 06:00 UTC). Materializes any `recurring_expenses` due (`next_occurrence <= CURRENT_DATE`) into real `expenses` rows split across current group members (writing a matching single-payer `expense_payments` row too), then advances `next_occurrence`. Protected by `CRON_SECRET` if set.
- `api/invites.js` — one active invite token per group. `POST ?groupId=X` (owner-only) generates/regenerates the token (upsert on `group_invites`, which has a `UNIQUE` constraint on `group_id`); `DELETE ?groupId=X` (owner-only) revokes it; `GET ?groupId=X` (owner-only) fetches the current token for display; `GET ?token=X` (any authenticated user, deliberately **not** gated by `requireGroupMember` — that's the point) previews the group's name/member count; `POST ?token=X&action=accept` joins the group (idempotent if already a member).
- `api/notifications.js` — exports `createNotification(sql, { userId, groupId, type, message })` for reuse by other handlers, plus `GET /api/notifications` (last 30 + unread count), `POST ?action=read&id=X`, `POST ?action=read-all`.
- `api/blob-upload.js` — implements `@vercel/blob/client`'s `handleUpload` for expense receipt uploads; requires auth, restricts to image content-types, 8MB cap. The frontend uploads directly to Blob via this handler (never proxies the file bytes through a Vercel Function), then passes the resulting URL as `receiptUrl` to `api/expenses.js`.

**Auth**: JWT in an HttpOnly cookie (`auth_token`, 7-day expiry — longer than the reference project's 1h since this isn't a task manager people re-open constantly). `requireAuth` throws; every handler catches and returns 401.

**Authorization**: nearly every group-scoped endpoint calls `requireGroupMember` before touching data — a user must be a member of a group to read or write anything in it. Owner-only actions (editing group name/description/currency, deleting a group, changing another member's role) go through `requireGroupOwner`. `isSoleOwner(sql, groupId, userId)` (in `api/db.js`) guards against demoting or removing a group's last remaining owner — promote another member first.

## Balance Calculation

Net balance per user = (amount they paid across all `expense_payments`) − (their share across all `expense_splits`) + (settlements they sent) − (settlements they received). Positive = owed money; negative = owes money. `simplifyDebts` reduces the full pairwise picture to a minimal set of `{from, to, amount}` transactions using a greedy largest-debtor-to-largest-creditor match — this is what powers the "Settle up" suggestions in the UI, not a literal transaction-by-transaction ledger.

## Frontend Architecture (`src/`)

- `context/AppContext.jsx` — auth state only (`user`, `login`, `register`, `logout`), hydrated from `/api/auth/me` on load
- `utils/api.js` — thin fetch wrapper per resource (`authApi`, `groupsApi`, `expensesApi`, `recurringApi`, `settlementsApi`, `invitesApi`, `notificationsApi`, `accountApi`), all requests use `credentials: 'include'`
- `App.jsx` — route-aware auth gating, not a single top-level gate: every route decides for itself whether it needs a logged-in user. `/invite/:token` renders `AuthScreen` when logged out and `AuthedShell + InviteAccept` when logged in — same URL either way, so logging in through an invite link continues straight to joining the group with no stashed-redirect logic. `/*` renders `AuthedShell + MainRoutes` (`/` → `GroupsList`, `/groups/:id` → `GroupDetail`, `/settings` → `AccountSettings`) when logged in, `AuthScreen` otherwise. `AuthedShell` is the `<Navbar/> + <main>` wrapper shared by both branches.
- `components/GroupDetail.jsx` — tabbed view (Expenses / Recurring / Balances / Insights / Members / Settings) for a single group; owns data loading for all tabs; the Settings tab's owner-only invite-link section (generate/regenerate/revoke, copyable `${origin}/invite/${token}` URL) lives here
- `components/AddExpenseForm.jsx` — participant checkboxes + equal/exact split toggle (exact mode reveals a per-person amount input); a "split the payment too" checkbox reveals a payer checklist + per-payer amount inputs (sent as `payments`) as an alternative to the single `paidBy` select; an optional receipt file input uploads directly to Vercel Blob via `@vercel/blob/client`'s `upload()` against `/api/blob-upload`, then sends the resulting URL as `receiptUrl`
- `components/BalancesSummary.jsx` + `SettleUpForm.jsx` — renders `settleUp` suggestions from the group payload, "Settle" button opens the form pre-filled with that suggestion's from/to/amount
- `components/InsightsTab.jsx` — spend-by-category and paid-by-member bar lists, computed client-side from the group's already-loaded expense list (using each expense's `payments` array so multi-payer expenses attribute correctly); categorical colors assigned by sorted entity name (stable across reloads/filtering) from a validated 8-slot palette, folding any additional entries into a neutral "Other" color
- `components/InviteAccept.jsx` — the `/invite/:token` destination for a logged-in user: calls `invitesApi.accept`, shows "Joining..." then redirects to `/groups/:id`, or shows an error + link home if the token is invalid/revoked
- `components/NotificationsBell.jsx` — badge + dropdown in `Navbar.jsx`, polls `/api/notifications` every 30s; clicking a notification with a `group_id` marks it read and navigates to that group

## Common Pitfalls

1. **Recurring expenses have no participant list** — they always split equally across whoever is a group member when the cron job runs, not whoever was a member when the template was created. Adding/removing members changes future recurring splits.
2. **Split amounts must reconcile to the penny.** `splitEqually` (in `api/expenses.js`) distributes rounding remainder cents to the first N participants; exact splits are validated to sum to the total within 1 cent.
3. **Group membership check runs before every mutation.** If you add a new group-scoped endpoint, call `requireGroupMember` first or the authorization story breaks.
4. **Removing a member is blocked while they have a non-zero balance** (see `api/groups.js` DELETE `?action=members`) — settle up first.
5. **`expense_splits` rows are replaced, not patched**, on any split-affecting update — always delete-then-insert, never try to diff old vs. new splits.
6. **Neon tagged-template queries only** — build queries with `` sql`...${value}...` ``, never interpolate raw strings into the query text.
7. **`expense_payments` rows are replaced, not patched**, on any payer-affecting update — same delete-then-insert rule as `expense_splits`. Every expense must have at least one `expense_payments` row (even single-payer ones) or `computeBalances` will silently undercount what that expense's payer(s) are owed.
8. **A group's invite token is singular** (`group_invites.group_id` is `UNIQUE`) — regenerating overwrites the existing row via `ON CONFLICT (group_id) DO UPDATE`, it doesn't create a second active link.
