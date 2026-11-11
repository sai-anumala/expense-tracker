# Ledgerly — Expense Tracker

> 📘 **Full project guide for developers and AI agents: [AGENTS.md](AGENTS.md)** (architecture, data model, API, formulas, deployment, gotchas).
>
> 📗 **How every feature works, for users: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)** (with screenshots).

A mobile-first, fully responsive expense tracker built with **Next.js 15 (App Router)**, **Tailwind CSS v4**, and **MongoDB (Mongoose)**. UI based on the Google Stitch design "Clean Expense Tracker" (references in [`design/`](design)).

## Features

- **Accounts** — anyone can sign up with email + password; each user sees only their own transactions, budget and balance
- **Overview** — total available balance (Bank + UPI + Cash: opening balance + income − cash spending) with monthly growth, this month's Income / Spent / Remaining plus a Credit Card tile once a card is set up, budget pacing, recent transactions
- **Add / edit transactions** — expense or income, category, date & time picker, payment method; edits and deletes require confirmation
- **Budgets** — overall monthly limit and per-category limits
- **Your categories** — name "Other" to create your own category, usable in budgets and analytics; rename or delete it on its own page
- **Analytics** — week / month / year totals vs previous period, category breakdown, top merchants, 4-week trend, CSV export
- **Loans** — track money lent to / borrowed from friends, relatives, apps and banks; partial or full repayments, optional interest, due date and monthly plan (affects balance, never income or spending)
- **Transfers** — move money between your own Bank, UPI, Cash and Credit Card (ATM withdrawals, card bill payments); never income or spending. Only card bill payments (lower) and card cash withdrawals (raise) change the balance
- **Credit card** — one card with statement day, due day and optional limit: bill to pay, unbilled amount, due date, utilization, Pay bill. Card purchases count as spending but don't reduce your balance until you pay the bill
- **All Transactions** — full history (transactions and transfers) with search, filters and paging
- **Reminders** — the 🔔 bell lists card bills due soon / overdue, high card usage, upcoming or overdue loan payments and budgets ≥ 90% used; the most important one also shows as a banner on the Overview. Reminders can be removed one by one or with Clear all (in-app only)
- Amounts in **INR (₹)** with Indian digit grouping

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI
npm run dev                  # http://localhost:3000
```

### Environment variables (`.env.local`)

| Variable | Description |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string (Atlas → Cluster → Connect → Drivers) |
| `MONGODB_DB` | Database name (default `ledgerly`) |
| `AUTH_SECRET` | 32+ random characters used to sign login sessions (`openssl rand -hex 32`). Changing it logs everyone out |

Check the connection at `GET /api/health`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/signup` · `/api/auth/login` · `/api/auth/logout` | Create account / sign in / sign out (httpOnly session cookie) |
| GET | `/api/auth/me` | Signed-in user |
| POST | `/api/auth/password` | Change password `{currentPassword, newPassword}` (session required) |
| GET / POST | `/api/transactions` | List / create transactions |
| PUT / DELETE | `/api/transactions/:id` | Update / delete a transaction |
| GET / PUT | `/api/budget` | Monthly and category limits |
| GET / PUT | `/api/settings` | Balance + unpaid credit card amount |
| PUT | `/api/settings/card` | Credit card setup `{statementDay, dueDay, limit?}` or `{card: null}` |
| POST | `/api/settings/alerts` | Remember removed reminders `{keys}` |
| GET / POST · PUT / DELETE | `/api/categories` · `/api/categories/:id` | The user's own categories `{name}` |
| GET / POST · PUT / DELETE | `/api/loans` · `/api/loans/:id` | Loans |
| POST · DELETE | `/api/loans/:id/payments` · `…/payments/:paymentId` | Record / undo a repayment |
| GET / POST · PUT / DELETE | `/api/transfers` · `/api/transfers/:id` | Transfers between own accounts `{from, to, amount, date, note?}` |
| GET | `/api/health` | Database connectivity |

Responses use `{ success, payload }` or `{ success: false, error }`. Login, sign-up and change password are rate-limited (429 with `Retry-After`; counters in MongoDB). All routes except auth and health require a session and only touch the signed-in user's data.

## Project structure

```
src/
  app/            pages (/, /add, /budgets, /analytics, /transactions, /categories, /loans, /transfer, /card) and API routes
  components/     UI pieces (date picker, confirm dialog, amount form, nav)
  lib/            store (client data), db connection, validation, formatting, insights
  models/         Mongoose models: User, Transaction, CustomCategory, Budget, Settings, Loan, Transfer, CaptureToken, CapturedTransaction, RateLimit
  middleware.ts   redirects signed-out visitors to /login
design/           Stitch screenshots and DESIGN.md
```

## Branches & deployment

| Branch | Purpose | Vercel |
| --- | --- | --- |
| `develop` | Day-to-day development — commit and push here | Preview deployment on every push: `expense-tracker-git-develop-sai-anumalas-projects.vercel.app` |
| `main` | Production — only updated by merging `develop` | Production deployment: `expense-tracker-sage-six-21.vercel.app` |

Release to production:

```bash
git checkout main && git pull
git merge --ff-only develop   # or open a PR develop → main on GitHub
git push origin main          # triggers the production deploy
git checkout develop
```

## Scripts

`npm run dev` · `npm run build` · `npm run start` · `npm run lint` · `npm test`
