# ChessGo Academy

Standalone club management for chess academies. It's built as its own app so it can run today (replacing SportBM) and later be merged into the main ChessGo platform as a module.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Prisma · Tailwind · Stripe. SQLite locally; switch `provider` to `postgresql` in `prisma/schema.prisma` for production.

## Run it

```bash
npm install
cp .env.example .env        # then edit as needed
npx prisma db push
npm run db:seed             # demo data (wipes the DB!)
npm run dev                 # http://localhost:3000
```

Demo logins (password `chessgo123`): `platform@`, `admin@`, `coach@`, `parent@`, `student@chessgo.app`.

`npm test` runs unit tests for billing, streaks and CSV.

## Roles

| Role | Area | Can do |
|---|---|---|
| platform_admin | `/platform` | All clubs, active students, pricing, trials, monthly invoices, CSV |
| club_admin | `/admin` | Everything in the club |
| coach | `/admin` | Groups (read-only), students, attendance, XP & badges, puzzles, tournaments |
| parent | `/portal` | Children's progress, open tuition, shop and orders |
| student | `/portal` | XP, level, streak, badges, group leaderboard, daily puzzle |

## Phase 4 features

### 1. Gamification
- **XP** (`lib/gamification.ts → XP`): present +10, late +5, puzzle +5, daily puzzle +10, every 7-day streak +25, tournament game +5 (+5 win / +2 draw), tournament winner +50.
- XP is keyed by source (`att:<id>`, `game:<id>` …), so editing attendance or a game result *adjusts* XP instead of double-counting.
- **Daily puzzle streaks:** coaches schedule one puzzle per day; students solve it in the portal (first move is checked).
- **Badges:** 8 defaults (10/50 sessions, 10/50 puzzles, 7-day streak, first tournament, tournament winner, 1000 XP). Admins can add custom badges, either threshold-based or awarded manually.
- **Leaderboard** per group, all-time or this month. It shows **first names only**, plus a last initial when two children share a first name.
- **Bonus XP:** from a student's page, or in bulk on XP & badges (±500 max, reason logged with the coach's name).

### 2. Public club page & forms
- `/c/<slug>` shows logo, about, groups with free spots, weekly schedule, coaches with a bio, news and contact details.
- `/c/<slug>/trial` and `/c/<slug>/register`, plus chrome-less `/embed/<slug>/trial|register` for an `<iframe>` (snippets are in Inbox).
- Spam protection: honeypot field, plus a limit of 5 submissions per email per hour. A GDPR consent checkbox is required.
- **Inbox → "Convert to student"** creates the Student and Parent and links them in one click. A parent with the same email is reused, so siblings stay together.

### 3. Club shop
- Items with sizes/variants and stock per variant; categories T-shirt, chess set, book, other.
- Parents order from the portal, paying **by card via Stripe Checkout** or choosing **pay at club**.
- Stock is reserved atomically when the order is placed. Cancelling (by the parent or admin) or an expired Stripe session returns it.
- Admin order flow: mark paid → ready for pickup → collected, plus cancel & restock and mark refunded.

### 4. Reports (`/admin/reports`, CSV at `/api/reports/<kind>.csv`)
`attendance`, `revenue` (tuition by payment date + paid shop orders), `overdue`, `retention` (active / inactive / joined / left per month), `group-fill`. CSV files have a UTF-8 BOM for Excel and are guarded against formula injection.

### 5. Platform admin & billing (`lib/billing.ts`)
```
raw     = active students × price per student   (default €0.50)
clamped = min(max(raw, minimum), maximum)       (default €15 / €150)
amount  = clamped × billable days / days in month
```
New clubs get a **30-day free trial**. Months fully inside the trial cost €0, and the month the trial ends in is prorated. "Issue invoices" snapshots each club's active-student count for that month. A suspended club's public page goes offline.

## Stripe setup
1. Set `STRIPE_SECRET_KEY` and `APP_URL` in `.env`. Without a key, the shop offers "pay at club" only.
2. Add a webhook endpoint `<APP_URL>/api/stripe/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`, then put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Payments are also confirmed when the parent returns from Checkout, so a delayed webhook doesn't leave orders stuck.

All clubs share one Stripe account for now. For many independent clubs, move to Stripe Connect (one connected account per club).

## Merging into ChessGo later
- All data is scoped by `clubId`, and every server action re-checks club ownership.
- Business logic lives in `lib/` with no UI dependencies (billing, streaks, gamification, reports, conversion, shop), so it can move to the main app.
- `User`/`AuthSession` are a minimal cookie-session auth. Swap `lib/auth.ts` for ChessGo's auth when merging.
