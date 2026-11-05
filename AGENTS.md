# AGENTS.md: Ledgerly Expense Tracker

> **Single source of truth for humans and AI agents working on this repo.**
> Read this first; it should answer most questions without exploring the code.
> **Keep it current:** any change to behaviour, data model, API, env vars, or deployment must update the relevant section here **in the same commit** (see [§15](#15-maintaining-this-file)).

Last updated: 2026-11-06 · Branch model: `develop` → `main` · Live: <https://expense-tracker-sage-six-21.vercel.app>

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

**Ledgerly** is a mobile-first, responsive (phone to large monitor), multi-user personal expense tracker. Anyone can sign up; each user has their own:
- **Transactions** (expenses and income, with category, date/time, payment method, note)
- **Total available balance** (cash they have, entered at a point in time; only later transactions change it)
- **Budget** (overall monthly limit and optional per-category limits)
- **Loans** (money lent to / borrowed from friends, relatives, online apps, banks, with repayments)
- **Transfers** between their own accounts (Bank, UPI, Cash, Credit Card; e.g. ATM withdrawal, card bill payment). Never income or spending; only transfers to/from the credit card change the available balance
- **Credit card** (one card): statement day, due day, optional limit; bill to pay, unbilled amount, due date, utilization. Card purchases count as spending but don't reduce the available balance until the bill is paid
- **Gmail auto-capture** (optional): a script in the user's own Google account sends bank alert emails to a **To review** list; nothing counts until the user adds it

Screens: Overview (dashboard), Add/Edit Transaction, Budgets, Analytics, Loans (list, new/edit, detail), Transfer (form + history), Credit Card, Accounts (via "View All"), To review, Gmail auto-capture, Login, Sign up.
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
        on mount: GET /api/auth/me, /api/transactions, /api/budget, /api/settings, /api/loans, /api/transfers, /api/captured (parallel); /api/captured again when the tab becomes visible
        shows spinner → data | error screen with "Try again"
        exposes useAppData(): { user, logout, transactions, add, update, remove,
                                budget, saveBudget, settings, saveSettings, saveCard,
                                loans, addLoan, updateLoan, removeLoan, addPayment, removePayment,
                                transfers, addTransfer, updateTransfer, removeTransfer,
                                captured, confirmCaptured, dismissCaptured,
                                getCaptureStatus, createCaptureToken, revokeCaptureToken }
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
│  ├─ layout.tsx                 Root: fonts, metadata/viewport. NO data provider
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
│  ├─ (app)/transfer/page.tsx    Transfer form (From/To chips, amount, date, note; `?id=` edit; `?from=&to=&amount=` prefill) + bill-payment low-balance warning + this-month summary + history
│  ├─ (app)/card/page.tsx        Credit Card screen: setup/edit/remove card, bill to pay + due badge, Pay bill → Transfer, unbilled/total due, limit bar, this-cycle + last-statement lists
│  ├─ (app)/loans/[id]/page.tsx  Loan detail: progress, record repayment / Settle in full, history, edit, delete
│  ├─ (app)/review/page.tsx      To review: one editable card per captured bank alert; Add / Not a transaction
│  ├─ (app)/capture/page.tsx     Gmail auto-capture setup: create/replace/turn off the script, steps, privacy note
│  └─ api/
│     ├─ health/route.ts         GET public status {db, auth}; never leaks error details
│     ├─ auth/signup|login|logout|me/route.ts  (login + signup are rate-limited)
│     ├─ auth/password/route.ts  POST change password (session required, rate-limited)
│     ├─ transactions/route.ts   GET list, POST create
│     ├─ transactions/[id]/route.ts  PUT update, DELETE
│     ├─ budget/route.ts         GET, PUT (replace whole budget)
│     ├─ settings/route.ts       GET, PUT (balance + unpaid card amount; re-anchors)
│     ├─ settings/card/route.ts  PUT card setup `{statementDay, dueDay, limit?}` or `{card: null}` (no re-anchor)
│     ├─ loans/route.ts · loans/[id] · loans/[id]/payments · loans/[id]/payments/[paymentId]
│     ├─ transfers/route.ts      GET list, POST create · transfers/[id]/route.ts PUT update, DELETE
│     ├─ capture/email/route.ts  POST a bank alert from the Gmail script (public in middleware; own token auth)
│     ├─ capture/token/route.ts  GET status, POST create/replace, DELETE revoke
│     └─ captured/route.ts       GET review list · captured/[id] DELETE dismiss · captured/[id]/confirm POST
├─ components/
│  ├─ ui.tsx                     AppHeader (logo, NotificationBell, UserMenu; + OverviewAlertBanner below the header on "/"), Logo, IconTile, MonthPill [no-op], ProgressBar, SectionTitle
│  ├─ NotificationBell.tsx       🔔 with urgent+warning count badge → reminders panel (outside click / Esc closes); useAlerts(), alertIcons, severityTile
│  ├─ AlertBanner.tsx            Slim dismissible banner with the top urgent/warning reminder; OverviewAlertBanner shows it only on "/"
│  ├─ BottomNav.tsx              Bottom nav on phones (Overview, Analytics, [+], Budgets, Loans); TabPage wrapper
│  ├─ SideNav.tsx                Side rail / sidebar from md (replaces the bottom nav)
│  ├─ SwipeActions.tsx           Generic swipe-left row (drag/tap/Enter reveals action buttons; one open app-wide)
│  ├─ TransactionRow.tsx         Transaction row on SwipeActions (View · Edit · Delete), details pop-up, delete confirm; EmptyState
│  ├─ TransferRow.tsx            Transfer row on SwipeActions (blue ⇄ tile, neutral amount; View · Edit · Delete), details pop-up, TransferIcon
│  ├─ AmountForm.tsx             Inline ₹ amount form (validates, shows its own errors); sanitizeAmount()
│  ├─ BalanceForm.tsx            Overview balance entry: Bank + UPI + cash (required) + unpaid credit card amount (optional, empty = 0)
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
│  ├─ alerts.ts                  (pure) buildAlerts → sorted reminders (card bill/usage, loans, budgets); thresholds as constants; isAttention
│  ├─ format.ts                  money (₹, en-IN), moneyWhole, signedMoney, timeOf, monthLabel, daysLeftInMonth, plural, dayBucket
│  ├─ db.ts          (server)    connectDb() with global cached connection; isDbConfigured()
│  ├─ api.ts         (server)    ok/fail, requireDb, readJsonObject, dbErrorResponse, MAX_AMOUNT, toPaise
│  ├─ session.ts     (edge-safe) JWT create/verify, SESSION_COOKIE, isAuthConfigured
│  ├─ auth.ts        (server)    getSession, requireUser, set/clearSessionCookie
│  ├─ authInput.ts   (server)    validateEmail/Password/Name, normalizeEmail
│  ├─ rateLimit.ts   (server)    MongoDB fixed-window limiter: hit/check/clear, rateKey (SHA-256), clientIp, tooMany (429 + Retry-After); fails open
│  ├─ transactionInput.ts (server) parseTransactionInput (all tx validation), toTransactionDto
│  ├─ balance.ts                 availableBalance(transactions, transfers, loans, settings, exclude) via availableCashEvents (excl. edited record), shortfall (low-balance check)
│  ├─ creditCard.ts              (shared, pure) card model: CARD_ACCOUNT, availableCashEvents, transferCashEffect, expenseCashOutflow, cardDueEvents, statement dates, cardSummary, currentCardDue, needsCardDuePrompt
│  ├─ settingsInput.ts (server)  parseBalanceInput, parseCardInput, toSettingsDto
│  ├─ csv.ts         (client)    csvDateTime/csvDate/csvAmount, toCsv (escaping + injection guard), slug, downloadCsv (BOM)
│  ├─ loanExport.ts              loansSummaryRows, personStatementRows (pure; used by Loans CSV buttons)
│  ├─ loans.ts                   (shared) Loan types, loanStatus, nextPaymentDate, loanCashEvents, loanTotals, source labels
│  ├─ loanInput.ts   (server)    parseLoanInput, parsePaymentInput, toLoanDto
│  ├─ transfers.ts               (shared, pure) TRANSFER_ACCOUNTS + labels, Transfer type, transferRoute, isCardBill/isCardAdvance, CARD_BILL_HINT/CARD_ADVANCE_HINT/OWN_TRANSFER_HINT + transferHint, transferPrefill, mergeFeed (tx + transfers by date), transferTotals
│  ├─ transferInput.ts (server)  parseTransferInput, toTransferDto
│  ├─ bankAlertParser.ts         (pure) alertText, maskAlert, parseBankAlert: bank email → suggested transaction, or ignored
│  ├─ captureMatch.ts            (pure) CapturedItem type, suggestCategory, possibleDuplicate
│  ├─ deadline.ts                (pure) withDeadline: give up on a promise after a time limit
│  ├─ captureToken.ts (server)   generateCaptureToken, hashCaptureToken, bearerToken, captureDedupeKey, toCapturedDto
│  └─ gmailScript.ts             (pure) buildGmailScript: the Apps Script text with the user's URL and token
└─ models/  defineModel.ts (dev-safe registration) · User.ts · Transaction.ts · Budget.ts · Settings.ts · Loan.ts · Transfer.ts · RateLimit.ts · CaptureToken.ts · CapturedTransaction.ts
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
| `cardDueAtAnchor` | Number \| null | Unpaid credit card amount (billed + unbilled) entered **with** the balance, ≥ 0, at `balanceAsOf`. Saved as 0 when the balance is re-entered without it; null when the balance is cleared. Docs from before the card model lack it → API returns null (Overview shows the one-time prompt) |
| `card` | `{statementDay 1–28, dueDay 1–28, limit? > 0}` \| null | Single credit card setup (sub-schema, no `_id`, strict). Saved separately; never re-anchors the balance. `null` = not set up |

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

**`capturetokens`** (`CaptureToken`): one per user, for the Gmail script
| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId → User | required, **unique** |
| `tokenHash` | String | **unique**; SHA-256 hex. The plain token (`ldg_…`) is shown once and never stored |
| `lastUsedAt` | Date? | last alert received with this token, captured or not |

**`capturedtransactions`** (`CapturedTransaction`): bank alerts waiting for review; deleted on confirm or dismiss. Never counted in any total
| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId → User | required; every query filters on it. Indexed with `receivedAt` |
| `text` | String | masked alert (no account/card/reference numbers or balances), ≤ 1000 |
| `sender` | String? | ≤ 120 |
| `receivedAt` | Date | required |
| `amount` | Number | > 0 (always positive; `kind` gives the direction) |
| `kind` | enum | `expense, income, cardBill, atmWithdrawal` (suggestion; the user can change it) |
| `account`, `merchant` | String? | suggestions, ≤ 80 / ≤ 120 |
| `status` | enum | `pending`, `confirming` (claimed, so a double tap can't save twice; a claim older than 60 s can be retried) |
| `dedupeKey` | String | SHA-256 of the Gmail message id; **unique with `userId`** |
| `expiresAt` | Date | arrival + 30 days; **TTL index** |

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
| `GET /api/settings` | session | – | `{openingBalance, balanceAsOf, cardDueAtAnchor, card}` (ISO / null defaults) | – |
| `PUT /api/settings` | session | `{openingBalance: number ≥ 0 \| null, cardDueAtAnchor?: number ≥ 0}` | 200 settings; server sets `balanceAsOf` = now (to the minute) and `cardDueAtAnchor` = given or **0**; both null when clearing the balance. `card` untouched | 400 "Opening balance must be 0 or more." / "Unpaid credit card amount must be 0 or more." / too large |
| `PUT /api/settings/card` | session | `{statementDay, dueDay, limit?}` or `{card: null}` (remove) | 200 full settings; balance and `balanceAsOf` untouched | 400 "Statement day / Due day must be a whole day between 1 and 28.", "Due day must be different from the statement day.", "Credit limit must be more than zero (or leave it empty).", "Credit limit is too large." |

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

| `POST /api/capture/email` | **Bearer token** (public in middleware) | `{messageId, subject?, text, sender?, receivedAt?}`; subject + text ≤ 5000 | 200 `{captured: true}` or `{captured: false, reason}` (`otp, failed, request, upcoming, reminder, promotion, not-a-transaction, duplicate, queue-full`) | 400 missing id/text or too long; 401 bad or revoked token; **429** + `Retry-After`; **503** after 25 s (retried by the script) |
| `GET /api/capture/token` | session | – | `{exists, createdAt, lastUsedAt}` (never the token) | – |
| `POST /api/capture/token` | session | – | 201 `{token, createdAt}`; replaces any old token | – |
| `DELETE /api/capture/token` | session | – | 200 `{revoked: true}`; waiting alerts are kept | – |
| `GET /api/captured` | session | – | `CapturedItem[]` newest first (max 500) | – |
| `POST /api/captured/:id/confirm` | session | transaction body, or `{type: "transfer", from, to, amount, date, note?}` | 201 `{transaction}` or `{transfer}`; alert deleted | 400 validation (alert kept); 404 not found / not owned; 409 already being saved |
| `DELETE /api/captured/:id` | session | – | 200 `{id}` | 404 not found / not owned |

`CapturedItem` DTO: `{ id, text, sender?, receivedAt, amount, kind, account?, merchant? }`.

`Loan` DTO: fields above plus `id`, `payments[]` (each with `id`, newest first). Status is computed client-side with `loanStatus()`.

`Transfer` DTO: `{ id, from, to, amount, date, note? }`. Validation in `lib/transferInput.ts`.

`Transaction` DTO: `{ id, merchant, category, amount, date, account? }`. Unknown body fields (e.g. an old `subcategory`) are ignored.
Validation lives in `lib/transactionInput.ts` (transactions), `lib/authInput.ts` (auth), `lib/settingsInput.ts` (settings + card), and inline in the budget route. **Server validation is authoritative**; client checks are UX only.

---

## 10. Authentication & multi-user isolation

- **Sign up:** name (1-60), valid email (lowercased), password 8-72 chars → bcrypt hash → user created → session cookie set.
- **Session:** cookie `ledgerly_session` = JWT HS256 `{ sub: userId, email, name }`, 30-day expiry; `httpOnly`, `sameSite=lax`, `secure` in production, `path=/`. Stateless (no session table); logout clears the cookie.
- **Middleware** (`src/middleware.ts`, edge): verifies the JWT on every non-static request.
  - Pages without a session → `/login?next=<path>`; `/login` and `/signup` with a session → `/`.
  - `/api/*` without a session → 401, except `PUBLIC_API = /api/auth/login, /api/auth/signup, /api/auth/logout, /api/health, /api/capture/email`.
- **Capture token:** `/api/capture/email` has no session, so it authenticates `Authorization: Bearer ldg_…` by SHA-256 lookup in `capturetokens`; the token's `userId` owns the alert. It can only add alerts to that user's review list. Limits: 30 bad tokens / 15 min per IP (`capture-ip`), 120 alerts / hour per token (`capture-token`).
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
| **Total Available Balance** (Bank + UPI + Cash) | `entered balance + Σ income − Σ expenses (excluding account "Credit Card") − card bill payments + card cash withdrawals + loan cash` **counting only events with `date ≥ balanceAsOf`**. Input = `availableCashEvents(transactions, transfers, loans)` (`lib/creditCard.ts`) into `anchoredBalance()` (`lib/insights.ts`). Loan cash (`loanCashEvents`): lending −amount, repayment received +; borrowing +amount, repayment made −. Events dated earlier are ignored (they're already in the amount the user typed) |
| **Credit Card card** (own card under the balance card) | Shown when a card is set up, or when `currentCardDue > 0` without one. Value = `cardSummary().due` ("You owe"), or `credit` ("Card credit") when overpaid; **never subtracted from the balance**. Detail: "Bill ₹billOutstanding due d MMM · Unbilled ₹unbilled" (zero parts omitted), red "overdue since" when overdue, "Nothing to pay" at 0, "Set up your card to see bill dates" without a card. Links to `/card` |
| **±x% this mo** badge | `(balance − base) / base × 100`. `base` = entered balance if `balanceAsOf` is this month, else entered + net of transactions in `[balanceAsOf, 1st)`. Never uses transactions before the anchor. Hidden if `base ≤ 0` or \|x\| < 0.05 |
| **Income** tile | Σ income this month |
| **Spent** tile | Σ expenses this month (shown as −₹) |
| **Remaining** tile (formerly "To Spend") | `monthlyLimit − spent this month`; "—" if no budget |
| Status pill | used = spent / limit: `< 0.85` "On track", `≤ 1` "Watch spend", else "Over budget" (only if a budget is set) |
| Monthly Budget bar | `% used = spent / limit`; "Daily safe pace" = `max(0, remaining) / daysLeft` |
| `daysLeft` | days left in the month **including today** (31 Oct → 1) |
| Recent transactions | latest **5** items of transactions **and transfers** merged by date, grouped Today / Yesterday / "Oct 28"; group header shows the net of that day's **transactions only** (transfers are net-zero; header hidden if the day has only transfers). Transfer amounts are neutral. Amounts: **expense red** (`text-secondary`), **income green** (`text-primary`) |
| Insight tip | biggest % change vs last month in a category present both months; hidden if none |

Balance entry (`components/BalanceForm.tsx`): if `null`, the card asks "How much money do you have right now in your bank, UPI and cash?". Two fields: the balance and an optional **"Unpaid credit card amount right now (billed + unbilled)"** (empty = 0). The ✎ opens pre-filled with the **current** balance and the current card due (`currentCardDue`, if > 0); saving re-anchors both (`balanceAsOf` = now, `cardDueAtAnchor` = the card amount). The value is stored exactly as typed. Hovering the balance shows when it was set.
**One-time prompt:** when `needsCardDuePrompt()` (balance set, `cardDueAtAnchor` null = entered before the card model, and a card transaction or card transfer dated ≥ `balanceAsOf`), the Overview shows an info notice "Card purchases no longer reduce your balance. Update your balance and enter what's unpaid on your card." with an **Update balance** button that opens the editor. Saving sets `cardDueAtAnchor`, so it disappears.
Examples: entered ₹10,000 at 4:30 PM → a ₹500 expense dated 2 PM is ignored (balance stays ₹10,000); a ₹50 expense dated 4:30 PM (same minute) counts → ₹9,950.

Reference scenario (from the spec): budget 3,000, spent 1,830.40 → Remaining 1,169.60; 12 days left → 97.46/day.

### Credit card (single card) — agreed spec 2026-11-03, **implemented** (`lib/creditCard.ts`)
A credit card is money you **owe**, not money you have. Maths in `lib/creditCard.ts` (unit-tested in `src/lib/__tests__/creditCard.test.ts`); wired into the Overview balance, `availableBalance`, the Credit Card screen (`/card`), the Transfer form and the settings API (`PUT /api/settings` `cardDueAtAnchor`, `PUT /api/settings/card`).
- **Available balance = Bank + UPI + Cash.** A transaction with `account === "Credit Card"` (`CARD_ACCOUNT`) does **not** change Total Available Balance. Use `availableCashEvents(transactions, transfers, loans)` as the input to `anchoredBalance`/`availableBalance` (replaces `[...transactions, ...loanCashEvents]`).
- **Spending/budgets unchanged:** card purchases are still expenses, so they count in Spent, category budgets and analytics **in the month of purchase**.
- **Card bill payment** = transfer Bank/UPI/Cash → Card: **reduces the available balance** and the card due; **never spending**. **Cash withdrawal** = transfer Card → Bank/UPI/Cash: adds cash, adds card due. Transfers among Bank/UPI/Cash stay neutral.
- **Card due** (`cardDueEvents`): purchase +|amount|, refund/credit on the card (income with account Credit Card) −amount, bill payment −amount, cash withdrawal +amount. Starts at `settings.cardDueAtAnchor` (unpaid card amount entered with the balance) at `balanceAsOf`; events before the anchor are ignored.
- **Statement cycle** (`settings.card = { statementDay 1–28, dueDay 1–28, limit? }`): the statement closes at the end of `statementDay`; due date = `dueDay` of the same month if `dueDay > statementDay`, else of the next month (`dueDateFor`). `cardSummary()` returns `due`, `billed`, `billOutstanding` (billed − payments since the statement), `unbilled` (rest of due), `credit` (overpaid), `dueDate`, `daysToDue`, `overdue`, `utilization` (due/limit), `unbilledEvents`, `billedEvents`. If the anchor is after the last statement, the entered unpaid amount counts as the current bill until the next statement.
- **Low-balance warnings:** card purchases never warn (`expenseCashOutflow` = 0 for account "Credit Card"); a card bill payment (transfer → card) warns on the Transfer form if it exceeds the available balance.
- **Reminders (bell):** card bill due within 5 days / overdue, card utilization ≥ 80%, loan next payment within 3 days / overdue, budget ≥ 90% (monthly or category). In-app only. Implemented in `lib/alerts.ts`, see "Reminders" below.

### Reminders (`lib/alerts.ts` `buildAlerts`; bell + Overview banner)
Computed client-side from loaded data at render time; nothing stored (no read/unread). Amounts via `money()`; dates "5 Nov"; "today"/"tomorrow" wording.

| Rule | Severity · title | id · link |
|---|---|---|
| Card set up (`settings.card`; null/missing = no card alerts), `cardSummary` `billOutstanding > 0` and `overdue` | urgent · "Card bill ₹X overdue" | `card:bill` · `/card` |
| else `billOutstanding > 0` and `daysToDue ≤ 5` | warning · "Card bill ₹X due in N days / tomorrow / today" | `card:bill` · `/card` |
| Card `limit` set and `utilization ≥ 0.8` | warning · "Card usage NN% of limit" (NN floored) | `card:utilization` · `/card` |
| Open loan, `loanStatus().overdue` | urgent · "Loan to/from <person> overdue" (lent = to) | `loan:<id>:overdue` · `/loans/<id>` |
| Open, not overdue loan, monthly plan, next payment in 0–3 days | warning · "Pay ₹X to <person> …" (borrowed) / "Collect ₹X from <person> …" (lent); X = `min(monthlyPayment, outstanding)` | `loan:<id>:next` |
| Monthly budget set, spent this month / limit ≥ 0.9 | warning · "Monthly budget NN% used" (NN floored); ≥ 1 → urgent "Over monthly budget by ₹X" ("Monthly budget fully used" at exactly 100%) | `budget:month` · `/budgets` |
| Same per category budget (long name) | "Food & Dining budget NN% used" / "Over Food & Dining budget by ₹X" | `budget:cat:<id>` · `/budgets` |
| Bank alerts waiting for review | info · "N bank alerts to review" (panel only: no badge or banner) | `capture:pending` · `/review` |

Settled loans never alert; an overdue loan shows only its overdue alert. **Order:** urgent → warning → info, then the relevant date (card due date, loan due/next date, card next statement, end of month for budgets; earliest first), then card → loans → budgets. Badge = count of urgent + warning.

### Gmail auto-capture (`lib/bankAlertParser.ts`, `lib/gmailScript.ts`, `lib/captureMatch.ts`)
Gmail only: no SMS and no inbound email service. A Google Apps Script in the user's own account checks every 5 minutes and posts new alerts from `BANK_SENDERS` to `/api/capture/email`.
- **Script:** sends only alerts arriving after `setup()`. It tracks progress by message date, not by label, because banks reuse subjects and Gmail threads the alerts. On any non-200 it stops and retries that alert next run.
- **Never stored:** OTPs and codes, declined or failed payments, collect requests, future debits and mandates, statement and due reminders, adverts, and anything without a clear amount and direction. "Never share your OTP" warnings don't count as OTPs.
- **Parsing** uses the subject and the first 800 characters of the body (footers hold disclaimers). The first of debit/credit wording decides direction ("A/c debited; RAVI credited" is spending). HDFC's "towards VPA x (MERCHANT)" format is covered. Unrecognised wording is dropped, so other banks may need rules.
- **Payment method:** Credit Card, Debit Card, UPI or Bank Transfer. Plain "card" is left blank and the user must choose, because credit vs debit changes the balance.
- **Masking:** balances and any 3+ digit run except amounts and dates become `XXXX` before storage and before merchant extraction.
- **Review:** alerts live in `capturedtransactions` and affect nothing until **Add**. Confirming creates a normal transaction or transfer, so all the usual formulas apply. `cardBill` defaults to Bank → Card and `atmWithdrawal` to Bank → Cash, as transfers (never income or spending).
- **Category:** the last one used for that merchant (`suggestCategory`), otherwise the user must pick. **Possible duplicate** = same amount, same direction, within a day among transactions, other alerts and (money out only) transfers; a warning only. Money in never matches money out.

### Low-balance warnings (`lib/balance.ts`, `components/BalanceNotice.tsx`)
- **Never block saving**; amber "warn" or neutral "info" notice only.
- `availableBalance(transactions, transfers, loans, settings, {transactionId?, transferId?, loanId?})` = current Total Available Balance (via `availableCashEvents`, so card purchases don't count and card bill payments do), excluding the record being edited (no double counting); `null` when no balance is set → no warnings.
- `shortfall(available, outflow, date, balanceAsOf)` warns when money **going out** exceeds what's available, only if the item is dated ≥ `balanceAsOf` (earlier items don't change the balance).
- Where: **Add/Edit expense** (under the amount; **not** when paid with Credit Card), **I lent** loan form (under the amount), **repayment of a borrowed loan** (loan detail), **Transfer form** for a card bill payment (any transfer that takes cash out; only X → card does). Income, money received back and card cash withdrawals never warn. Wording via `ShortfallText` (handles an already-negative balance).
- **Budgets (info):** monthly budget > available balance; category budgets total > monthly budget.

### Loans (lend & borrow)
- **Never income or spending:** loans don't touch Income, Spent, Remaining, budgets or analytics. They only move Total Available Balance (and only when dated ≥ `balanceAsOf`).
- `paid = Σ payments`, `outstanding = max(0, totalDue − paid)`, **settled** when outstanding = 0, `progress = paid / totalDue`.
- **Overdue** = not settled and `dueDate` < today. **Next payment** (monthly plan) = next `paymentDay` on/after today (and after the loan date); amount shown = `min(monthlyPayment, outstanding)`.
- Totals: **You'll get** = Σ outstanding of open `lent`; **You owe** = Σ outstanding of open `borrowed`. Shown on the Loans tab and (when any are open) on the Overview.
- Open list order: overdue first, then nearest next payment / due date, then newest.

### Transfers (own accounts; `lib/transfers.ts`)
- **One-total model:** a transfer records that money moved (Bank/UPI/Cash/Credit Card) and is **never income or spending**: excluded from Income/Spent/Remaining tiles, budgets, analytics + its CSV, Accounts per-method totals. No per-account balances. Bank/UPI/Cash ↔ each other: **no effect** on Total Available Balance. Under the card model (`transferCashEffect`): **X → card** (bill payment) −amount, **card → X** (cash withdrawal) +amount.
- **Hints** (`transferHint`): X → card: "Card bill payment: reduces your available balance and what you owe on the card. Not counted as spending — the purchases were already recorded." (`CARD_BILL_HINT`); card → X: "Cash withdrawal from your credit card: adds to your available balance and to what you owe on the card. Not counted as income." (`CARD_ADVANCE_HINT`); others: `OWN_TRANSFER_HINT`. Any pair is allowed; `from ≠ to`.
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
  - Payment method **Credit Card** shows an info notice (expense: "counts as spending now, but your available balance changes only when you pay the card bill"; income: refund lowers what you owe) and never shows the low-balance warning.
- **DateTimePicker:** field shows "Today, 2:45 PM" / "Yesterday, …" / "Fri, 24 Oct, …"; tapping opens a **compact centered pop-up** (max 20rem wide, 1rem margin on phones) with preview, Now/Yesterday/2 days ago, Monday-first calendar, hour/minute/AM-PM; future days and times disabled; Done/Cancel; Esc or backdrop tap closes.
- **Transaction rows** (Overview recent list, Accounts history; built on `SwipeActions`): **swipe left** (touch or mouse drag) or **tap / Enter** to reveal three actions: **View** (read-only details pop-up with an Edit button), **Edit** (`/add?id=…`), **Delete** (confirm dialog, "Yes, delete"). Only one row is open at a time (window event `ledgerly:row-open`); vertical scrolling stays native (`touch-action: pan-y`). Rows no longer navigate on tap.
- **Monthly Budget card:** app font with tabular digits; the spent/cap row and the "Daily safe pace" row wrap on narrow phones, with "N days left" in its own pill so they never collide.
- **Budgets:** Set Limit (inline AmountForm), add category budget (chips + amount). Category cards use **SwipeActions**: swipe left / tap → **Edit** (inline limit form under the card) and **Delete** (confirm dialog). Card layout is two rows (name ↔ spent / limit; left/over ↔ status badge) with truncation and wrapping so nothing overlaps on small phones.
- **Loans tab** (`/loans`): summary cards, **I lent money** / **I borrowed** buttons → `/loans/new?dir=…`, Open/Settled tabs, **Download all loans (CSV)** at the end (from `lg`: summary and buttons left, tabs and list right, so the tabs match the list's width), cards with progress bar, Overdue badge, next payment and repay-by date. Tap → detail.
- **Loan form** (`/loans/new`, `?id=` to edit): I lent / I borrowed tabs, big amount, optional **Total to repay** (interest/fees), name, source chips (Friend, Relative, Online app, Bank, Other), date (DateTimePicker), payment method (default UPI), optional **Repay by** (native date input), optional **Monthly repayment plan** (amount + day 1–28), note. Edit → confirm dialog.
- **Loan detail** (`/loans/[id]`): outstanding (hero), progress, details (dates, plan, next payment, note); **Record repayment** with **Settle in full · ₹X** and **Monthly · ₹Y** quick-fill chips, date, method, note → confirm ("Record & settle loan" when it clears the balance); repayment history with remove (confirm); **Download <person>'s statement (CSV)** (covers every loan with that person; a hint shows how many others are included); Edit loan; Delete loan (danger confirm).
- **Header:** logo + subtitle (screen name only from `md`, where the logo is in `SideNav`), **NotificationBell**, UserMenu (initials → name/email, **Change password**, Log out).
- **Bell:** red badge (amber when nothing is urgent) with the number of urgent + warning reminders (`aria-label` "Notifications, N new"; "9+" over 9). Tap opens a "Reminders" panel (closes on outside click, Esc, or following a link) listing every reminder with icon, title, body and severity colour (urgent = secondary/red, warning = tertiary/amber, info = neutral); each row links to its screen. Empty: "You're all caught up ✓". Rules in §11 "Reminders".
- **Overview banner** (`AlertBanner`, rendered by `AppHeader` only when the path is `/`): the single most important urgent/warning reminder as a slim row under the header (tap → its screen, × dismisses). Dismissal is in memory for the browser tab only (module-level set by alert id: survives tab switches, cleared on reload; no localStorage); the next reminder then shows. motion-safe fade-in.
- **Change password dialog** (`components/ChangePasswordDialog.tsx`, from the account menu): compact centered `<dialog>` (rounded-2xl, `w-[min(22rem,calc(100%-2rem))]`) with Current password, New password (show/hide toggle for all fields, "At least 8 characters" hint), Confirm new password. Client checks (required, length, match, different) then server errors inline (`role="alert"`); busy "Saving…"; success shows "Password changed" (motion-safe pop) and closes after ~1.8 s or on Done. Esc / backdrop / Cancel close it (not while busy). No extra confirm dialog: entering the current password is the confirmation.
- **Side nav** (`components/SideNav.tsx`, from `md`; icon rail, labelled sidebar from `xl`): logo, Add transaction, the four main tabs, then Credit Card, Transfer, Accounts, and To review with a count while there are alerts.
- **Lists show 5 items** (`LIST_LIMIT` in `components/ViewAll.tsx`), then **View all (N)** / **Show less** in place: Category Breakdown legend (the ring still shows every slice), Top Merchants, Loans, Repayments, Category Budgets, Transfers, Credit Card cycle lists, Accounts' payment methods, To review. Overview's Recent Transactions shows 5 and links to Accounts; **Accounts' transaction list is uncapped because it is that "View All" destination**. New lists should use `useViewAll` + `ViewAllButton`.
- **Row hints** (`RowHint`): "Swipe a … left (or tap it)" on touch screens, "Click a …" with a mouse (`pointer-fine:`).
- **Bottom nav** (phones only, below `md`): Overview, Analytics, [+ FAB → /add], Budgets, **Loans**. Accounts is reached via "View All" on Recent Transactions. Quick actions: Add Expense, Add Income, **Credit Card** (→ `/card`), Lend / Borrow. Transfer is reached from the Credit Card screen ("Pay bill" and a "Transfer between your accounts" link).
- **Overview balance card:** under the figure, once, the card-due info prompt with **Update balance**. The editor has two fields (balance + unpaid credit card amount). A separate **Credit Card** card follows it (see §11; links to `/card`).
- **Credit Card** (`/card`): not set up → intro (3 bullets), **setup form**: Statement day + Bill due day selects (1st–28th, must differ; hint "due on the due day of the same/next month"), optional Credit limit; also shows what's currently owed if anything. Set up → hero **Bill to pay** (₹billOutstanding; red when overdue) with a badge "Due 5 Nov · in 2 days" (amber ≤ 5 days, red "Overdue", green "All paid"), statement line, **Pay bill ₹X** (or **Pay early ₹due** when no bill but something is owed) → `/transfer?from=bank&to=card&amount=X`; tiles **Unbilled** (next statement date) and **Total due** (or **Card credit** when overpaid); **Credit limit** bar (`% used`, amber ≥ 80%, "₹X of ₹limit", available credit) when a limit is set; lists **This cycle (unbilled)** and **Last statement** using `TransactionRow`/`TransferRow` swipe rows (empty states); details line + **Edit card** (same form inline) and **Remove card** (danger ConfirmDialog; transactions/transfers kept). A "Transfer between your accounts" link sits at the end. Fade-up entrance is `motion-safe:`.
- **Transfer** (`/transfer`, `/transfer?id=…` to edit, `/transfer?from=bank&to=card&amount=1234.50` to prefill a NEW transfer via `transferPrefill`; bad params fall back to Bank → Cash, empty amount): compact animated header (From-account icon → coins → To-account icon, dashed line; `motion-safe:`), **From** and **To** chip rows (Bank, UPI, Cash, Credit Card) with a swap button; the From account is disabled in the To row, and picking the current To as From swaps them. Blue hint for card bill payments (To = Credit Card) and card cash withdrawals (From = Credit Card); amber low-balance warning under the amount when a bill payment is more than the available balance (non-blocking). Big amount input (same style as Add Expense, `sanitizeAmount`), DateTimePicker, optional note (≤ 120). New → saves directly, shows a "Saved …" status and resets the form; Edit → "Save changes to this transfer?" confirm, then back to `/transfer`. Server errors inline (`role="alert"`). Unknown id → "Transfer not found". Below: "Your transfers" history (newest first) with "This month: N transfers · ₹X", rows via `TransferRow`; empty state. Not in the bottom nav (a 6th item would crowd small phones). All animations use `motion-safe:` (keyframes `ledgerly-travel/float/shimmer/fade-up/dash/pop/ring/progress/fade-in` in `globals.css`).
- **Transfer rows** (`components/TransferRow.tsx`, on `SwipeActions`, same structure as transaction rows): blue ⇄ tile (`bg-[#e3eefc] text-[#2a78d6]`), title = note or "Card bill payment"/"Card cash withdrawal"/"Transfer", line "Bank → Cash · 2:45 PM", amount in **neutral** text (`₹2,000.00`, no sign, not red/green). Actions: View (details pop-up with Edit), Edit (`/transfer?id=…`), Delete (danger confirm). Shown in Overview Recent Transactions, Accounts history (with a payment-method filter, transfers whose From/To label equals the method name, e.g. "UPI", "Cash", "Credit Card") and the Transfer screen.
- **To review** (`/review`; Overview row "N transactions to review" and the bell link here): one card per alert with Expense/Income/Transfer tabs, amount, merchant, category grid (expense), payment method (or From/To chips for a transfer), DateTimePicker (defaults to the alert's time). The original alert text isn't shown. **Add** saves straight away and is disabled with a reason until complete. **Not a transaction** asks for confirmation. Empty state links to setup.
- **Gmail auto-capture** (`/capture`, from the account menu): **Create my script** shows the script once with a copy button; numbered setup steps; status with the last alert time; **Create a new script** and **Turn off** both confirm; privacy note. On localhost it warns that Google can't reach the address.
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
- Layout (light theme only), by width. **Phone DOM order is the source order at every width**; new screens should follow these patterns:
  - `< md` (768px): one column, `BottomNav`.
  - `md`: `SideNav` icon rail (`w-20`) replaces the bottom bar; `AppHeader` shows the screen name instead of the logo.
  - `lg` (1024px): `PageColumns` (`components/ui.tsx`) gives two columns (5/7) on data screens.
  - `xl` (1280px): `SideNav` becomes a labelled sidebar (`w-64`). Page content is capped at `max-w-6xl` (`96rem` from 1920px).
  - Forms stay narrow at every width (`/add`, `/loans/new`, card setup: `max-w-xl`; `/capture`: `max-w-2xl`; login/sign-up: `max-w-md`).
  - Components that depend on their own width rather than the screen's use container queries (`@container`, e.g. the Overview balance tiles).

---

## 14. Conventions & rules

1. **Never commit secrets**; never print them. `.env.local` stays local; Vercel env vars are *sensitive*.
2. **No mock or sample data, no localStorage for app data.** Everything comes from MongoDB via the API.
3. **Every data query is scoped to the signed-in user.** New collections need an owner field and `requireUser()`.
3a. **Loans are not transactions.** Never count loan money as income or spending; it only affects the balance via `loanCashEvents`. "Sending home" stays an expense category (planned monthly outflow).
3b. **Transfers are not transactions.** Money moved between the user's own accounts is never income or spending; keep transfers out of tiles, budgets, analytics/CSV, Accounts totals and day-net headers. The **only** balance effect is the card model: X → card −amount, card → X +amount (`availableCashEvents`/`transferCashEffect`); Bank/UPI/Cash moves are neutral.
3c. **Card purchases are spending but not cash.** Expenses with account "Credit Card" (`CARD_ACCOUNT`) count in Spent/budgets/analytics but never in Total Available Balance. Always compute the balance with `availableCashEvents(transactions, transfers, loans)`, never `[...transactions, ...]` directly.
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
- Covered: `insights` (period bounds, totals, `anchoredBalance`), `loans`, `balance`, `csv`, `loanExport`, `creditCard`, `transfers`, `bankAlertParser`, `captureMatch`, `gmailScript`, and the server validators `transactionInput`, `loanInput`, `authInput`, `transferInput`, `settingsInput`. Not covered: React components, API routes, Mongoose models.
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
| "Request contains unknown fields." (400) right after a model gained a field, in `npm run dev` | Old Mongoose model cached in the running dev process. Fixed by `src/models/defineModel.ts` (re-registers models on reload in development); servers started before that fix need one restart. Production is unaffected (fresh process per deploy). Don't pass `<T>` into `mongoose.model()` there: the generic inference made `tsc` run out of memory |
| Thousands of lint/tsc errors from `.claude/worktrees/...` | Sub-agent worktrees live inside the repo. They are excluded in `eslint.config.mjs` (`.claude/**`), `tsconfig.json` (`exclude`) and `.gitignore` (`.claude/worktrees/`); keep those exclusions |
| "Too many login attempts" while testing locally | Per-email/IP counters live in the `ratelimits` collection of the **shared** DB. Wait for `Retry-After`, or (local/temporary DB only) delete the doc; keys are hashes, so `db.ratelimits.deleteMany({})` on a scratch DB. Without a proxy, local requests all share IP `unknown` unless `x-forwarded-for` is sent |
| Gmail script can't reach Ledgerly when testing | Google can't reach localhost, and `develop` previews are behind Vercel login. Test the API with curl and a Bearer token. The script itself can only be tested against production |
| `capture.email timed out` / `capture.email slow` in the logs | `/api/capture/email` gives up after 25 s with a 503 (it once hung to Vercel's 300 s limit; cause not yet found) and the script retries on its next run. The log lists each step reached with its timing, so the last step shows where it stuck. A retry after a late save is caught by the unique `dedupeKey` |
| A bank alert never appears in To review | Check the sender is in `BANK_SENDERS`, then the script's Executions log in script.google.com. A 200 with `captured: false` means the parser ignored it (see `reason`); unrecognised bank wording needs a rule in `lib/bankAlertParser.ts`, tested with made-up details only |
| `Cannot read properties of undefined (reading 'createCollection')` after adding a model | Don't call `Model.init()` for new models in routes: it can stay failed if it started before the connection opened. Use `ensureIndexes()` from `lib/db.ts` after `connectDb()` |
| A transaction doesn't change the Total Available Balance | Its date is earlier than when the balance was entered (`balanceAsOf`); by design. Re-enter the balance via ✎ if needed. Card purchases (paid with "Credit Card") never change it; paying the bill does |
| Existing user's balance jumped after the credit card release | Card purchases since `balanceAsOf` stopped reducing it, and card bill transfers started reducing it. Expected until they re-enter the balance with the unpaid card amount (the Overview shows a one-time "Update balance" prompt while `cardDueAtAnchor` is null) |

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
| 2026-11-03 | **Credit card model**: card purchases don't reduce Available balance (only Bank/UPI/Cash count) but do count as spending; card bill payment (transfer → Card) reduces Available balance and card due, never spending; unpaid card amount entered with the balance; statement/due day; single card first | User decisions after walking through the purchase-now-pay-next-month flow (fixes over-stated balance when a bill was unpaid at balance entry) |
| 2026-11-03 | Auth rate limiting stored in MongoDB (`ratelimits`, TTL index, hashed keys, fail open) + Change password (`POST /api/auth/password`, account-menu dialog) | User request. Vercel serverless has no shared memory; no new dependency or provider (Redis) needed. Fail open so a counter problem never locks users out |
| 2026-10-31 | Upgraded Next 15.5.28 / React 19.1.10 / Mongoose 8.24.x | Security advisories; Vercel deploy block |
| 2026-11-03 | Vitest unit tests for pure business logic (`src/lib/__tests__`), TZ pinned to Asia/Kolkata, `server-only` stubbed. Chose the mature 4.1.x line (4.1.12) over the newer 5.x | Lock in §11 formulas and server validation without touching the DB; no app behaviour changed |
| 2026-11-03 | Credit card wired in: `/card` screen replaces the Transfer quick action; card setup saved via separate `PUT /api/settings/card` (no re-anchor); unpaid card amount entered with the balance (default 0); one-time prompt for legacy balances; "After card dues" line on the Overview; due day must differ from statement day | User decisions (final). Separate endpoint so editing the card never moves the balance anchor; equal days would make the bill due when the next statement closes |
| 2026-11-03 | **Transfers** between own accounts replace the "Coming soon" page: simple one-total model (no per-account balances), fixed accounts Bank/UPI/Cash/Credit Card, credit card bill = transfer, shown in Recent Transactions / Accounts history, excluded from every total | User decisions (final). Card purchases are already expenses, so paying the bill must not count twice |
| 2026-11-05 | Overview: separate **Credit Card** card showing what's owed replaces the "After card dues" line (balance − due) | User request: show the card amount on its own instead of subtracting it |
| 2026-11-05 | **Gmail auto-capture** through a Google Apps Script in the user's own account, with a review step before anything counts. Gmail only: no SMS, no inbound email service (Resend declined), no Gmail OAuth | User decisions. No outside service sees the alerts and it's free; Gmail OAuth for mail needs Google's restricted-scope review. Cost: each user pastes a script once |
| 2026-11-03 | **In-app reminders**: bell panel + Overview banner computed from loaded data (`lib/alerts.ts`); no persistence of read/unread or dismissals (badge = current urgent + warning count). Banner rendered from `AppHeader` on `/` so the Overview page needn't change | Agreed card spec; no DB/storage needed, nothing to go stale. Push/email out of scope |

---

## 19. Known limitations / backlog

- No password reset by email (needs an email provider) and no email verification.
- Sessions are stateless JWTs: changing the password does **not** sign out other devices (they stay signed in until their 30-day cookie expires). Fix would need a per-user `tokenVersion`/`passwordChangedAt` checked on each request.
- Rate limits are fixed windows per IP/email; many users behind one NAT share the per-IP budget (20 logins / 15 min, 10 sign-ups / hour).
- No UI or end-to-end tests yet (unit tests cover `src/lib` only; consider Playwright for flows). API routes (incl. rate limiting) are verified manually against a temporary MongoDB, not by automated tests.
- Month picker is a non-functional placeholder.
- Reminders are in-app only: no push/email notifications; read state and banner dismissals are not persisted.
- Receipts: only the file name is stored; no upload or storage.
- Remaining `npm audit` item: PostCSS inside Next (build-time only; fixed only in Next 16).
- Transactions list capped at 1000 per user (no pagination).
- Shared DB across preview/dev/prod (see §5).
- No account deletion or profile edit UI.
- No per-account balances (simple model): transfers are recorded but Bank/UPI/Cash balances aren't tracked separately. Transfers list capped at 1000 per user.
- Credit card phase 2: **multiple cards**, card EMI / interest / late fees, minimum amount due, statement history beyond the last cycle. The Pay bill link always defaults to From = Bank.
- Loans phase 2: interest rate and EMI schedule/amortisation, missed-instalment detection (today only past `dueDate` = Overdue; the bell reminds 3 days before a plan payment), link a repayment to a transaction.
- Gmail auto-capture: Gmail only, each user sets up a script, parser rules so far are HDFC plus common Indian wording (unrecognised alerts are dropped), and no check that a captured alert really came from the bank beyond the script's sender filter. Possible later: one-tap Gmail connection, other banks, a test button.
- Cleanup pending: test user `test.user@ledgerly-demo.dev`; legacy `settings` doc `key:"default"`.
