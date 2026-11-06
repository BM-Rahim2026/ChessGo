# ChessGo Academy

Standalone club management for chess academies. It's built as its own app so it can run today (replacing SportBM) and later be merged into the main ChessGo platform as a module.

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Prisma · PostgreSQL · Tailwind · Stripe · Resend (email).

## Go live (Supabase + Vercel)

1. **Database.** Create a project at supabase.com. Open *Connect*, then copy:
   - the **Transaction pooler** string (port 6543) into `DATABASE_URL`, adding `?pgbouncer=true&connection_limit=1`
   - the **Session pooler / direct** string (port 5432) into `DIRECT_URL`
2. **Hosting.** At vercel.com, *Add New → Project*, import `BM-Rahim2026/ChessGo` and add these environment variables:
   `DATABASE_URL`, `DIRECT_URL`, `APP_URL` (e.g. `https://chessgo.vercel.app`), plus optionally `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
   Every deploy runs `prisma migrate deploy` automatically (`vercel-build` script).
3. **Create your accounts** once, from your computer, with the same two database variables in `.env`:
   ```bash
   npm install
   npm run setup -- --platform-email you@example.com --platform-name "Your Name" \
     --club-name "ChessGo Academy" --club-slug chessgo \
     --club-admin-email academy@example.com --club-admin-name "Your Name"
   ```
   It prints temporary passwords once, and each person must choose their own at first sign-in. It never deletes anything, so it's safe to re-run. One email = one role, so use different emails for platform admin and club admin.
4. **Set up the club:** club page & news, groups & schedule, coaches & staff, then **Import students** (CSV from SportBM).
5. **Emails** (password reset, new-inquiry alerts): create a Resend account, verify your domain, and set `RESEND_API_KEY` and `EMAIL_FROM`. Without them, emails only go to the server log. Admins can always use *Reset password* on a student's or staff member's page instead.

## Run locally

```bash
npm install
cp .env.example .env        # point DATABASE_URL / DIRECT_URL at a local PostgreSQL
npm run db:migrate
npm run db:seed             # DEMO data, wipes the database (refuses non-local DBs)
npm run dev                 # http://localhost:3000
```

Demo logins (password `chessgo123`): `platform@`, `admin@`, `coach@`, `parent@`, `student@chessgo.app`.

`npm test` runs unit tests for billing, streaks, CSV export and the CSV import parser.

## Accounts & passwords
- New logins get a temporary password and are forced to change it at first sign-in.
- **Forgot password?** on the sign-in page emails a one-hour, single-use link.
- Admins can reset a parent, student or coach password from their page.
- Everyone can change their password under *Account & password*.

## Importing from SportBM (`/admin/import`)
Export your members as CSV and upload the file.
- Columns are detected automatically (English and German names), and you can re-map any column by hand.
- Supports comma or semicolon files, UTF-8 or older Excel encodings, `DD.MM.YYYY` / `YYYY-MM-DD` / US dates, and full-name or first + last name columns.
- You get a preview with errors and warnings before anything is saved.
- Unknown groups can be created on the fly.
- Existing students are skipped (same name + same birth date or parent email), so re-importing is safe.
- Parents with the same email are shared between siblings.

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
