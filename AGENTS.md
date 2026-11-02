# AGENTS.md: Ledgerly Expense Tracker

> **Single source of truth for humans and AI agents working on this repo.**
> Read this first; it should answer most questions without exploring the code.
> **Keep it current:** any change to behaviour, data model, API, env vars, or deployment must update the relevant section here **in the same commit** (see [§15](#15-maintaining-this-file)).

Last updated: 2026-11-02 · Branch model: `develop` → `main` · Live: <https://expense-tracker-sage-six-21.vercel.app>

---

## Table of contents
1. [What it is](#1-what-it-is)
2. [Tech stack](#2-tech-stack)
3. [Quick start](#3-quick-start)
4. [Environment variables](#4-environment-variables)
5. [Branches, deployment & infrastructure](#5-branches-deployment--infrastructure)
6. [Architecture & request flow](#6-architecture--request-flow)
7. [File map](#7-file-map)
8. [Data model (MongoDB)](#8-data-model-mongodb)
9. [API reference](#9-api-reference)
10. [Authentication & multi-user isolation](#10-authentication--multi-user-isolation)
11. [Business logic & formulas](#11-business-logic--formulas)
12. [Screens & UX behaviour](#12-screens--ux-behaviour)
13. [Design system](#13-design-system)
14. [Conventions & rules](#14-conventions--rules)
15. [Maintaining this file](#15-maintaining-this-file)
16. [Testing & verification](#16-testing--verification)
17. [Gotchas & troubleshooting](#17-gotchas--troubleshooting)
18. [Decision log](#18-decision-log)
19. [Known limitations / backlog](#19-known-limitations--backlog)

---

## 1. What it is

**Ledgerly** is a mobile-first, multi-user personal expense tracker. Anyone can sign up; each user has their own:
- **Transactions** (expenses and income, with category, date/time, payment method, note)
- **Total available balance** (cash they have, entered at a point in time; only later transactions change it)
- **Budget** (overall monthly limit and optional per-category limits)
- **Loans** (money lent to / borrowed from friends, relatives, online apps, banks, with repayments)

Screens: Overview (dashboard), Add/Edit Transaction, Budgets, Analytics, Loans (list, new/edit, detail), Accounts (via "View All"), Login, Sign up.
Currency: **INR (₹)** with Indian digit grouping. UI derived from a Google Stitch design (see [§13](#13-design-system)).

There is **no mock or sample data** anywhere: every number comes from the signed-in user's MongoDB data.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15.5.x** (App Router, TypeScript strict) | Must stay ≥ 15.5.28. Vercel **refuses to deploy** vulnerable versions |
| UI | React 19.1.x, **Tailwind CSS v4** (CSS-first `@theme`, no `tailwind.config`) | Icons: `lucide-react` |
| Fonts | Hanken Grotesk (text **and numbers**, with `tabular-nums`) via `next/font/google`; JetBrains Mono still loaded but only used for the error ref code | CSS vars `--font-hanken`, `--font-jetbrains` set on `<html>` |
| DB | **MongoDB Atlas** via **Mongoose 8.x** | DB name `ledgerly` |
| Auth | Custom: **bcryptjs** (cost 12) + **jose** JWT (HS256) in httpOnly cookie | No third-party auth provider |
| Hosting | **Vercel** (Hobby), GitHub integration | |
| Package manager | npm (`package-lock.json`) | |

No test framework is configured yet (see [§16](#16-testing--verification)).

---

## 3. Quick start

```bash
git clone https://github.com/sai-anumala/expense-tracker && cd expense-tracker
git checkout develop
npm install
cp .env.example .env.local      # fill in MONGODB_URI and AUTH_SECRET (see §4)
npm run dev                     # http://localhost:3000 → redirects to /login
```

| Script | Command |
|---|---|
| Dev server | `npm run dev` |
| Production build | `npm run build` then `npm run start` |
| Lint | `npm run lint` |
| Type-check | `npx tsc --noEmit` |
| DB/auth health | `GET /api/health` → `{ success, db, auth }` |

---

## 4. Environment variables

| Name | Required | Where | Purpose |
|---|---|---|---|
| `MONGODB_URI` | yes | `.env.local`, Vercel (Production + Preview, *sensitive*) | Atlas connection string. Password must be URL-encoded if it has special characters |
| `MONGODB_DB` | no (default `ledgerly`) | same | Database name |
| `AUTH_SECRET` | yes | same | ≥ 32 random chars to sign session JWTs (`openssl rand -hex 32`). **Local and Vercel use different values.** Changing it logs everyone out |
| `VERCEL_OIDC_TOKEN` | auto | `.env.local` | Written by `vercel link`; not used by app code |

Rules:
- `.env*` is git-ignored except `.env.example` (template without values). **Never commit secrets.**
- Never print secret values in logs, chat, or docs. To copy a value to Vercel, pipe it: `grep '^KEY=' .env.local | cut -d= -f2- | tr -d '\n' | npx vercel env add KEY production --sensitive --force`.
- After changing `.env.local`, **restart `npm run dev`** (middleware is compiled with env at start; see [§17](#17-gotchas--troubleshooting)).
- Missing `MONGODB_URI` → APIs return 503 "Database not configured". Missing `AUTH_SECRET` → 503 "Sign-in isn't configured", and middleware treats everyone as logged out.

---

## 5. Branches, deployment & infrastructure

| Branch | Role | Vercel target | URL |
|---|---|---|---|
| `develop` | Day-to-day work (default working branch) | **Preview** on every push | <https://expense-tracker-git-develop-sai-anumalas-projects.vercel.app> (Vercel-login protected) |
| `main` | Production; only updated by merging `develop` | **Production** on every push | <https://expense-tracker-sage-six-21.vercel.app> (also `expense-tracker-sai-anumalas-projects.vercel.app`) |

**Release flow**
```bash
git checkout main && git pull
git merge --ff-only develop     # or PR develop → main on GitHub
git push origin main            # ⇒ automatic production deploy
git checkout develop
```

**Infrastructure facts (IDs are not secrets)**
- GitHub: `sai-anumala/expense-tracker` (private).
- Vercel: team `sai-anumalas-projects` (`team_xdN7BdWZfR6IECLZQRCcbJjx`), project `expense-tracker` (`prj_q179X7ZAKzr71LP7JcrgS2vgpz4a`). Local link in `.vercel/` (git-ignored).
- MongoDB Atlas: Network Access allows `0.0.0.0/0` (required: Vercel has no fixed IPs).
- ⚠️ **Preview, local dev and production all share the same database (`ledgerly`).** Testing on `develop` touches real users' data. (A separate `ledgerly_dev` DB was offered and declined.)
- Vercel CLI: use `npx vercel …` (not installed globally). Logs: `npx vercel logs --deployment <url> --query 'level:error'` (Hobby keeps about 30 min).
- Design source: Google Stitch project `7559211481556998549` ("Clean Expense Tracker"); screenshots and `DESIGN.md` copied to `design/`.

---

## 6. Architecture & request flow

```
Browser
  │  every request
  ▼
src/middleware.ts  ── verifies `ledgerly_session` JWT (edge, jose)
  │   pages: no session → 302 /login?next=…   |  /login,/signup with session → 302 /
  │   /api/*: no session → 401 JSON (except PUBLIC_API)
  ▼
App Router
  ├─ (auth)/login, (auth)/signup ─ AuthForm → POST /api/auth/* → sets cookie → full reload
  └─ (app)/layout.tsx ─ <TransactionsProvider> (src/lib/store.tsx, client)
        on mount: GET /api/auth/me, /api/transactions, /api/budget, /api/settings, /api/loans (parallel)
        shows spinner → data | error screen with "Try again"
        exposes useAppData(): { user, logout, transactions, add, update, remove,
                                budget, saveBudget, settings, saveSettings,
                                loans, addLoan, updateLoan, removeLoan, addPayment, removePayment }
        pages compute all metrics client-side from that data (src/lib/insights.ts)
  ▼
API route handlers (Node runtime, src/app/api/**)
  requireDb() → requireUser() → readJsonObject() → validate → connectDb() → Mongoose (filtered by userId)
  → ok(payload) | fail(status, message) | dbErrorResponse(err)
```

- All pages are **client components** rendered after data loads (avoids hydration mismatches from time zones and "now").
- State lives only in React context + MongoDB. **No localStorage** for app data (the provider deletes the legacy key `ledgerly.transactions.v1`).
- Mutations update context state from the server's response (no optimistic updates).

---

## 7. File map

```
src/
├─ middleware.ts                 Auth gate for pages + API (see §10). PUBLIC_API list lives here
├─ app/
│  ├─ layout.tsx                 Root: fonts, metadata/viewport, centered max-w-md column. NO data provider
│  ├─ globals.css                Tailwind v4 @theme tokens (colors, fonts, radii), utilities `label-caps`, `card`
│  ├─ error.tsx                  Page-level error boundary ("Something went wrong", Try again / Overview)
│  ├─ global-error.tsx           Root-layout failure fallback (inline styles, own <html>)
│  ├─ not-found.tsx              Styled 404
│  ├─ (auth)/login/page.tsx      <AuthForm mode="login"> in Suspense
│  ├─ (auth)/signup/page.tsx     <AuthForm mode="signup">
│  ├─ (app)/layout.tsx           Wraps signed-in screens in <TransactionsProvider>
│  ├─ (app)/page.tsx             Overview dashboard (balance card, budget card, quick actions, recent tx, insight tip)
│  ├─ (app)/add/page.tsx         Add AND edit transaction (`?id=` edit, `?kind=income` preselect). Confirm dialogs
│  ├─ (app)/budgets/page.tsx     Monthly limit + category budgets CRUD
│  ├─ (app)/analytics/page.tsx   Week/Month/Year analytics, donut, weekly bars, top merchants, CSV export
│  ├─ (app)/accounts/page.tsx    Totals per payment method + full history with filter (reached via "View All")
│  ├─ (app)/loans/page.tsx       Loans tab: You'll get / You owe, I lent / I borrowed buttons, Open/Settled lists
│  ├─ (app)/loans/new/page.tsx   Create or edit (`?id=`) a loan; `?dir=lent|borrowed` preselect
│  ├─ (app)/loans/[id]/page.tsx  Loan detail: progress, record repayment / Settle in full, history, edit, delete
│  └─ api/
│     ├─ health/route.ts         GET public status {db, auth}; never leaks error details
│     ├─ auth/signup|login|logout|me/route.ts
│     ├─ transactions/route.ts   GET list, POST create
│     ├─ transactions/[id]/route.ts  PUT update, DELETE
│     ├─ budget/route.ts         GET, PUT (replace whole budget)
│     ├─ settings/route.ts       GET, PUT (opening balance)
│     └─ loans/route.ts · loans/[id] · loans/[id]/payments · loans/[id]/payments/[paymentId]
├─ components/
│  ├─ ui.tsx                     AppHeader (logo, bell [no-op], UserMenu), Logo, IconTile, MonthPill [no-op], ProgressBar, SectionTitle
│  ├─ BottomNav.tsx              Fixed bottom nav (Overview, Analytics, [+], Budgets, Loans); TabPage wrapper
│  ├─ TransactionRow.tsx         Swipeable row (drag left / tap → View · Edit · Delete), details pop-up, delete confirm; EmptyState
│  ├─ AmountForm.tsx             Inline ₹ amount form (validates, shows its own errors); sanitizeAmount()
│  ├─ ConfirmDialog.tsx          <dialog> Yes/Cancel modal (danger variant, busy state)
│  ├─ DateTimePicker.tsx         Field + compact centered calendar/time pop-up; formatWhen(); future dates disabled
│  ├─ AuthForm.tsx               Login/Signup form; safeNext() prevents open redirects
│  └─ UserMenu.tsx               Initials avatar → menu (name, email, Log out); initials()
├─ lib/
│  ├─ store.tsx      (client)    TransactionsProvider, useAppData, api() fetch helper, ApiError, errorMessage()
│  ├─ data.ts                    Categories (+ primaryCategories / moreCategories), paymentMethods + DEFAULT_PAYMENT_METHOD, types, empty defaults
│  ├─ insights.ts                Pure calc helpers: periodBounds, within, totals, spentByCategory, topMerchants, weeklySpend, categoryInsight, anchoredBalance
│  ├─ format.ts                  money (₹, en-IN), moneyWhole, signedMoney, timeOf, monthLabel, daysLeftInMonth, plural, dayBucket
│  ├─ db.ts          (server)    connectDb() with global cached connection; isDbConfigured()
│  ├─ api.ts         (server)    ok/fail, requireDb, readJsonObject, dbErrorResponse, MAX_AMOUNT, toPaise
│  ├─ session.ts     (edge-safe) JWT create/verify, SESSION_COOKIE, isAuthConfigured
│  ├─ auth.ts        (server)    getSession, requireUser, set/clearSessionCookie
│  ├─ authInput.ts   (server)    validateEmail/Password/Name, normalizeEmail
│  ├─ transactionInput.ts (server) parseTransactionInput (all tx validation), toTransactionDto
│  ├─ csv.ts         (client)    csvDateTime/csvDate/csvAmount, toCsv (escaping + injection guard), slug, downloadCsv (BOM)
│  ├─ loanExport.ts              loansSummaryRows, personStatementRows (pure; used by Loans CSV buttons)
│  ├─ loans.ts                   (shared) Loan types, loanStatus, nextPaymentDate, loanCashEvents, loanTotals, source labels
│  └─ loanInput.ts   (server)    parseLoanInput, parsePaymentInput, toLoanDto
└─ models/  User.ts · Transaction.ts · Budget.ts · Settings.ts · Loan.ts
design/      Stitch screenshots (dashboard/add/budget/analytics.png) + DESIGN.md (design system spec)
README.md    Short human-facing overview (keep consistent with this file)
CLAUDE.md    Imports this file for Claude Code
```

---

## 8. Data model (MongoDB)

All schemas use `timestamps: true` and `strict: "throw"` (unknown fields throw → API returns 400).

**`users`** (`User`)
| Field | Type | Rules |
|---|---|---|
| `name` | String | required, trim, ≤ 60 |
| `email` | String | required, **unique**, lowercased, trimmed, ≤ 254 |
| `passwordHash` | String | bcrypt (cost 12), `select: false` |

**`transactions`** (`Transaction`)
| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId → User | required, indexed. **Every query filters on it** |
| `merchant` | String | required, ≤ 120 (note/merchant/source; defaults to category name) |
| `category` | enum | `food, groceries, transport, shopping, fun, bills, health, home (Sending home), fuel, friend (Sent to friend), rent, education, gifts (Gifts & donations), personal (Personal care), other, hardware (legacy), income` |
| `amount` | Number | **expense < 0, income > 0**, never 0, \|x\| ≤ 1e10, rounded to paise |
| `date` | Date | indexed; not in the future (5 min tolerance) |
| `account` | String | optional payment method, ≤ 80 (`UPI` (default), `Cash, Debit Card, Credit Card, Bank Transfer`) |
| `receiptName` | String | optional file name only (files are **not** uploaded) |

**`budgets`** (`Budget`): one document per user
| Field | Type | Rules |
|---|---|---|
| `key` | String | **unique** = owner's `userId` (string) |
| `monthlyLimit` | Number | ≥ 0; `0` = not set |
| `categories` | `[{ category, limit }]` | limit > 0; no duplicates; `income` not allowed |

**`settings`** (`Settings`): one document per user
| Field | Type | Rules |
|---|---|---|
| `key` | String | **unique** = owner's `userId` |
| `openingBalance` | Number \| null | Total available balance **exactly as entered**, ≥ 0; `null` = not set (dashboard shows the prompt). Field name kept from earlier versions |
| `balanceAsOf` | Date \| null | When it was entered, **truncated to the minute** (set by the server on every save). Older docs lack it → API returns `updatedAt` instead |

**`loans`** (`Loan`): one document per loan, repayments embedded
| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId → User | required, indexed; every query filters on it |
| `direction` | enum | `lent` (they owe me) \| `borrowed` (I owe) |
| `person` | String | required, ≤ 60 (friend, relative, app or bank name) |
| `source` | enum | `friend, relative, online, bank, other` |
| `amount` | Number | principal that changed hands, > 0, ≤ 1e10 |
| `totalDue` | Number | total to repay, ≥ `amount` (interest/fees); defaults to `amount` |
| `date` | Date | when money changed hands; not in the future |
| `dueDate` | Date? | optional "repay by" (end of chosen day); ≥ `date` |
| `monthlyPayment` + `paymentDay` | Number? + 1–28 | optional monthly plan (both or neither); `monthlyPayment ≤ totalDue` |
| `account`, `note` | String? | payment method ≤ 80, note ≤ 200 |
| `payments[]` | `{_id, amount > 0, date, account?, note?}` | sum ≤ `totalDue`; each dated ≥ `date`, not future. Loan is **settled** when Σ payments ≥ `totalDue` (derived, not stored) |

Why `key` instead of `userId` on budgets/settings: the collections already had a unique index on `key` from the single-user era; reusing it as the owner id avoided a migration.

**Legacy data:** one `settings` doc with `key: "default"` (₹10,000) predates accounts. It is ownerless, invisible to every user, and safe to delete.
**Test account in production:** `test.user@ledgerly-demo.dev` (created for QA). Delete it and its data when no longer needed.

---

## 9. API reference

Envelope: success `{ "success": true, "payload": … }` · failure `{ "success": false, "error": "human-readable message" }`.
All bodies are JSON objects; non-object or invalid JSON → **400**. Mongoose `ValidationError`/`CastError`/`StrictModeError` → **400**; duplicate key → **409**; DB auth/network → **503** with a fix-it message; anything else → **500** generic (details only in server logs).

| Method & path | Auth | Body | Success | Notable errors |
|---|---|---|---|---|
| `GET /api/health` | public | – | `{success, db: "connected", auth: "configured"}` | 503 `db: not-configured \| error`, `auth: missing-secret` |
| `POST /api/auth/signup` | public | `{name, email, password}` | 201 `{id,name,email}` + cookie | 400 validation, 409 email exists |
| `POST /api/auth/login` | public | `{email, password}` | 200 `{id,name,email}` + cookie | 401 "Incorrect email or password." (same for unknown email) |
| `POST /api/auth/logout` | public | – | 200, cookie cleared | – |
| `GET /api/auth/me` | session | – | `{id,name,email}` (re-read from DB) | 401 (and cookie cleared if user deleted) |
| `GET /api/transactions` | session | – | `Transaction[]` newest first (max 1000) | – |
| `POST /api/transactions` | session | `{merchant, category, amount, date(ISO), account?, receiptName?}` | 201 `Transaction` | 400 with specific reason |
| `PUT /api/transactions/:id` | session | same as POST | 200 `Transaction` | 404 if not found **or not owned** (same message) |
| `DELETE /api/transactions/:id` | session | – | 200 `{id}` | 404 not found / not owned |
| `GET /api/budget` | session | – | `{monthlyLimit, categories[]}` (defaults if none) | – |
| `PUT /api/budget` | session | full budget (replaces) | 200 budget | 400 limits/duplicates |
| `GET /api/settings` | session | – | `{openingBalance, balanceAsOf}` (ISO or null) | – |
| `PUT /api/settings` | session | `{openingBalance: number ≥ 0 \| null}` | 200 `{openingBalance, balanceAsOf}`; server sets `balanceAsOf` = now (to the minute), or null when clearing | 400 |

| `GET /api/loans` | session | – | `Loan[]` newest first (max 500) | – |
| `POST /api/loans` | session | `{direction, person, source, amount, totalDue?, date, dueDate?, monthlyPayment?, paymentDay?, account?, note?}` | 201 `Loan` | 400 with specific reason |
| `PUT /api/loans/:id` | session | same as POST (payments kept; omitted optionals are removed) | 200 `Loan` | 400 `totalDue` < repaid, or `date` after first repayment; 404 |
| `DELETE /api/loans/:id` | session | – | 200 `{id}` (repayments deleted too) | 404 |
| `POST /api/loans/:id/payments` | session | `{amount, date, account?, note?}` | 201 updated `Loan` | 400 settled / more than outstanding / before loan date; 404 |
| `DELETE /api/loans/:id/payments/:paymentId` | session | – | 200 updated `Loan` | 404 |

`Loan` DTO: fields above plus `id`, `payments[]` (each with `id`, newest first). Status is computed client-side with `loanStatus()`.

`Transaction` DTO: `{ id, merchant, category, amount, date, account? }`. Unknown body fields (e.g. an old `subcategory`) are ignored.
Validation lives in `lib/transactionInput.ts` (transactions), `lib/authInput.ts` (auth), and inline in budget/settings routes. **Server validation is authoritative**; client checks are UX only.

---

## 10. Authentication & multi-user isolation

- **Sign up:** name (1-60), valid email (lowercased), password 8-72 chars → bcrypt hash → user created → session cookie set.
- **Session:** cookie `ledgerly_session` = JWT HS256 `{ sub: userId, email, name }`, 30-day expiry; `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`. Stateless (no session table); logout clears the cookie.
- **Middleware** (`src/middleware.ts`, edge): verifies the JWT on every non-static request.
  - Pages without a session → `/login?next=<path>`; `/login` and `/signup` with a session → `/`.
  - `/api/*` without a session → 401, except `PUBLIC_API = /api/auth/login, /api/auth/signup, /api/auth/logout, /api/health`.
- **API routes re-check** via `requireUser()`; every query includes `userId` (transactions) or `key: userId` (budget/settings). Accessing someone else's id returns the same 404 as a missing one.
- **Login hardening:** identical error for wrong password vs unknown email; bcrypt-compares against a dummy hash when the email doesn't exist (timing).
- **Client:** `api()` in `store.tsx` redirects to `/login?next=…` on any 401 (except auth endpoints). Logout is a full page reload to `/login` (clears in-memory data). `AuthForm.safeNext()` only allows same-site relative `next` paths.
- CSRF: relies on `sameSite=lax` + JSON bodies (no CSRF tokens).

---

## 11. Business logic & formulas

All computed client-side in pages using `lib/insights.ts`. "This month" = local time, 1st 00:00 → next 1st. Weeks start **Monday**.

### Overview dashboard (spec agreed with the product owner; do not change without asking)
| Metric | Formula |
|---|---|
| **Total Available Balance** | `entered balance + Σ income − Σ expenses + loan cash` **counting only transactions and loan events with `date ≥ balanceAsOf`**. Loan cash (`loanCashEvents`): lending −amount, repayment received +; borrowing +amount, repayment made −. Transactions dated earlier are ignored (they're already in the amount the user typed). Implemented by `anchoredBalance()` in `lib/insights.ts` |
| **±x% this mo** badge | `(balance − base) / base × 100`. `base` = entered balance if `balanceAsOf` is this month, else entered + net of transactions in `[balanceAsOf, 1st)`. Never uses transactions before the anchor. Hidden if `base ≤ 0` or \|x\| < 0.05 |
| **Income** tile | Σ income this month |
| **Spent** tile | Σ expenses this month (shown as −₹) |
| **Remaining** tile (formerly "To Spend") | `monthlyLimit − spent this month`; "—" if no budget |
| Status pill | used = spent / limit: `< 0.85` "On track", `≤ 1` "Watch spend", else "Over budget" (only if a budget is set) |
| Monthly Budget bar | `% used = spent / limit`; "Daily safe pace" = `max(0, remaining) / daysLeft` |
| `daysLeft` | days left in the month **including today** (31 Oct → 1) |
| Recent transactions | latest 8, grouped Today / Yesterday / "Oct 28"; group header shows net |
| Insight tip | biggest % change vs last month in a category present both months; hidden if none |

Balance entry: if `null`, the card asks "How much money do you have right now?". The ✎ opens pre-filled with the **current** balance; saving re-anchors (new amount, `balanceAsOf` = now). The value is stored exactly as typed. Hovering the balance shows when it was set.
Examples: entered ₹10,000 at 4:30 PM → a ₹500 expense dated 2 PM is ignored (balance stays ₹10,000); a ₹50 expense dated 4:30 PM (same minute) counts → ₹9,950.

Reference scenario (from the spec): budget 3,000, spent 1,830.40 → Remaining 1,169.60; 12 days left → 97.46/day.

### Loans (lend & borrow)
- **Never income or spending:** loans don't touch Income, Spent, Remaining, budgets or analytics. They only move Total Available Balance (and only when dated ≥ `balanceAsOf`).
- `paid = Σ payments`, `outstanding = max(0, totalDue − paid)`, **settled** when outstanding = 0, `progress = paid / totalDue`.
- **Overdue** = not settled and `dueDate` < today. **Next payment** (monthly plan) = next `paymentDay` on/after today (and after the loan date); amount shown = `min(monthlyPayment, outstanding)`.
- Totals: **You'll get** = Σ outstanding of open `lent`; **You owe** = Σ outstanding of open `borrowed`. Shown on the Loans tab and (when any are open) on the Overview.
- Open list order: overdue first, then nearest next payment / due date, then newest.

### Budgets page
- Per category: spent this month vs limit. Badge: `> 1` "Over limit", `≥ 0.9` "NN% Spent", `≥ 0.8` "Near limit", else "On track". Amber (tertiary) when ≥ 0.8.
- Safe daily budget = `max(0, limit − spent) / daysLeft`.

### Analytics page
- Range tabs Week / Month / Year → current period vs previous period of the same length; % change shown if previous > 0.
- "Under/Over budget by" only on Month with a budget.
- Donut = expense share by category (colors from `categories[id].color`). Top merchants = top 3 by spend (case-insensitive merchant name).
- Weekly trend = last 4 Monday-start weeks; dashed target = `monthlyLimit × 12 / 52` (if a budget is set).
- CSV export: all transactions, newest first → `Date, Type, Merchant / note, Category, Payment method, Amount (INR)` (see "CSV exports" below).

### CSV exports (`lib/csv.ts`, `lib/loanExport.ts`)
- Generated **in the browser** from loaded data (no server call). UTF-8 **with BOM** (Excel shows non-Latin names), CRLF rows.
- Dates: local, readable `02-Nov-2026 09:15` (`csvDateTime`) or `02-Nov-2026` (`csvDate`). Amounts: plain numbers with 2 decimals, no ₹ or grouping (`csvAmount`); expenses negative.
- Formula-injection guard: text cells starting with `= + - @` get a leading `'` (pure numbers like `-5000.00` are left numeric).
- Files: `ledgerly-transactions-YYYY-MM-DD.csv` (Analytics), `ledgerly-loans-YYYY-MM-DD.csv` (Loans tab, `loansSummaryRows`: one row per loan with Person, Type, Source, Date, Amount, Total to repay, Repaid, Outstanding, Status Open/Overdue/Settled, Repay by, Monthly payment, Payment day, Next payment, Repayments count, Last repayment, Payment method, Note), `ledgerly-<person>-statement-YYYY-MM-DD.csv` (loan detail, `personStatementRows`: **all loans with the same person name, case-insensitive**, oldest first, one row per loan start or repayment with Cash effect, Outstanding on that loan, running Net position (+ they owe you / − you owe them), then a Summary row).

### Accounts page
- Net amount per `account` (payment method; "Unspecified" if empty); tap to filter the history.

---

## 12. Screens & UX behaviour

- **Add / Edit** (`/add`, `/add?id=…`, `/add?kind=income`): Expense/Income tabs (no Transfer), amount with +₹100/+₹500/+₹1,000 chips (2-decimal max), category grid (expense only), DateTimePicker, payment method select (**defaults to UPI**), note/merchant (≤ 120), receipt file **name only**.
  - Category grid (4 columns): first shows `primaryCategories` (Food, Groceries, Transport, Shopping, Fun & Subs, Bills, Health) + a dashed **Show more** tile. Show more expands the same grid with `moreCategories` (Sending home, Fuel, Sent to friend, Rent, Education, Gifts, Personal care, **Other**) and the tile becomes **Show less**. Opens expanded when editing a transaction whose category is in `moreCategories`. No free-text categories (use the note).
  - New → saves immediately. **Edit → "Save changes?" confirm (Yes/Cancel). Delete → danger confirm.** On success → `/`.
  - Unknown/foreign id → "Transaction not found" screen.
- **DateTimePicker:** field shows "Today, 2:45 PM" / "Yesterday, …" / "Fri, 24 Oct, …"; tapping opens a **compact centered pop-up** (max 20rem wide, 1rem margin on phones) with preview, Now/Yesterday/2 days ago, Monday-first calendar, hour/minute/AM-PM; future days and times disabled; Done/Cancel; Esc or backdrop tap closes.
- **Transaction rows** (Overview recent list, Accounts history): **swipe left** (touch or mouse drag) or **tap / Enter** to reveal three actions: **View** (read-only details pop-up with an Edit button), **Edit** (`/add?id=…`), **Delete** (confirm dialog, "Yes, delete"). Only one row is open at a time (window event `ledgerly:row-open`); vertical scrolling stays native (`touch-action: pan-y`). Rows no longer navigate on tap.
- **Monthly Budget card:** app font with tabular digits; the spent/cap row and the "Daily safe pace" row wrap on narrow phones, with "N days left" in its own pill so they never collide.
- **Budgets:** Set Limit (inline AmountForm), add category budget (chips + amount), remove → confirm dialog.
- **Loans tab** (`/loans`): summary cards, **I lent money** / **I borrowed** buttons → `/loans/new?dir=…`, **Download all loans (CSV)**, Open/Settled tabs, cards with progress bar, Overdue badge, next payment and repay-by date. Tap → detail.
- **Loan form** (`/loans/new`, `?id=` to edit): I lent / I borrowed tabs, big amount, optional **Total to repay** (interest/fees), name, source chips (Friend, Relative, Online app, Bank, Other), date (DateTimePicker), payment method (default UPI), optional **Repay by** (native date input), optional **Monthly repayment plan** (amount + day 1–28), note. Edit → confirm dialog.
- **Loan detail** (`/loans/[id]`): outstanding (hero), progress, details (dates, plan, next payment, note); **Record repayment** with **Settle in full · ₹X** and **Monthly · ₹Y** quick-fill chips, date, method, note → confirm ("Record & settle loan" when it clears the balance); repayment history with remove (confirm); **Download <person>'s statement (CSV)** (covers every loan with that person; a hint shows how many others are included); Edit loan; Delete loan (danger confirm).
- **Header:** logo + subtitle, bell (no-op), UserMenu (initials → name/email/Log out).
- **Bottom nav:** Overview, Analytics, [+ FAB → /add], Budgets, **Loans**. Accounts is reached via "View All" on Recent Transactions. Quick actions: Add Expense, Add Income, Lend / Borrow, Budgets.
- **Loading:** spinner. **Load error:** "Couldn't load your data" + reason + Try again. **Empty states** on every list.
- **Errors:** forms show server messages inline (`role="alert"`); network → "You're offline…" / "Can't reach the server…"; 15 s request timeout.

---

## 13. Design system

Source: Stitch "Clean Expense Tracker" / design system "Kinetic Ledger" (`design/DESIGN.md`, screenshots in `design/`).
Tokens are defined in `src/app/globals.css` under `@theme` and used as Tailwind classes (`bg-surface`, `text-primary`, `bg-primary-fixed`, …):

| Token | Value | Use |
|---|---|---|
| `primary` | `#006947` | positive, CTAs, income |
| `secondary` | `#af301d` | expenses, destructive, errors |
| `tertiary` | `#8a4c00` | warnings (near/over budget) |
| `surface` / `surface-container-*` | `#f7f9ff` … `#dde3ec` | backgrounds, cards, tiles |
| `on-surface` / `on-surface-variant` | `#161c23` / `#3d4a42` | text |
| Radii | `sm .25rem`, default `.5rem`, `md .75rem`, `lg 1rem`, `xl 1.5rem` | |

- Utilities: `label-caps` (11px, 600, 0.06em, uppercase), `card` (white, rounded-xl, soft shadow).
- **All numbers/amounts use the app font (Hanken Grotesk) with `tabular-nums`** (even-width digits); `font-mono`/JetBrains Mono is no longer used for numbers (only the error reference code). Big figures: balance hero 36px bold (cents in `on-surface-variant`, two blurred glow blobs); Add/Edit amount input `text-5xl font-bold` (₹ in `text-outline`).
- Layout: single centered column `max-w-md`; light theme only.

---

## 14. Conventions & rules

1. **Never commit secrets**; never print them. `.env.local` stays local; Vercel env vars are *sensitive*.
2. **No mock or sample data, no localStorage for app data.** Everything comes from MongoDB via the API.
3. **Every data query is scoped to the signed-in user.** New collections need an owner field and `requireUser()`.
3a. **Loans are not transactions.** Never count loan money as income or spending; it only affects the balance via `loanCashEvents`. "Sending home" stays an expense category (planned monthly outflow).
4. **API responses** use `ok()` / `fail()` / `dbErrorResponse()` from `lib/api.ts`; validate with explicit, human-readable messages; wrap DB calls in try/catch.
5. **Amounts:** sign encodes type (expense < 0); round with `toPaise`; display with `money()`/`signedMoney()`/`moneyWhole()` (INR, `en-IN`). Never hardcode `₹` or `$`; use `CURRENCY_SYMBOL`.
6. **Destructive or modifying actions on existing records require a confirm dialog** (`ConfirmDialog`).
7. Categories (`categories`, `primaryCategories`, `moreCategories`, `pickableCategories`), payment methods and `DEFAULT_PAYMENT_METHOD` are defined once in `lib/data.ts`. Keep `CATEGORY_IDS` in `models/Transaction.ts` in sync. Adding a category = add it to `CategoryId`, `categories` (label, long name, icon, tone, chart color), one of the two lists, and `CATEGORY_IDS`.
8. Keep `MAX_AMOUNT` (1e10) in sync: `lib/api.ts`, `components/AmountForm.tsx`, `app/(app)/add/page.tsx`.
9. Client pages use `useAppData()`; don't fetch directly from pages.
10. Before pushing: `npx tsc --noEmit`, `npm run lint`, and a production build (see [§16](#16-testing--verification)).
11. Commits end with a `Co-Authored-By:` trailer when made by an AI agent. Work on `develop`; only merge to `main` to release.
12. Pin new dependency versions; check `npm audit --omit=dev` after upgrades.

---

## 15. Maintaining this file

Update this file **in the same commit** whenever you change:
- data model or indexes → §8 · API routes/status codes → §9 · auth/session → §10
- any formula or metric → §11 (and get product sign-off for §11 dashboard rows)
- screens/UX rules → §12 · design tokens → §13 · env vars → §4 · deploy/branching/infra → §5
- a non-obvious decision → add a row to §18 · a discovered pitfall → §17 · new TODO → §19

Also bump "Last updated" at the top. Keep entries factual and short; link to files rather than pasting code.

---

## 16. Testing & verification

No automated test suite yet. Verify manually:

```bash
npx tsc --noEmit && npm run lint
# Production build WITHOUT disturbing a running `npm run dev` (they share .next):
T=$(mktemp -d) && git ls-files -co --exclude-standard | grep -v '^\.env' | tar -cf - -T - | tar -xf - -C $T \
  && ln -s "$PWD/node_modules" $T/node_modules && (cd $T && npx next build) ; rm -rf $T
```

API smoke test (cookie jar):
```bash
B=http://localhost:3000; J='Content-Type: application/json'
curl -s $B/api/health
curl -s -c jar -X POST $B/api/auth/login -H "$J" -d '{"email":"…","password":"…"}'
curl -s -b jar $B/api/transactions
```

For isolated tests use a **temporary local MongoDB** (`mongod --dbpath <tmp> --port 27999`) and run a scratch build with `MONGODB_URI=mongodb://127.0.0.1:27999 MONGODB_DB=test AUTH_SECRET=$(openssl rand -hex 32) npx next start -p 3125`. Previously verified this way: redirects, signup validation, duplicate email, cross-user isolation (404s), wrong-password parity, logout, forged cookie, bcrypt storage.

---

## 17. Gotchas & troubleshooting

| Symptom | Cause / fix |
|---|---|
| Login "succeeds" locally but bounces back to /login | Dev server started before `AUTH_SECRET` existed; middleware has stale env. **Restart:** Ctrl+C → `rm -rf .next && npm run dev` |
| `Cannot find module './586.js'` / weird 404s in dev | `next build` or `next start` ran in the same folder as a running `next dev` (shared `.next`). Build in a scratch copy (see §16); restart dev with `rm -rf .next` |
| Stale `.next/types/...` tsc errors after moving pages | Generated types; delete `.next/types` or restart dev |
| `bad auth : authentication failed` | Wrong or placeholder password in `MONGODB_URI` (e.g. literal `<db_password>`); URL-encode special characters |
| Vercel: "Vulnerable version of Next.js detected" | Upgrade to the latest patched 15.5.x (`npm i next@15.5.x react@19.1.x react-dom@19.1.x eslint-config-next@15.5.x`) |
| Live site "Can't connect to MongoDB" | Atlas Network Access must include `0.0.0.0/0` |
| New branch shows no Vercel preview | Vercel skips a commit SHA that's already deployed; it builds on the next new commit |
| Preview URL redirects to a Vercel login | Deployment Protection on previews (expected). Use `npx vercel curl <path> --deployment <url>` |
| `ENOSPC` during npm install | Disk full; `npm cache clean --force` (freed 12 GB once) |
| Budget/settings duplicate-key error | `key` must be the owner's userId; never upsert with a shared constant |
| A user sees no data after signup | Expected: new accounts start empty; legacy ownerless data is hidden |
| A transaction doesn't change the Total Available Balance | Its date is earlier than when the balance was entered (`balanceAsOf`); by design. Re-enter the balance via ✎ if needed |

---

## 18. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-10-31 | Next.js App Router + Tailwind v4 from Stitch design | User request; Stitch tokens map to `@theme` |
| 2026-10-31 | MongoDB only; removed all mock data and localStorage | User request |
| 2026-10-31 | INR currency, `en-IN` grouping | User request |
| 2026-10-31 | Custom auth (bcrypt + jose JWT cookie) instead of a third-party provider | No external accounts or keys; simple Vercel deploy |
| 2026-10-31 | `key = userId` on budgets/settings | Reuse existing unique index; no migration |
| 2026-10-31 | Edits/deletes need a "Yes" confirmation; new adds don't | User request |
| 2026-10-31 | Dashboard balance = opening + all income − all spending; tiles are this month; "To Spend" renamed "Remaining" | Product spec (Sarah scenario). A brief switch to "Income − Spent + Remaining" was reverted |
| 2026-10-31 | Transfer tab, Subscriptions, Suggested Match removed | No real data source |
| 2026-10-31 | `develop` → preview, `main` → production; shared DB | User choice (separate dev DB declined) |
| 2026-10-31 | Payment defaults to UPI; date picker is a compact centered pop-up | User request |
| 2026-10-31 | Numbers use Hanken Grotesk + `tabular-nums` everywhere instead of JetBrains Mono | User feedback: mono digits (e.g. "5,000.00") looked off |
| 2026-10-31 | Transaction rows: swipe-left actions (View/Edit/Delete) instead of tap-to-edit; tap also toggles for desktop/accessibility | User request |
| 2026-10-31 | Added real categories home, fuel, friend, rent, education, gifts, personal behind a "Show more" tile (Other moved there). A short-lived `subcategory` field was removed (no data used it) | User request: categories only, no sub-levels; they work in budgets and analytics too |
| 2026-10-31 | Balance is anchored in time: only transactions dated ≥ `balanceAsOf` change it; anchor truncated to the minute; legacy docs fall back to `updatedAt` | User request. Fixes double-counting when a user enters their current balance after already logging transactions |
| 2026-11-02 | **Loans** feature (lend & borrow) as its own tab; replaces Accounts in the nav (Accounts via "View All"). Repay in full or monthly/partial; optional total-to-repay (interest), due date, monthly plan. No EMI amortisation or interest maths yet | User request. Money lent/borrowed must not distort budget or income |
| 2026-11-02 | Loan CSVs: global summary on Loans tab + per-person statement on loan detail; transactions CSV switched to readable dates via shared `lib/csv.ts` | User request |
| 2026-11-02 | "Sending home" stays an **expense** | User decision: regular planned monthly outflow, budgetable |
| 2026-10-31 | Upgraded Next 15.5.28 / React 19.1.10 / Mongoose 8.24.x | Security advisories; Vercel deploy block |

---

## 19. Known limitations / backlog

- No password reset, email verification, or login rate limiting.
- No automated tests (consider Vitest for `lib/insights.ts` and Playwright for flows).
- Notification bell and month picker are non-functional placeholders.
- Receipts: only the file name is stored; no upload or storage.
- Remaining `npm audit` item: PostCSS inside Next (build-time only; fixed only in Next 16).
- Transactions list capped at 1000 per user (no pagination).
- Shared DB across preview/dev/prod (see §5).
- No account deletion or profile edit UI.
- Loans phase 2: interest rate and EMI schedule/amortisation, missed-instalment detection (today only past `dueDate` = Overdue), due-date reminders, link a repayment to a transaction.
- Cleanup pending: test user `test.user@ledgerly-demo.dev`; legacy `settings` doc `key:"default"`.
