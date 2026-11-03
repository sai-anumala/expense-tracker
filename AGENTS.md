# AGENTS.md: Ledgerly Expense Tracker

> **Single source of truth for humans and AI agents working on this repo.**
> Read this first; it should answer most questions without exploring the code.
> **Keep it current:** any change to behaviour, data model, API, env vars, or deployment must update the relevant section here **in the same commit** (see [§15](#15-maintaining-this-file)).

Last updated: 2026-11-03 · Branch model: `develop` → `main` · Live: <https://expense-tracker-sage-six-21.vercel.app>

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
- **Transfers** between their own accounts (Bank, UPI, Cash, Credit Card; e.g. ATM withdrawal, card bill payment). Record-only: never change the balance, never income or spending

Screens: Overview (dashboard), Add/Edit Transaction, Budgets, Analytics, Loans (list, new/edit, detail), Transfer (form + history), Accounts (via "View All"), Login, Sign up.
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
| Tests | **Vitest 4.1.12** (pinned exactly), node environment | Unit tests for pure `src/lib` logic only; no UI/E2E tests yet (see [§16](#16-testing--verification)) |

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
| Unit tests | `npm test` (single run) · `npm run test:watch` |
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
        on mount: GET /api/auth/me, /api/transactions, /api/budget, /api/settings, /api/loans, /api/transfers (parallel)
        shows spinner → data | error screen with "Try again"
        exposes useAppData(): { user, logout, transactions, add, update, remove,
                                budget, saveBudget, settings, saveSettings,
                                loans, addLoan, updateLoan, removeLoan, addPayment, removePayment,
                                transfers, addTransfer, updateTransfer, removeTransfer }
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
│  ├─ (app)/transfer/page.tsx    Transfer form (From/To chips, amount, date, note; `?id=` edit) + this-month summary + history
│  ├─ (app)/loans/[id]/page.tsx  Loan detail: progress, record repayment / Settle in full, history, edit, delete
│  └─ api/
│     ├─ health/route.ts         GET public status {db, auth}; never leaks error details
│     ├─ auth/signup|login|logout|me/route.ts  (login + signup are rate-limited)
│     ├─ auth/password/route.ts  POST change password (session required, rate-limited)
│     ├─ transactions/route.ts   GET list, POST create
│     ├─ transactions/[id]/route.ts  PUT update, DELETE
│     ├─ budget/route.ts         GET, PUT (replace whole budget)
│     ├─ settings/route.ts       GET, PUT (opening balance)
│     ├─ loans/route.ts · loans/[id] · loans/[id]/payments · loans/[id]/payments/[paymentId]
│     └─ transfers/route.ts      GET list, POST create · transfers/[id]/route.ts PUT update, DELETE
├─ components/
│  ├─ ui.tsx                     AppHeader (logo, bell [no-op], UserMenu), Logo, IconTile, MonthPill [no-op], ProgressBar, SectionTitle
│  ├─ BottomNav.tsx              Fixed bottom nav (Overview, Analytics, [+], Budgets, Loans); TabPage wrapper
│  ├─ SwipeActions.tsx           Generic swipe-left row (drag/tap/Enter reveals action buttons; one open app-wide)
│  ├─ TransactionRow.tsx         Transaction row on SwipeActions (View · Edit · Delete), details pop-up, delete confirm; EmptyState
│  ├─ TransferRow.tsx            Transfer row on SwipeActions (blue ⇄ tile, neutral amount; View · Edit · Delete), details pop-up, TransferIcon
│  ├─ AmountForm.tsx             Inline ₹ amount form (validates, shows its own errors); sanitizeAmount()
│  ├─ ConfirmDialog.tsx          <dialog> Yes/Cancel modal (danger variant, busy state)
│  ├─ DateTimePicker.tsx         Field + compact centered calendar/time pop-up; formatWhen(); future dates disabled
│  ├─ AuthForm.tsx               Login/Signup form; safeNext() prevents open redirects
│  ├─ Splash.tsx                 Launch splash (logo pop, ring pulse, name + tagline, progress line)
│  ├─ BalanceNotice.tsx          Non-blocking warn/info notice + ShortfallText wording
│  ├─ ChangePasswordDialog.tsx   Centered <dialog>: current / new / confirm password, show-hide, inline errors, success state
│  └─ UserMenu.tsx               Initials avatar → menu (name, email, Change password, Log out); initials()
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
│  ├─ rateLimit.ts   (server)    MongoDB fixed-window limiter: hit/check/clear, rateKey (SHA-256), clientIp, tooMany (429 + Retry-After); fails open
│  ├─ transactionInput.ts (server) parseTransactionInput (all tx validation), toTransactionDto
│  ├─ balance.ts                 availableBalance (excl. edited record), shortfall (low-balance check)
│  ├─ csv.ts         (client)    csvDateTime/csvDate/csvAmount, toCsv (escaping + injection guard), slug, downloadCsv (BOM)
│  ├─ loanExport.ts              loansSummaryRows, personStatementRows (pure; used by Loans CSV buttons)
│  ├─ loans.ts                   (shared) Loan types, loanStatus, nextPaymentDate, loanCashEvents, loanTotals, source labels
│  ├─ loanInput.ts   (server)    parseLoanInput, parsePaymentInput, toLoanDto
│  ├─ transfers.ts               (shared, pure) TRANSFER_ACCOUNTS + labels, Transfer type, transferRoute, isCardBill, CARD_BILL_HINT, mergeFeed (tx + transfers by date), transferTotals
│  └─ transferInput.ts (server)  parseTransferInput, toTransferDto
└─ models/  User.ts · Transaction.ts · Budget.ts · Settings.ts · Loan.ts · Transfer.ts · RateLimit.ts
src/lib/__tests__/  Vitest unit tests (<module>.test.ts) + fixtures.ts builders (see §16)
test/        Vitest setup.ts (TZ, no DB) and server-only-stub.ts · vitest.config.mts at the repo root
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

**`transfers`** (`Transfer`): money moved between the user's own accounts
| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId → User | required, indexed; every query filters on it |
| `from`, `to` | enum | `bank` (Bank), `upi` (UPI), `cash` (Cash), `card` (Credit Card); `from ≠ to`. Fixed list, no custom accounts |
| `amount` | Number | > 0, ≤ 1e10, rounded to paise (always positive) |
| `date` | Date | not in the future (5 min tolerance) |
| `note` | String? | ≤ 120 |

**`ratelimits`** (`RateLimit`): fixed-window counters for the auth endpoints (see §10)
| Field | Type | Rules |
|---|---|---|
| `key` | String | **unique**; SHA-256 hex of `<kind>:<value>` (`ip:<ip>`, `login:<email>`, `signup-ip:<ip>`, `pwchange:<userId>`). Never a raw email or IP |
| `count` | Number | attempts counted in the current window |
| `windowStart` | Date | start of the window |
| `expiresAt` | Date | end of the window; **TTL index** (`expireAfterSeconds: 0`) so MongoDB deletes stale docs (TTL monitor runs about once a minute) |

No `timestamps`. Ownerless by design (keyed by hashes, never read by user-facing APIs).

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
| `POST /api/auth/signup` | public | `{name, email, password}` | 201 `{id,name,email}` + cookie | 400 validation, 409 email exists, **429** "Too many sign-up attempts from this network. Try again in N minutes." + `Retry-After` |
| `POST /api/auth/login` | public | `{email, password}` | 200 `{id,name,email}` + cookie | 401 "Incorrect email or password." (same for unknown email), **429** "Too many login attempts. Try again in N minutes." + `Retry-After` (seconds) |
| `POST /api/auth/logout` | public | – | 200, cookie cleared | – |
| `GET /api/auth/me` | session | – | `{id,name,email}` (re-read from DB) | 401 (and cookie cleared if user deleted) |
| `POST /api/auth/password` | session | `{currentPassword, newPassword}` | 200 `{changed: true}` | 400 "Current password is incorrect." / "New password must be at least 8 characters." / "New password must be different."; 401; **429** "Too many wrong password attempts…" + `Retry-After` |
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

| `GET /api/transfers` | session | – | `Transfer[]` newest first (max 1000) | – |
| `POST /api/transfers` | session | `{from, to, amount, date(ISO), note?}` | 201 `Transfer` | 400 unknown account / same from-to / amount ≤ 0 or too large / invalid or future date / note > 120 |
| `PUT /api/transfers/:id` | session | same as POST (omitted `note` is removed) | 200 `Transfer` | 400; 404 not found **or not owned** (same message) |
| `DELETE /api/transfers/:id` | session | – | 200 `{id}` | 404 not found / not owned |

`Loan` DTO: fields above plus `id`, `payments[]` (each with `id`, newest first). Status is computed client-side with `loanStatus()`.

`Transfer` DTO: `{ id, from, to, amount, date, note? }`. Validation in `lib/transferInput.ts`.

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
- **Rate limiting** (`lib/rateLimit.ts`, collection `ratelimits`, fixed windows stored in MongoDB because Vercel functions share no memory):
  | Endpoint | Key | Limit | What counts |
  |---|---|---|---|
  | `POST /api/auth/login` | `ip:<ip>` | 20 / 15 min | every attempt (after basic input checks) |
  | `POST /api/auth/login` | `login:<email>` | 5 / 15 min | **failures only**; the 6th attempt is refused even with the right password; cleared on successful login |
  | `POST /api/auth/signup` | `signup-ip:<ip>` | 10 / hour | every attempt that passes validation |
  | `POST /api/auth/password` | `pwchange:<userId>` | 5 / 15 min | wrong current password only; cleared on success |
  - Blocked → **429** `"Too many … Try again in N minutes."` with `Retry-After` (seconds). `AuthForm` and the change-password dialog show the server message inline.
  - Keys are **SHA-256 hashes** (`node:crypto`) of `<kind>:<value>`: no raw emails or IPs are stored. Client IP = first `x-forwarded-for` entry (Vercel sets it), else `x-real-ip`, else `"unknown"`.
  - **Fails open:** if the rate-limit step itself errors it logs `rateLimit.* failed` and allows the request; DB errors in the main operation keep the normal `dbErrorResponse` handling.
  - **Known trade-off:** anyone who knows an email can trigger 5 failed logins and lock that email out for up to 15 minutes (no data exposed; clears itself). Standard for per-account limits.
  - Atomic: one `findOneAndUpdate` upsert with an aggregation pipeline ("reset if expired, else +1"); a duplicate-key race on first insert is retried once.
- **Change password:** `POST /api/auth/password` (session required; not in `PUBLIC_API`). Verifies the current password with bcrypt, validates the new one with `validatePassword` (8–72), rejects new = current, saves a new bcrypt hash (cost 12). The current session stays valid; **other devices stay signed in** until their cookie expires (stateless JWTs, see §19).

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
| Recent transactions | latest **5** items of transactions **and transfers** merged by date, grouped Today / Yesterday / "Oct 28"; group header shows the net of that day's **transactions only** (transfers are net-zero; header hidden if the day has only transfers). Transfer amounts are neutral. Amounts: **expense red** (`text-secondary`), **income green** (`text-primary`) |
| Insight tip | biggest % change vs last month in a category present both months; hidden if none |

Balance entry: if `null`, the card asks "How much money do you have right now?". The ✎ opens pre-filled with the **current** balance; saving re-anchors (new amount, `balanceAsOf` = now). The value is stored exactly as typed. Hovering the balance shows when it was set.
Examples: entered ₹10,000 at 4:30 PM → a ₹500 expense dated 2 PM is ignored (balance stays ₹10,000); a ₹50 expense dated 4:30 PM (same minute) counts → ₹9,950.

Reference scenario (from the spec): budget 3,000, spent 1,830.40 → Remaining 1,169.60; 12 days left → 97.46/day.

### Low-balance warnings (`lib/balance.ts`, `components/BalanceNotice.tsx`)
- **Never block saving**; amber "warn" or neutral "info" notice only.
- `availableBalance(transactions, loans, settings, {transactionId?, loanId?})` = current Total Available Balance, excluding the record being edited (no double counting); `null` when no balance is set → no warnings.
- `shortfall(available, outflow, date, balanceAsOf)` warns when money **going out** exceeds what's available, only if the item is dated ≥ `balanceAsOf` (earlier items don't change the balance).
- Where: **Add/Edit expense** (under the amount), **I lent** loan form (under the amount), **repayment of a borrowed loan** (loan detail). Income and money received back never warn. Wording via `ShortfallText` (handles an already-negative balance).
- **Budgets (info):** monthly budget > available balance; category budgets total > monthly budget.

### Loans (lend & borrow)
- **Never income or spending:** loans don't touch Income, Spent, Remaining, budgets or analytics. They only move Total Available Balance (and only when dated ≥ `balanceAsOf`).
- `paid = Σ payments`, `outstanding = max(0, totalDue − paid)`, **settled** when outstanding = 0, `progress = paid / totalDue`.
- **Overdue** = not settled and `dueDate` < today. **Next payment** (monthly plan) = next `paymentDay` on/after today (and after the loan date); amount shown = `min(monthlyPayment, outstanding)`.
- Totals: **You'll get** = Σ outstanding of open `lent`; **You owe** = Σ outstanding of open `borrowed`. Shown on the Loans tab and (when any are open) on the Overview.
- Open list order: overdue first, then nearest next payment / due date, then newest.

### Transfers (own accounts; `lib/transfers.ts`)
- **Simple one-total model:** a transfer only records that money moved (Bank/UPI/Cash/Credit Card). It **never changes Total Available Balance** (not passed to `anchoredBalance`/`availableBalance`), and is **never income or spending**: excluded from Income/Spent/Remaining tiles, budgets, analytics + its CSV, Accounts per-method totals and low-balance warnings. No per-account balances.
- **Credit card bill = transfer:** any non-card account → `card` (`isCardBill`) shows the hint "Card bill payment. Not counted as spending, because the purchases were already recorded as expenses." Any other pair is allowed; `from ≠ to`.
- **Overview Recent Transactions** = latest **5** of transactions and transfers merged by date (`mergeFeed`; ties keep transactions first). The day-group "net" header sums **transactions only** (hidden when a day shows only transfers).
- Transfer screen summary: "This month: N transfers · ₹X" (`transferTotals` over the current month).

### Budgets page
- Per category: spent this month vs limit. Badge: `> 1` "Over limit", `≥ 0.9` "NN% Spent", `≥ 0.8` "Near limit", else "On track". Amber (tertiary) when ≥ 0.8.
- Safe daily budget = `max(0, limit − spent) / daysLeft`.

### Analytics page
- Range tabs Week / Month / Year → current period vs previous period of the same length; % change shown if previous > 0.
- "Under/Over budget by" only on Month with a budget.
- Donut = expense share by category. **Colours come from a validated palette applied in ring order** (largest slice first): `#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4 #008300 #6250d6` (dataviz validator on white: adjacent CVD ΔE ≥ 9.1, normal-vision ΔE ≥ 19.6; low-contrast slots are fine because every slice has a text label). **Max 7 named slices**; the rest fold into a grey `#b4bac3` "More categories (n)" slice whose legend row lists its members (a single leftover keeps its own name). Flat ends with a small gap between slices. `categories[id].color` is no longer used by the ring.
- **Focus:** nothing is highlighted by default (centre shows the top category). Mouse: hover focuses, leaving resets. Touch: tap toggles; tapping outside the chart and list resets. Keyboard: Tab (focus-visible) focuses, Enter/Space toggles, Esc resets. The focused slice thickens (11→15) and others fade to 30%; the legend dims the other rows. Handlers live in `focusHandlers()` (per pointer type, so a phone tap's hover+focus+click don't cancel each other). The centre label is `pointer-events-none`. The breakdown is shown only when the period has **expenses** (income-only periods show the empty state). Below the ring: **one row per slice** (full name, amount, %, thin bar in the slice colour).
- Weekly trend = last 4 Monday-start weeks; dashed target = `monthlyLimit × 12 / 52` (if a budget is set).
- CSV export: all transactions, newest first → `Date, Type, Merchant / note, Category, Payment method, Amount (INR)` (see "CSV exports" below).

### CSV exports (`lib/csv.ts`, `lib/loanExport.ts`)
- Generated **in the browser** from loaded data (no server call). UTF-8 **with BOM** (Excel shows non-Latin names), CRLF rows.
- Dates inside files: local **`DD/MM/YYYY HH:mm`** (`csvDateTime`, e.g. `02/11/2026 09:15`) or **`DD/MM/YYYY`** (`csvDate`). File names keep `YYYY-MM-DD` so they sort. Amounts: plain numbers with 2 decimals, no ₹ or grouping (`csvAmount`); expenses negative.
- Formula-injection guard: text cells starting with `= + - @` get a leading `'` (pure numbers like `-5000.00` are left numeric).
- Files (loan CSVs are intentionally **simple**: few columns, date only):
  - `ledgerly-transactions-YYYY-MM-DD.csv` (Analytics): Date, Type, Merchant / note, Category, Payment method, Amount (INR).
  - `ledgerly-loans-YYYY-MM-DD.csv` (button at the **end** of the Loans tab, `loansSummaryRows`): `Person, Type (Lent/Borrowed), Date, Total (INR), Repaid (INR), Remaining (INR), Status (Open/Overdue/Settled)`, then a blank line and `You will get` / `You owe` totals.
  - `ledgerly-<person>-statement-YYYY-MM-DD.csv` (loan detail, `personStatementRows`): passbook style `Date, Details, Amount (INR)` covering **every loan with that person** (name match, case-insensitive), oldest first: "You gave to X" / "You borrowed from X", "Interest / fees" (when total to repay > amount), "X paid you back" / "You paid back X"; final line "X owes you" / "You owe X" / "All settled" with the amount.

### Accounts page
- Net amount per `account` (payment method; "Unspecified" if empty); tap to filter the history.

---

## 12. Screens & UX behaviour

- **Add / Edit** (`/add`, `/add?id=…`, `/add?kind=income`): Expense/Income tabs (no Transfer), amount with +₹100/+₹500/+₹1,000 chips (2-decimal max), category grid (expense only), DateTimePicker, payment method select (**defaults to UPI**), note/merchant (≤ 120), receipt file **name only**.
  - Category grid (4 columns): first shows `primaryCategories` (Food, Groceries, Transport, Shopping, Fun & Subs, Bills, Health) + a dashed **Show more** tile. Show more expands the same grid with `moreCategories` (Sending home, Fuel, Sent to friend, Rent, Education, Gifts, Personal care, **Other**) and the tile becomes **Show less**. Opens expanded when editing a transaction whose category is in `moreCategories`. No free-text categories (use the note).
  - New → saves immediately. **Edit → "Save changes?" confirm (Yes/Cancel). Delete → danger confirm.** On success → `/`.
  - Unknown/foreign id → "Transaction not found" screen.
- **DateTimePicker:** field shows "Today, 2:45 PM" / "Yesterday, …" / "Fri, 24 Oct, …"; tapping opens a **compact centered pop-up** (max 20rem wide, 1rem margin on phones) with preview, Now/Yesterday/2 days ago, Monday-first calendar, hour/minute/AM-PM; future days and times disabled; Done/Cancel; Esc or backdrop tap closes.
- **Transaction rows** (Overview recent list, Accounts history; built on `SwipeActions`): **swipe left** (touch or mouse drag) or **tap / Enter** to reveal three actions: **View** (read-only details pop-up with an Edit button), **Edit** (`/add?id=…`), **Delete** (confirm dialog, "Yes, delete"). Only one row is open at a time (window event `ledgerly:row-open`); vertical scrolling stays native (`touch-action: pan-y`). Rows no longer navigate on tap.
- **Monthly Budget card:** app font with tabular digits; the spent/cap row and the "Daily safe pace" row wrap on narrow phones, with "N days left" in its own pill so they never collide.
- **Budgets:** Set Limit (inline AmountForm), add category budget (chips + amount). Category cards use **SwipeActions**: swipe left / tap → **Edit** (inline limit form under the card) and **Delete** (confirm dialog). Card layout is two rows (name ↔ spent / limit; left/over ↔ status badge) with truncation and wrapping so nothing overlaps on small phones.
- **Loans tab** (`/loans`): summary cards, **I lent money** / **I borrowed** buttons → `/loans/new?dir=…`, Open/Settled tabs, **Download all loans (CSV)** at the end, cards with progress bar, Overdue badge, next payment and repay-by date. Tap → detail.
- **Loan form** (`/loans/new`, `?id=` to edit): I lent / I borrowed tabs, big amount, optional **Total to repay** (interest/fees), name, source chips (Friend, Relative, Online app, Bank, Other), date (DateTimePicker), payment method (default UPI), optional **Repay by** (native date input), optional **Monthly repayment plan** (amount + day 1–28), note. Edit → confirm dialog.
- **Loan detail** (`/loans/[id]`): outstanding (hero), progress, details (dates, plan, next payment, note); **Record repayment** with **Settle in full · ₹X** and **Monthly · ₹Y** quick-fill chips, date, method, note → confirm ("Record & settle loan" when it clears the balance); repayment history with remove (confirm); **Download <person>'s statement (CSV)** (covers every loan with that person; a hint shows how many others are included); Edit loan; Delete loan (danger confirm).
- **Header:** logo + subtitle, bell (no-op), UserMenu (initials → name/email, **Change password**, Log out).
- **Change password dialog** (`components/ChangePasswordDialog.tsx`, from the account menu): compact centered `<dialog>` (rounded-2xl, `w-[min(22rem,calc(100%-2rem))]`) with Current password, New password (show/hide toggle for all fields, "At least 8 characters" hint), Confirm new password. Client checks (required, length, match, different) then server errors inline (`role="alert"`); busy "Saving…"; success shows "Password changed" (motion-safe pop) and closes after ~1.8 s or on Done. Esc / backdrop / Cancel close it (not while busy). No extra confirm dialog: entering the current password is the confirmation.
- **Bottom nav:** Overview, Analytics, [+ FAB → /add], Budgets, **Loans**. Accounts is reached via "View All" on Recent Transactions. Quick actions: Add Expense, Add Income, **Transfer** (→ `/transfer`), Lend / Borrow.
- **Transfer** (`/transfer`, `/transfer?id=…` to edit): compact animated header (From-account icon → coins → To-account icon, dashed line; `motion-safe:`), **From** and **To** chip rows (Bank, UPI, Cash, Credit Card) with a swap button; the From account is disabled in the To row, and picking the current To as From swaps them. Card-bill hint (blue) when To = Credit Card. Big amount input (same style as Add Expense, `sanitizeAmount`), DateTimePicker, optional note (≤ 120). New → saves directly, shows a "Saved …" status and resets the form; Edit → "Save changes to this transfer?" confirm, then back to `/transfer`. Server errors inline (`role="alert"`). Unknown id → "Transfer not found". Below: "Your transfers" history (newest first) with "This month: N transfers · ₹X", rows via `TransferRow`; empty state. Not in the bottom nav (a 6th item would crowd small phones). All animations use `motion-safe:` (keyframes `ledgerly-travel/float/shimmer/fade-up/dash/pop/ring/progress/fade-in` in `globals.css`).
- **Transfer rows** (`components/TransferRow.tsx`, on `SwipeActions`, same structure as transaction rows): blue ⇄ tile (`bg-[#e3eefc] text-[#2a78d6]`), title = note or "Card bill payment"/"Transfer", line "Bank → Cash · 2:45 PM", amount in **neutral** text (`₹2,000.00`, no sign, not red/green). Actions: View (details pop-up with Edit), Edit (`/transfer?id=…`), Delete (danger confirm). Shown in Overview Recent Transactions, Accounts history (with a payment-method filter, transfers whose From/To label equals the method name, e.g. "UPI", "Cash", "Credit Card") and the Transfer screen.
- **Launch splash** (`components/Splash.tsx`): while the signed-in app loads, the logo tile pops in (spring), one soft ring pulse, "Ledgerly" + tagline "Track every rupee, calmly." slide up, a thin progress line glides; shown for **at least 800 ms** (`introDone` in the provider) so it finishes, longer only if data is still loading; then the app fades in (0.4 s). Plays on app open only (the `(app)` layout persists across tabs). Login/Sign-up get the same entrance (logo pop, staggered fade-up). All `motion-safe:`.
- **Loading:** the launch splash (above). **Load error:** "Couldn't load your data" + reason + Try again. **Empty states** on every list.
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
3b. **Transfers are not transactions.** Money moved between the user's own accounts never changes Total Available Balance and is never income or spending; keep transfers out of every total (balance, tiles, budgets, analytics/CSV, Accounts totals, day-net headers, low-balance warnings). They are only displayed in history lists.
4. **API responses** use `ok()` / `fail()` / `dbErrorResponse()` from `lib/api.ts`; validate with explicit, human-readable messages; wrap DB calls in try/catch.
5. **Amounts:** sign encodes type (expense < 0); round with `toPaise`; display with `money()`/`signedMoney()`/`moneySigned()` (balances)/`moneyWhole()` (INR, `en-IN`). Never hardcode `₹` or `$`; use `CURRENCY_SYMBOL`.
6. **Destructive or modifying actions on existing records require a confirm dialog** (`ConfirmDialog`).
7. Categories (`categories`, `primaryCategories`, `moreCategories`, `pickableCategories`), payment methods and `DEFAULT_PAYMENT_METHOD` are defined once in `lib/data.ts`. Keep `CATEGORY_IDS` in `models/Transaction.ts` in sync. Adding a category = add it to `CategoryId`, `categories` (label, long name, icon, tone, chart color), one of the two lists, and `CATEGORY_IDS`.
8. Keep `MAX_AMOUNT` (1e10) in sync: `lib/api.ts`, `components/AmountForm.tsx`, `app/(app)/add/page.tsx`.
9. Client pages use `useAppData()`; don't fetch directly from pages.
10. Before pushing: `npx tsc --noEmit`, `npm run lint`, `npm test`, and a production build (see [§16](#16-testing--verification)).
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

**Parallel work with sub-agents:** independent tasks can run in separate git worktrees (`.claude/worktrees/<agent>`, branches `worktree-agent-…`) created from `develop`. The coordinating session reviews each branch, re-runs tsc/lint/build, merges into `develop`, then previews. Sub-agents never push or touch `main`, and test only against a temporary local MongoDB.

### Unit tests (Vitest)
- Run: `npm test` (single run, as in CI) or `npm run test:watch`. Takes about a second; no network, no database.
- Location: `src/lib/__tests__/<module>.test.ts` (one file per module in `src/lib`). Shared builders (`tx`, `loan`, `payment`, `local`, `iso`) live in `src/lib/__tests__/fixtures.ts`.
- Covered: `insights` (period bounds, totals, `anchoredBalance`), `loans`, `balance`, `csv`, `loanExport`, and the server validators `transactionInput`, `loanInput`, `authInput`. Not covered: React components, API routes, Mongoose models.
- Config: `vitest.config.mts`: `@/*` → `src/*` alias, `environment: "node"`, `server-only` aliased to the empty `test/server-only-stub.ts` (so server validators import cleanly). `test/setup.ts` deletes `MONGODB_URI` and restores real timers after each test.
- **Time zone is pinned to `Asia/Kolkata`** (set in the config and the setup file), so local-date maths gives the same results on any machine. Use `local()`/`iso()` from fixtures for dates and `vi.useFakeTimers()` + `vi.setSystemTime()` wherever "now" matters.
- Convention: a known bug can be pinned with `it.fails` (listed in §19); when it's fixed the test starts failing, so switch it to `it`. (The first one, `slug()` splitting Devanagari/accented names, was fixed on 2026-11-03.)

### Manual checks

```bash
npx tsc --noEmit && npm run lint && npm test
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
| Thousands of lint/tsc errors from `.claude/worktrees/...` | Sub-agent worktrees live inside the repo. They are excluded in `eslint.config.mjs` (`.claude/**`), `tsconfig.json` (`exclude`) and `.gitignore` (`.claude/worktrees/`); keep those exclusions |
| "Too many login attempts" while testing locally | Per-email/IP counters live in the `ratelimits` collection of the **shared** DB. Wait for `Retry-After`, or (local/temporary DB only) delete the doc; keys are hashes, so `db.ratelimits.deleteMany({})` on a scratch DB. Without a proxy, local requests all share IP `unknown` unless `x-forwarded-for` is sent |
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
| 2026-11-02 | Loan CSVs (kept simple on request): all-loans summary at the end of the Loans tab + passbook-style per-person statement on loan detail; transactions CSV switched to readable dates via shared `lib/csv.ts` | User request |
| 2026-11-02 | Analytics ring: validated palette in ring order, top 7 + "More categories", fixed always-on focus bug (top slice was always highlighted), per-input focus handling | User feedback (colours not pleasant; only the selected slice should be focused) |
| 2026-11-02 | Launch splash + app fade-in; auth screens entrance animation (motion-safe, ≥ 800 ms) | User request: clean, attractive opening |
| 2026-11-02 | Transfer "Coming soon" page via Overview quick action (not the nav) | User request; nav space |
| 2026-11-02 | Recent transactions = latest 5; expense amounts red, income green; interactive analytics ring | User request |
| 2026-11-02 | Swipe actions extracted into `SwipeActions`; used for transactions and category budgets. Analytics breakdown as full-width rows | User request (overlapping text on small phones; truncated names) |
| 2026-11-02 | CSV dates DD/MM/YYYY; non-blocking low-balance warnings (expense, lending, repaying) + budget info notices | User request; warn instead of block because real life allows overdraft/credit |
| 2026-11-02 | "Sending home" stays an **expense** | User decision: regular planned monthly outflow, budgetable |
| 2026-11-03 | Auth rate limiting stored in MongoDB (`ratelimits`, TTL index, hashed keys, fail open) + Change password (`POST /api/auth/password`, account-menu dialog) | User request. Vercel serverless has no shared memory; no new dependency or provider (Redis) needed. Fail open so a counter problem never locks users out |
| 2026-10-31 | Upgraded Next 15.5.28 / React 19.1.10 / Mongoose 8.24.x | Security advisories; Vercel deploy block |
| 2026-11-03 | Vitest unit tests for pure business logic (`src/lib/__tests__`), TZ pinned to Asia/Kolkata, `server-only` stubbed. Chose the mature 4.1.x line (4.1.12) over the newer 5.x | Lock in §11 formulas and server validation without touching the DB; no app behaviour changed |
| 2026-11-03 | **Transfers** between own accounts replace the "Coming soon" page: simple one-total model (no per-account balances), fixed accounts Bank/UPI/Cash/Credit Card, credit card bill = transfer, shown in Recent Transactions / Accounts history, excluded from every total | User decisions (final). Card purchases are already expenses, so paying the bill must not count twice |

---

## 19. Known limitations / backlog

- No password reset by email (needs an email provider) and no email verification.
- Sessions are stateless JWTs: changing the password does **not** sign out other devices (they stay signed in until their 30-day cookie expires). Fix would need a per-user `tokenVersion`/`passwordChangedAt` checked on each request.
- Rate limits are fixed windows per IP/email; many users behind one NAT share the per-IP budget (20 logins / 15 min, 10 sign-ups / hour).
- No UI or end-to-end tests yet (unit tests cover `src/lib` only; consider Playwright for flows). API routes (incl. rate limiting) are verified manually against a temporary MongoDB, not by automated tests.
- Notification bell and month picker are non-functional placeholders.
- Receipts: only the file name is stored; no upload or storage.
- Remaining `npm audit` item: PostCSS inside Next (build-time only; fixed only in Next 16).
- Transactions list capped at 1000 per user (no pagination).
- Shared DB across preview/dev/prod (see §5).
- No account deletion or profile edit UI.
- No per-account balances (simple model): transfers are recorded but Bank/UPI/Cash/Card balances aren't tracked separately. Transfers list capped at 1000 per user.
- Loans phase 2: interest rate and EMI schedule/amortisation, missed-instalment detection (today only past `dueDate` = Overdue), due-date reminders, link a repayment to a transaction.
- Cleanup pending: test user `test.user@ledgerly-demo.dev`; legacy `settings` doc `key:"default"`.
