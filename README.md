# TabSplit

A lightweight alternative to Splitwise for splitting recurring shared expenses with roommates and travel groups — no ads, no bloat. Built with React, Vite, Tailwind CSS, Vercel serverless functions, and Neon Postgres.

## Features

- **Groups**
  - Create a group for each household or trip, with its own currency (picked from a curated list of ~25 common currencies)
  - Edit a group's name, description, or currency later from its **Settings** tab (owner-only)
  - Add members by email (they must already have a TabSplit account)
  - Members can leave; owners can remove others — blocked while a balance is outstanding
  - Owners can delete a group outright, removing all its expenses, recurring templates, settlements, and members
  - Owners can promote another member to owner or demote a co-owner back to member — the last remaining owner can't be demoted or removed until someone else is promoted
  - **Archive** a group to hide it from your default groups list without deleting anything — unarchive any time (owner-only); a "Show archived groups" toggle on the dashboard reveals them again
  - Add **custom categories** on top of the built-in defaults, scoped to that group, from its Settings tab (any member can add one; owners can remove them)
  - Set a **monthly budget** — for the whole group or per-category — from its Settings tab (owner-only to add/remove, visible to everyone); everyone in the group gets notified once a budget's month-to-date spend goes over the limit
  - A per-group **Activity** feed on the Settings tab shows that group's recent notification-worthy events in one shared view

- **Deleting things**
  - Any group member can delete an individual expense, recurring template, or settlement
  - Owners can delete the group itself (Settings tab, with a confirmation step)

- **Expenses**
  - Log one-off expenses with description, amount, category, and date
  - **Edit an existing expense** — the same form used to add one, prefilled, including its split and payer setup
  - **Duplicate an existing expense** — prefills a fresh "Add expense" form from it (dated today), for near-identical repeat purchases that don't fit a recurring template's fixed cadence
  - Split **equally**, enter **exact** custom amounts per person, split by **percentage** (per-person `%` inputs, validated to add up to 100), or split **itemized** — break a receipt into individual line items, each with its own subset of participants, and let TabSplit total up who owes what
  - Rounding remainders are distributed automatically so splits always add up to the penny
  - **Split the payment itself** across more than one payer (e.g. two roommates who split fronting the cost of one grocery run) instead of a single "paid by"
  - Tag an expense as **paid in a different currency** — record the original foreign amount/currency alongside the group-currency amount, purely for your own reference (the group-currency amount is always what's actually split and balanced)
  - Attach a **receipt photo** to an expense (uploaded directly to Vercel Blob storage)
  - **Comment** on an expense — any group member can post one, and only the author can remove their own
  - Search, filter by category and date range, and sort a group's expense list (by date or amount); a sidebar **All Expenses** page does the same across every group you're in, with an added "paid by me" filter and a per-currency total
  - **Export a group's expenses as CSV** from its Expenses tab

- **Invite links**
  - Group owners can generate a shareable invite link from the group's Settings tab
  - Anyone who opens it (registering or logging in first, if needed) joins the group automatically
  - Regenerate to invalidate the old link, or revoke it entirely

- **Notifications & activity**
  - In-app notification bell in the sidebar, plus a full **Activity** page for browsing further back — no email required
  - Notified when you're added to a group, your role changes, a new expense or comment is logged, someone records a settlement with you or nudges you about one you owe, a group's budget is exceeded for the month, or you have an outstanding balance a weekly reminder job flags
  - Unread badge count, mark one or all as read
  - Beyond notifications aimed at you, **every action you or anyone else takes is logged as activity** too — edits and deletes, category/budget changes, invite links, membership changes, and more — so your personal Activity page and each group's Settings → Activity section double as a full audit trail, not just a notification list. Your own actions show up already marked read, so they don't set off the bell badge

- **Insights**
  - A group's **Insights** tab shows spend-by-category and paid-by-member bar charts, computed from that group's expenses
  - The **Dashboard** adds a spend-over-time chart (last 6 months) alongside net balance, total spent, spend-by-category, and balance-by-group, one section per currency your groups use

- **Recurring expenses**
  - Set up templates for rent, utilities, subscriptions, etc. with a weekly or monthly frequency
  - A daily scheduled job materializes each due template into a real expense and advances it to the next occurrence
  - Always split equally across whoever is currently in the group — no need to remember a fixed participant list
  - **Pause or resume** a template without deleting it — paused templates are skipped by the daily job
  - Optionally set an **end date** — the daily job automatically pauses the template once its next occurrence would fall after it, no need to remember to cancel it yourself
  - A sidebar **Recurring** page lists upcoming (and, optionally, paused) templates across every group

- **Balances & settling up**
  - See each member's live balance (owed vs. owes) for a group
  - Automatic debt simplification suggests the minimum set of payments needed to settle everyone up
  - Record a manual payment ("I paid you back $20") to clear a debt, with an optional note, or **quick settle** a suggested payment in one click with no form
  - **Remind** a specific person about a suggested payment with a one-off nudge notification, separate from the weekly automatic reminder
  - A sidebar **Settle Up** page surfaces every group's outstanding suggestions in one place
  - A weekly scheduled job reminds anyone with an outstanding balance who they owe and how much

- **Authentication**
  - Email/password login with bcrypt-hashed passwords
  - "Continue with GitHub" OAuth login (links to an existing account by email, or creates a new one)
  - JWT stored in an HTTP-only cookie (7-day session)

- **Account settings**
  - A dedicated **Settings** page (linked from the sidebar)
  - Edit your display name
  - Change your password, or **set one for the first time** if you originally signed up via GitHub only
  - Connect or disconnect GitHub from an existing account (disconnecting is blocked if you have no password set, to avoid locking yourself out)
  - **Export your data** — download a JSON snapshot of your groups, expenses, splits, recurring templates, and settlements (also available directly from the sidebar's user menu)
  - A danger zone for deleting your account:
    - Choose **delete only my own records** — you leave every group (ownership hands off automatically if you're the sole owner), and your profile is scrubbed to a "Deleted user" placeholder so shared expenses/settlements you were part of stay intact for other members
    - Or choose **delete everything associated with me** — a full wipe: groups you solely own are deleted entirely, and anything you paid for or created elsewhere is removed too
    - Requires typing `DELETE` to confirm before the button is enabled

- **Navigation & personalization**
  - A left sidebar (collapsing to a hamburger-triggered drawer on mobile) with Dashboard, All Expenses, Settle Up, Recurring, Activity, and Settings, plus a collapsible "Your groups" quick-switcher so you can jump straight to a group
  - **Light / dark / system** theme toggle, persisted across sessions

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm
- A [Neon](https://console.neon.tech/signup) account for Postgres
- A [Vercel](https://vercel.com/signup) account (for `vercel dev` / deployment / the scheduled cron jobs)

### Local Development Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Fill in:
   ```
   DATABASE_URL=your_neon_connection_string
   JWT_SECRET=your_secure_random_string
   ```
   To enable "Continue with GitHub", create an [OAuth App](https://github.com/settings/developers) with callback URL `<your-app-url>/api/auth/github/callback` and fill in:
   ```
   GITHUB_CLIENT_ID=your_github_oauth_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
   ```
   To enable receipt uploads, provision a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store and fill in:
   ```
   BLOB_READ_WRITE_TOKEN=your_blob_read_write_token
   ```

3. **Initialize the database:**
   - Create a project at [console.neon.tech](https://console.neon.tech)
   - Run the SQL in `schema/schema.sql` against it (Neon SQL Editor, or `psql $DATABASE_URL -f schema/schema.sql`)
   - If your app connects as a non-owner role (e.g. a dedicated `tabsplit` role rather than the default `neondb_owner`), also run `schema/permissions.sql` from the Neon Console's SQL Editor once, so that role can read/write the tables it doesn't own
   - Adding a column to a table that already exists (e.g. a future `ALTER TABLE`) always needs the Neon Console's SQL Editor too, for the same non-owner-role reason — see the "Neon role/ownership gotcha" in [CLAUDE.md](./CLAUDE.md)

4. **Run the app:**
   ```bash
   npm run dev       # frontend only, http://localhost:5173
   npm run dev:api   # in another terminal - serves api/* via `vercel dev` on :3000
   ```

   By default, `npm run dev`'s dev-server proxy (`vite.config.js`) points `/api/*` at a live deployed instance of this app, not `npm run dev:api`'s `localhost:3000` — so out of the box, local frontend work talks to whatever database that deployment uses. To develop against your own local API/database instead, change the `server.proxy` target in `vite.config.js` back to `http://localhost:3000` and run `npm run dev:api` alongside `npm run dev`. That command requires the project to be linked to Vercel first (`vercel link`) so it can read your environment variables; alternatively run `vercel env pull` after linking to generate a local `.env`.

5. Open `http://localhost:5173` and create an account.

### Build for Production

```bash
npm run build
```

Output goes to `dist/`.

### Deploying

The app is set up to deploy on Vercel as-is (`vercel.json` configures the build, API rewrites, and the two cron schedules):

```bash
vercel link
vercel integration add neon --yes   # or connect an existing Neon database
vercel env pull                     # sync DATABASE_URL / JWT_SECRET locally
vercel deploy --prod
```

Vercel automatically injects a `CRON_SECRET` for scheduled invocations of `api/cron/process-recurring.js` (daily, materializes due recurring expenses) and `api/cron/settle-up-reminders.js` (weekly, nudges anyone with an outstanding balance); no extra setup needed.

Before deploying a change that adds or alters a table, apply the corresponding schema change first (see step 3 above) — the deployed API will otherwise throw on any request that touches the missing table/column.

## Usage

### Creating a group

Click **New group** on the dashboard, name it (e.g. "Apartment 4B" or "Italy Trip"), and optionally add a description. You're automatically added as the owner.

### Adding members

Open a group → **Members** tab → enter the email of another registered TabSplit user. They'll immediately see the group on their own dashboard.

### Adding an expense

Open a group → **Expenses** tab → **Add expense**. Choose who paid, the amount, category, and date, then either:
- **Equally** — pick which members are in on the expense; the amount is divided evenly
- **Exact amounts** — enter each participant's share directly (must add up to the total)
- **Percentages** — enter each participant's share as a `%`; the running total must add up to 100
- **Itemized** — break the expense into individual line items (e.g. each thing on a grocery receipt), pick which participants are in on each one, and TabSplit totals up everyone's share; item amounts must add up to the expense total

Check **Split the payment too** if more than one person fronted the money — pick each payer and how much they paid (must add up to the total). Check **This was paid in a different currency** to tag the original foreign amount/currency alongside the group-currency amount, for your own reference (it's display-only — the group-currency amount is still what actually gets split and balanced). Optionally attach a receipt photo. Once added, click **Edit** on any expense to reopen the same form prefilled, **Duplicate** to prefill a new expense from it (dated today, for a quick repeat purchase), **Items** (itemized expenses only) to see its line-item breakdown, or **Comments** to discuss it with the group.

### Custom categories

Open a group → **Settings** tab → **Categories**. Any member can add a category name specific to that group; it shows up alongside the built-in defaults in that group's expense/recurring forms and filters. Owners can remove one.

### Setting a budget

Open a group → **Settings** tab → **Budgets** (owner-only to add/remove; visible to everyone). Leave the category field blank for a whole-group monthly limit, or enter a category name to scope it to just that category. Once that month's spend crosses the limit, every group member gets a one-time notification for that month.

### Browsing across groups

The sidebar's **All Expenses**, **Settle Up**, and **Recurring** pages each aggregate that resource across every group you're in — useful for a quick "what do I owe overall" or "what's coming up" check without opening groups one at a time, and **All Expenses** can also be filtered to a date range. The sidebar's **Activity** is your full personal notification history behind the bell icon; a group's own **Settings → Activity** section is a separate, shared feed of that one group's recent events, visible to every member.

### Exporting a group's expenses

Open a group → **Expenses** tab → **Export CSV** downloads that group's expenses as a spreadsheet. This is separate from the account-wide JSON export below.

### Inviting people via link

Open a group → **Settings** tab → **Invite link** (owner-only). Click **Generate invite link** and share the URL. Anyone who opens it joins the group automatically once logged in (registering or logging in first if they aren't already). **Regenerate** invalidates the old link; **Revoke** removes it entirely.

### Setting up a recurring expense

Open a group → **Recurring** tab → **Add recurring expense**. Choose an amount, category, frequency (weekly/monthly), start date, and optionally an end date. Each time it's due, TabSplit generates a real expense split equally across the group's current members and schedules the next occurrence — once that next occurrence would land after the end date (if you set one), the template automatically pauses itself. **Pause** a template to stop it generating without deleting it at any time; **Resume** to pick back up.

### Settling up

Open a group → **Balances** tab to see who owes whom, plus a simplified list of suggested payments. Click **Settle** on a suggestion to open the payment form pre-filled, **Quick settle** to log it instantly with no form, **Remind** to send that person a one-off nudge about it, or **Record a payment** for an arbitrary amount. The same tab lists settlement history with a **Remove** option per entry. If a balance goes unpaid, expect a weekly reminder notification too.

### Managing roles, archiving, and deleting a group

Open a group → **Settings** tab. Owners can edit the group's name, description, and currency, promote/demote members from the **Members** tab, **archive** the group (hides it from the default list, reversible) or delete it entirely from the danger zone (two-step confirmation, not reversible).

### Managing your profile, password, and connected accounts

Click **Settings** in the sidebar. Update your name, change (or set) your password, and connect/disconnect GitHub sign-in. Disconnecting GitHub is blocked until you've set a password, so you can't lock yourself out.

### Switching themes

Open the user menu at the bottom of the sidebar → **Appearance** → Light, Dark, or System.

### Exporting your data

Settings → **Export my data** downloads a JSON file with everything tied to your account: groups, expenses, splits, recurring templates, and settlements.

### Deleting your account

Settings → danger zone. Pick **delete only my own records** (recommended — preserves shared history for other members) or **delete everything associated with me** (full wipe), type `DELETE` to confirm, and submit.

## Technology Stack

### Frontend
- **React 18** — UI framework
- **Vite** — build tool and dev server
- **Tailwind CSS** — styling
- **React Router** — navigation

### Backend
- **Vercel Serverless Functions** — API endpoints (`api/*.js`)
- **Vercel Cron** — daily job to materialize recurring expenses, weekly job for settle-up reminders
- **Vercel Blob** — receipt image storage
- **Neon Postgres** — database
- **@neondatabase/serverless** — database driver
- **JWT + bcryptjs** — authentication
- **HTTP-only cookies** — session management

## Project Structure

```
src/
├── components/
│   ├── AuthScreen.jsx           # Login/register
│   ├── Sidebar.jsx               # Fixed left nav (desktop) / hamburger + drawer (mobile); brand, bell, nav links, GroupSwitcher, UserMenu
│   ├── GroupSwitcher.jsx         # Collapsible "Your groups" quick-jump list in the sidebar
│   ├── NotificationsBell.jsx     # Notification badge + dropdown, polls every 30s
│   ├── GroupsList.jsx            # Dashboard - stats, list/create/archive/delete groups
│   ├── Dashboard.jsx             # Net balance, total spent, spend-over-time chart, spend-by-category, balance-by-group
│   ├── AllExpenses.jsx           # Cross-group expense list with search/category/payer/date-range filters
│   ├── SettleUp.jsx              # Cross-group settle-up suggestions
│   ├── AllRecurring.jsx          # Cross-group upcoming (and paused) recurring templates
│   ├── Activity.jsx              # Full notification history
│   ├── GroupDetail.jsx           # Tabbed group view (Expenses/Recurring/Balances/Insights/Members/Settings)
│   ├── AddExpenseForm.jsx        # Add, edit, or duplicate an expense - equal/exact/percentage/itemized split, multi-payer, multi-currency tag, receipt upload
│   ├── ExpenseComments.jsx       # Comment thread for one expense, used inline in GroupDetail
│   ├── ExpenseItems.jsx          # Read-only line-item breakdown for an itemized expense, used inline in GroupDetail
│   ├── GroupActivity.jsx         # Per-group shared activity feed, used inline in GroupDetail's Settings tab
│   ├── AddRecurringForm.jsx      # Recurring expense template form (incl. optional end date)
│   ├── AddMemberForm.jsx         # Add member by email
│   ├── BalancesSummary.jsx       # Balances + settle-up suggestions (Settle/Quick settle/Remind) + settlement history
│   ├── SettleUpForm.jsx          # Record a manual settlement
│   ├── InsightsTab.jsx           # Spend-by-category / paid-by-member bar charts
│   ├── charts/
│   │   ├── BarList.jsx            # Magnitude bar list (spend by category, etc.)
│   │   ├── DivergingBarList.jsx   # Signed bar list (balance by group)
│   │   ├── SpendOverTimeChart.jsx # Monthly spend bar chart
│   │   └── palette.js             # Validated categorical color palette
│   ├── InviteAccept.jsx          # /invite/:token destination - joins the group, then redirects
│   └── AccountSettings.jsx       # Account danger zone (delete account, own/associated modes)
├── context/
│   ├── AppContext.jsx            # Auth state (user, login, register, logout)
│   └── ThemeContext.jsx          # Light/dark/system theme, persisted to localStorage
├── utils/
│   ├── api.js                    # Fetch client per resource
│   ├── categories.js             # Built-in expense categories, currency formatting, mergeCategories()
│   └── currencies.js             # Curated ISO currency list for pickers
├── App.jsx                       # Route-aware auth gating (see CLAUDE.md)
├── main.jsx                      # Entry point
└── index.css                     # Tailwind entry point
api/
├── _lib/                         # Shared helpers - not Serverless Functions (see CLAUDE.md)
│   ├── db.js                     # Neon client, auth/cookie helpers, requireGroupMember/Owner, isSoleOwner
│   ├── balances.js               # computeBalances + simplifyDebts
│   ├── recurrence.js             # next-occurrence date math
│   └── format.js                 # formatCurrency (backend mirror of the frontend helper)
├── auth.js                       # register/login/logout/me + GitHub OAuth (github, github/callback)
├── groups.js                     # Group CRUD + membership + roles + balances/settleUp + archive + categories + budgets
├── expenses.js                   # Expense CRUD + split (equal/exact/percentage/itemized) + multi-payer + multi-currency tag + receipts + comments + CSV export
├── recurring.js                  # Recurring expense template CRUD (incl. active/pause toggle, optional end date)
├── settlements.js                # Record/undo manual settlements + one-off settle-up nudge
├── account.js                    # Account deletion (associated vs. own-records modes)
├── invites.js                    # Group invite link generate/revoke/preview/accept
├── notifications.js              # In-app notifications - list (?limit=), mark read, createNotification(), per-group activity feed (?scope=group)
├── blob-upload.js                # Vercel Blob client-upload handler for receipts
└── cron/
    ├── process-recurring.js      # Daily job: materializes due recurring expenses, auto-pauses templates past their end date
    └── settle-up-reminders.js    # Weekly job: notifies anyone with an outstanding balance
schema/
└── schema.sql                    # Complete database schema
```

See [CLAUDE.md](./CLAUDE.md) for a deeper architecture reference, data model notes, and common pitfalls.

## License

TabSplit is licensed under the [GNU General Public License v3.0](LICENSE) (or, at your option, any later version).
