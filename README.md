# Ledgerly — Expense Tracker

> 📘 **Full project guide for developers and AI agents: [AGENTS.md](AGENTS.md)** (architecture, data model, API, formulas, deployment, gotchas).

A mobile-first expense tracker built with **Next.js 15 (App Router)**, **Tailwind CSS v4**, and **MongoDB (Mongoose)**. UI based on the Google Stitch design "Clean Expense Tracker" (references in [`design/`](design)).

## Features

- **Accounts** — anyone can sign up with email + password; each user sees only their own transactions, budget and balance
- **Overview** — total available balance (opening balance + income − spending) with monthly growth, this month's Income / Spent / To Spend, budget pacing, recent transactions
- **Add / edit transactions** — expense or income, category, date & time picker, payment method; edits and deletes require confirmation
- **Budgets** — overall monthly limit and per-category limits
- **Analytics** — week / month / year totals vs previous period, category breakdown, top merchants, 4-week trend, CSV export
- **Loans** — track money lent to / borrowed from friends, relatives, apps and banks; partial or full repayments, optional interest, due date and monthly plan (affects balance, never income or spending)
- **Accounts** — totals per payment method and full history
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
| GET / PUT | `/api/settings` | Opening balance |
| GET / POST · PUT / DELETE | `/api/loans` · `/api/loans/:id` | Loans |
| POST · DELETE | `/api/loans/:id/payments` · `…/payments/:paymentId` | Record / undo a repayment |
| GET | `/api/health` | Database connectivity |

Responses use `{ success, payload }` or `{ success: false, error }`. Login, sign-up and change password are rate-limited (429 with `Retry-After`; counters in MongoDB). All routes except auth and health require a session and only touch the signed-in user's data.

## Project structure

```
src/
  app/            pages (/, /add, /budgets, /analytics, /accounts) and API routes
  components/     UI pieces (date picker, confirm dialog, amount form, nav)
  lib/            store (client data), db connection, validation, formatting, insights
  models/         Mongoose models: User, Transaction, Budget, Settings, Loan
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

`npm run dev` · `npm run build` · `npm run start` · `npm run lint`
