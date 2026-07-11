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

- **Deleting things**
  - Any group member can delete an individual expense, recurring template, or settlement
  - Owners can delete the group itself (Settings tab, with a confirmation step)

- **Expenses**
  - Log one-off expenses with description, amount, category, and date
  - Split **equally** among selected participants, or enter **exact** custom amounts per person
  - Rounding remainders are distributed automatically so splits always add up to the penny
  - **Split the payment itself** across more than one payer (e.g. two roommates who split fronting the cost of one grocery run) instead of a single "paid by"
  - Attach a **receipt photo** to an expense (uploaded directly to Vercel Blob storage)

- **Invite links**
  - Group owners can generate a shareable invite link from the group's Settings tab
  - Anyone who opens it (registering or logging in first, if needed) joins the group automatically
  - Regenerate to invalidate the old link, or revoke it entirely

- **Notifications**
  - In-app notification bell in the navbar — no email required
  - Notified when you're added to a group, your role changes, a new expense is logged, or someone records a settlement with you
  - Unread badge count, mark one or all as read

- **Insights**
  - A group's **Insights** tab shows spend-by-category and paid-by-member bar charts, computed from that group's expenses

- **Recurring expenses**
  - Set up templates for rent, utilities, subscriptions, etc. with a weekly or monthly frequency
  - A daily scheduled job materializes each due template into a real expense and advances it to the next occurrence
  - Always split equally across whoever is currently in the group — no need to remember a fixed participant list

- **Balances & settling up**
  - See each member's live balance (owed vs. owes) for a group
  - Automatic debt simplification suggests the minimum set of payments needed to settle everyone up
  - Record a manual payment ("I paid you back $20") to clear a debt, with an optional note

- **Authentication**
  - Email/password login with bcrypt-hashed passwords
  - "Continue with GitHub" OAuth login (links to an existing account by email, or creates a new one)
  - JWT stored in an HTTP-only cookie (7-day session)

- **Account settings**
  - A dedicated **Settings** page (linked from the navbar)
  - Edit your display name
  - Change your password, or **set one for the first time** if you originally signed up via GitHub only
  - Connect or disconnect GitHub from an existing account (disconnecting is blocked if you have no password set, to avoid locking yourself out)
  - **Export your data** — download a JSON snapshot of your groups, expenses, splits, recurring templates, and settlements
  - A danger zone for deleting your account:
    - Choose **delete only my own records** — you leave every group (ownership hands off automatically if you're the sole owner), and your profile is scrubbed to a "Deleted user" placeholder so shared expenses/settlements you were part of stay intact for other members
    - Or choose **delete everything associated with me** — a full wipe: groups you solely own are deleted entirely, and anything you paid for or created elsewhere is removed too
    - Requires typing `DELETE` to confirm before the button is enabled

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm
- A [Neon](https://console.neon.tech/signup) account for Postgres
- A [Vercel](https://vercel.com/signup) account (for `vercel dev` / deployment / the recurring-expense cron job)

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

4. **Run the app:**
   ```bash
   npm run dev       # frontend only, http://localhost:5173 (proxies /api to :3000)
   npm run dev:api   # in another terminal - serves api/* via `vercel dev` on :3000
   ```

   `npm run dev:api` requires the project to be linked to Vercel first (`vercel link`) so it can read your environment variables; alternatively run `vercel env pull` after linking to generate a local `.env`.

5. Open `http://localhost:5173` and create an account.

### Build for Production

```bash
npm run build
```

Output goes to `dist/`.

### Deploying

The app is set up to deploy on Vercel as-is (`vercel.json` configures the build, API rewrites, and the recurring-expense cron schedule):

```bash
vercel link
vercel integration add neon --yes   # or connect an existing Neon database
vercel env pull                     # sync DATABASE_URL / JWT_SECRET locally
vercel deploy --prod
```

Vercel automatically injects a `CRON_SECRET` for scheduled invocations of `api/cron/process-recurring.js`; no extra setup needed.

## Usage

### Creating a group

Click **New group** on the dashboard, name it (e.g. "Apartment 4B" or "Italy Trip"), and optionally add a description. You're automatically added as the owner.

### Adding members

Open a group → **Members** tab → enter the email of another registered TabSplit user. They'll immediately see the group on their own dashboard.

### Adding an expense

Open a group → **Expenses** tab → **Add expense**. Choose who paid, the amount, category, and date, then either:
- **Equally** — pick which members are in on the expense; the amount is divided evenly
- **Exact amounts** — enter each participant's share directly (must add up to the total)

Check **Split the payment too** if more than one person fronted the money — pick each payer and how much they paid (must add up to the total). Optionally attach a receipt photo.

### Inviting people via link

Open a group → **Settings** tab → **Invite link** (owner-only). Click **Generate invite link** and share the URL. Anyone who opens it joins the group automatically once logged in (registering or logging in first if they aren't already). **Regenerate** invalidates the old link; **Revoke** removes it entirely.

### Setting up a recurring expense

Open a group → **Recurring** tab → **Add recurring expense**. Choose an amount, category, frequency (weekly/monthly), and start date. Each time it's due, TabSplit generates a real expense split equally across the group's current members and schedules the next occurrence.

### Settling up

Open a group → **Balances** tab to see who owes whom, plus a simplified list of suggested payments. Click **Settle** on a suggestion (or **Record a payment** for an arbitrary amount) to log that someone paid someone back. The same tab lists settlement history with a **Remove** option per entry.

### Managing roles and deleting a group

Open a group → **Settings** tab. Owners can edit the group's name, description, and currency, promote/demote members from the **Members** tab, and delete the group entirely from the danger zone (two-step confirmation).

### Managing your profile, password, and connected accounts

Click **Settings** in the navbar. Update your name, change (or set) your password, and connect/disconnect GitHub sign-in. Disconnecting GitHub is blocked until you've set a password, so you can't lock yourself out.

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
- **Vercel Cron** — daily job to materialize recurring expenses
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
│   ├── Navbar.jsx                # Top nav with notifications bell, Settings link, logout
│   ├── NotificationsBell.jsx     # Notification badge + dropdown, polls every 30s
│   ├── GroupsList.jsx            # Dashboard - list, create, and delete groups
│   ├── GroupDetail.jsx           # Tabbed group view (Expenses/Recurring/Balances/Insights/Members/Settings)
│   ├── AddExpenseForm.jsx        # Equal/exact split, multi-payer, and receipt upload
│   ├── AddRecurringForm.jsx      # Recurring expense template form
│   ├── AddMemberForm.jsx         # Add member by email
│   ├── BalancesSummary.jsx       # Balances + settle-up suggestions + settlement history
│   ├── SettleUpForm.jsx          # Record a manual settlement
│   ├── InsightsTab.jsx           # Spend-by-category / paid-by-member bar charts
│   ├── InviteAccept.jsx          # /invite/:token destination - joins the group, then redirects
│   └── AccountSettings.jsx       # Account danger zone (delete account, own/associated modes)
├── context/
│   └── AppContext.jsx            # Auth state (user, login, register, logout)
├── utils/
│   ├── api.js                    # Fetch client per resource
│   ├── categories.js             # Expense categories & currency formatting
│   └── currencies.js             # Curated ISO currency list for pickers
├── App.jsx                       # Route-aware auth gating (see CLAUDE.md)
├── main.jsx                      # Entry point
└── index.css                     # Tailwind entry point
api/
├── _lib/                         # Shared helpers - not Serverless Functions (see CLAUDE.md)
│   ├── db.js                     # Neon client, auth/cookie helpers, requireGroupMember/Owner, isSoleOwner
│   ├── balances.js               # computeBalances + simplifyDebts
│   └── recurrence.js             # next-occurrence date math
├── auth.js                       # register/login/logout/me + GitHub OAuth (github, github/callback)
├── groups.js                     # Group CRUD + membership + roles + balances/settleUp
├── expenses.js                   # Expense CRUD + split + multi-payer calculation + receipts
├── recurring.js                  # Recurring expense template CRUD
├── settlements.js                # Record/undo manual settlements
├── account.js                    # Account deletion (associated vs. own-records modes)
├── invites.js                    # Group invite link generate/revoke/preview/accept
├── notifications.js              # In-app notifications - list, mark read, createNotification()
├── blob-upload.js                # Vercel Blob client-upload handler for receipts
└── cron/
    └── process-recurring.js      # Daily job: materializes due recurring expenses
schema/
└── schema.sql                    # Complete database schema
```

See [CLAUDE.md](./CLAUDE.md) for a deeper architecture reference, data model notes, and common pitfalls.

## License

TabSplit is licensed under the [GNU General Public License v3.0](LICENSE) (or, at your option, any later version).
