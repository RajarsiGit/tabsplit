# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

TabSplit is a lightweight alternative to Splitwise for splitting recurring shared expenses (roommates, trips). Vite + React frontend, Tailwind CSS, Vercel serverless functions, Neon Postgres. Architecture mirrors `smart-task-manager` (cookie-based JWT auth, `@neondatabase/serverless`, one handler file per resource under `api/`).

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
```

## Data Model

- `users` — id, name, email, password (bcrypt hash)
- `groups` — a household or trip; `currency` defaults to USD
- `group_members` — join table, `role` is `owner` or `member`
- `expenses` — one-off charges; `recurring_expense_id` set when materialized from a template
- `expense_splits` — per-user share of an expense; rows are replaced (not updated) whenever an expense's split changes
- `recurring_expenses` — templates (rent, subscriptions); always split **equally across all current group members** at generation time — there's no per-template participant list
- `settlements` — manual "I paid you back $X" records between two members

Schema lives in `schema/schema.sql`. Apply it directly against the Neon database (`psql $DATABASE_URL -f schema/schema.sql`) — there's no migration runner.

## Backend Architecture (`api/*.js`)

One file per resource, method-based routing inside a single `export default handler`, following the reference project's pattern:

- `api/db.js` — `getDb()` (lazy Neon client), `requireAuth(req)` (verifies JWT cookie, throws if missing/invalid), `requireGroupMember(sql, groupId, userId)` (throws if not a member), cookie helpers, CORS helper
- `api/auth.js` — `/api/auth/register|login|logout|me`, routed via `?path=` query param through `vercel.json` rewrites (see reference project's auth.js for the same pattern)
- `api/groups.js` — group CRUD, membership (add by email lookup, remove), returns computed `balances` + `settleUp` suggestions on `GET ?id=`
- `api/expenses.js` — expense CRUD; owns the split-calculation logic (`splitEqually`, exact-split validation); exports `splitEqually` for reuse by the cron job
- `api/recurring.js` — recurring expense template CRUD
- `api/settlements.js` — record/undo manual settlements
- `api/balances.js` — `computeBalances(sql, groupId)` (net balance per user from expenses + splits + settlements) and `simplifyDebts(balances)` (greedy min-transaction settle-up suggestions)
- `api/recurrence.js` — `nextOccurrence(dateStr, frequency)` date math (weekly/monthly, monthly clamps to end-of-month)
- `api/cron/process-recurring.js` — Vercel Cron target (see `vercel.json` `crons`, runs daily at 06:00 UTC). Materializes any `recurring_expenses` due (`next_occurrence <= CURRENT_DATE`) into real `expenses` rows split across current group members, then advances `next_occurrence`. Protected by `CRON_SECRET` if set.

**Auth**: JWT in an HttpOnly cookie (`auth_token`, 7-day expiry — longer than the reference project's 1h since this isn't a task manager people re-open constantly). `requireAuth` throws; every handler catches and returns 401.

**Authorization**: nearly every group-scoped endpoint calls `requireGroupMember` before touching data — a user must be a member of a group to read or write anything in it.

## Balance Calculation

Net balance per user = (amount they paid across all expenses) − (their share across all expense_splits) + (settlements they sent) − (settlements they received). Positive = owed money; negative = owes money. `simplifyDebts` reduces the full pairwise picture to a minimal set of `{from, to, amount}` transactions using a greedy largest-debtor-to-largest-creditor match — this is what powers the "Settle up" suggestions in the UI, not a literal transaction-by-transaction ledger.

## Frontend Architecture (`src/`)

- `context/AppContext.jsx` — auth state only (`user`, `login`, `register`, `logout`), hydrated from `/api/auth/me` on load
- `utils/api.js` — thin fetch wrapper per resource (`authApi`, `groupsApi`, `expensesApi`, `recurringApi`, `settlementsApi`), all requests use `credentials: 'include'`
- `App.jsx` — auth gate (null user → `AuthScreen`) then two routes: `/` (`GroupsList`) and `/groups/:id` (`GroupDetail`)
- `components/GroupDetail.jsx` — tabbed view (Expenses / Recurring / Balances / Members) for a single group; owns data loading for all four tabs
- `components/AddExpenseForm.jsx` — participant checkboxes + equal/exact split toggle; exact mode reveals a per-person amount input
- `components/BalancesSummary.jsx` + `SettleUpForm.jsx` — renders `settleUp` suggestions from the group payload, "Settle" button opens the form pre-filled with that suggestion's from/to/amount

## Common Pitfalls

1. **Recurring expenses have no participant list** — they always split equally across whoever is a group member when the cron job runs, not whoever was a member when the template was created. Adding/removing members changes future recurring splits.
2. **Split amounts must reconcile to the penny.** `splitEqually` (in `api/expenses.js`) distributes rounding remainder cents to the first N participants; exact splits are validated to sum to the total within 1 cent.
3. **Group membership check runs before every mutation.** If you add a new group-scoped endpoint, call `requireGroupMember` first or the authorization story breaks.
4. **Removing a member is blocked while they have a non-zero balance** (see `api/groups.js` DELETE `?action=members`) — settle up first.
5. **`expense_splits` rows are replaced, not patched**, on any split-affecting update — always delete-then-insert, never try to diff old vs. new splits.
6. **Neon tagged-template queries only** — build queries with `` sql`...${value}...` ``, never interpolate raw strings into the query text.
