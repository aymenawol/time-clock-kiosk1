# RoleCall

Workforce and operations software for airline ground-transportation and
ground-handling companies. It covers the PIN time-clock kiosk, dispatch board,
live GPS map, fleet readiness, inspections, fueling, counting and sign-in
sheets, breaks and compliance, payroll with Nevada overtime, fatigue, shift
bids, overtime, safety meetings, emergencies, lost and found, assist
(wheelchair) escalation, chat, notifications, reports and performance, for
every role.

RoleCall is multi-tenant. Every row belongs to an organization, and row-level
security in Postgres keeps organizations apart.

- Product decisions: [CLAUDE.md](CLAUDE.md)
- What the v0 build did and why it was rebuilt: [docs/audit.md](docs/audit.md)
- Information architecture and design system: [docs/design.md](docs/design.md)
- Code conventions: [docs/conventions.md](docs/conventions.md)

## Stack

- Next.js 16.4 (App Router, Server Components, Server Actions) with React 19
  and Tailwind CSS 4
- Supabase: Postgres with RLS on every table, Auth, Realtime, Storage, Edge
  Functions, pg_cron and pg_net
- TypeScript (strict), zod on every server action, generated database types
- Vitest (unit tests and RLS integration tests), Playwright (end-to-end)
- Hosted on Vercel

## Roles and where they land

| Role | Device | Home |
|---|---|---|
| Admin | desktop | `/dashboard`: everything, including payroll and settings |
| Supervisor | desktop or tablet | `/dashboard`: operations, people (read), forms, safety, fatigue |
| Dispatcher | desktop | `/board`: dispatch board, map, sign-in sheet, assists, overtime |
| Coordinator | desktop or tablet | `/compliance`: break compliance verdicts, counts, lost and found |
| Driver | phone | `/m`: shift card, radio codes, inspections, counts, assist, end of shift |
| Fueler | phone or tablet | `/m`: fuel, wash and charge queue |
| Technician | tablet | `/m`: defect queue |
| Anyone clocking in | shared tablet | `/kiosk`: employee number and PIN |

The single permission matrix is in [lib/auth/permissions.ts](lib/auth/permissions.ts).

## Demo organization and test logins

`npm run seed` creates **Silver State Shuttle (Demo)**. It has one login per
role, 10 vehicles, routes and locations, a week of shift history, two drivers
on the clock, an open shift bid, overtime offers and safety meetings. It is
safe to re-run, because it deletes and recreates the demo organization.

Every demo account uses the password **`RoleCall-Demo-2026!`**.

| Role | Email | Employee # | Kiosk PIN |
|---|---|---|---|
| Admin | admin@demo.rolecall.app | 1001 | 4826 |
| Supervisor | supervisor@demo.rolecall.app | 1002 | 5937 |
| Dispatcher | dispatcher@demo.rolecall.app | 1003 | 6148 |
| Coordinator | coordinator@demo.rolecall.app | 1004 | 7259 |
| Driver | drew@demo.rolecall.app | 2001 | 3816 |
| Driver | riley@demo.rolecall.app | 2002 | 2947 |
| Fueler | fueler@demo.rolecall.app | 3001 | 4682 |
| Technician | technician@demo.rolecall.app | 4001 | 5793 |

Drivers 2003 to 2005 have no login. They clock in at the kiosk only (PINs 8153,
9264 and 1375).

These are demo credentials for a demo organization. They can only reach demo
data, because RLS confines every account to its own organization.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the values (never commit .env.local)
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | app | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app | Publishable (anon) key |
| `SUPABASE_SECRET_KEY` | server only | Service role key for the kiosk, Auth admin, seed and tests |
| `NEXT_PUBLIC_SITE_URL` | app | Public URL, used in Auth redirects and emails |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | app | Live map. Restrict the key to your domains |
| `KIOSK_SESSION_SECRET` | server only, optional | Signs the 90-second kiosk sessions. If unset, a key is derived from the secret key |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` | scripts only | CLI and Management API |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | scripts only | `npm run setup:remote` |
| `RESEND_API_KEY`, `RESEND_FROM` | edge function secret | Email. `RESEND_FROM` must use a **verified sending domain** |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint with zero warnings |
| `npm test` | Unit tests: labour rules (overtime, breaks, fatigue, payroll) and the bid and overtime award engines |
| `npm run test:rls` | Integration tests against the real database. They prove one organization cannot read or write another's data, and check role rules |
| `npm run test:e2e` | Playwright. Re-seeds the demo org, then runs each role's main flow (run `npm run build` first) |
| `npm run seed` | Recreate the demo organization |
| `npm run db:push` | Apply new migrations to the linked project |
| `npm run db:types` | Regenerate `lib/supabase/database.types.ts` |
| `npm run setup:remote` | Idempotent hosted setup: Vault secrets for cron, edge function secrets, Auth settings (public sign-up off), Vercel env vars |

Migrations are **CLI only**: run `npx supabase migration new <name>`, then fill
in the generated file.

## Architecture

- **Tenancy.** `organizations` holds the settings and time zone.
  `employees` is both the workforce record and the membership: `user_id` is set
  when the person can sign in, and `role` is one of seven app roles. RLS
  helpers in the private schema (`private.org_ids()`,
  `private.org_ids_with_role()`) are called as `(select ...)` so Postgres
  evaluates them once per query. A user can belong to several organizations
  and switch between them from the account menu.
- **Authorization** is read from the database on every request (`requireAuth`
  / `action()`), never from JWT claims, so a role change or termination takes
  effect immediately.
- **Kiosk:**
  - An admin creates a one-time pairing code in Settings → Kiosks. The tablet
    opens `/kiosk` and enters the code.
  - The device gets an httpOnly cookie. Only its SHA-256 hash is stored.
  - Employees enter their employee number and then their PIN.
  - PINs are bcrypt-hashed (`pgcrypto`), and nothing in the app can read the
    hashes. Five wrong PINs lock the employee for 15 minutes. Twenty failures
    in 10 minutes pause the device.
  - A successful PIN returns a 90-second HMAC-signed session bound to the
    device. That session authorizes the punch.
- **Labour rules** all live in [lib/labor](lib/labor), with tests:
  - **Daily overtime (NRS 608.018, 608.0126):** hours over 8 in a 24-hour
    workday that starts when the employee begins work. It applies only to
    employees paid less than 1.5 times the Nevada minimum wage ($12.00, so
    under $18.00 an hour), and not to employees marked exempt (4x10
    agreements, Motor Carrier Act drivers, collective bargaining agreements).
  - **Weekly overtime:** hours over 40 in the workweek, with no pyramiding.
    The workweek starts on the organization's configured day.
  - **Meal and rest (NRS 608.019, NAC 608.145):** a 30-minute unpaid meal for
    8 hours on duty. Paid 10-minute rest periods (15 minutes by company policy
    in the demo) at 3.5, 7, 11 and 15 hours worked.
  - **Fatigue:** checked at every clock-in and clock-out against FMCSA
    passenger-carrier limits. These are 15 hours on duty, 8 hours off and 60
    hours in 7 days, plus company warnings.
  - Other states can be added as new rule sets. Organizations store their
    `labor_jurisdiction`, currently `US-NV`.
- **Side effects run in Postgres functions** so they are atomic and check the
  caller: radio codes, breaks, GPS, inspection submission, end of shift,
  overtime and bid awards, form review with leave deduction, and pay-period
  locking.
- **Background jobs (pg_cron):**
  - Every minute: the break monitor (missed, reminder, overrun), assist
    escalation and email dispatch.
  - Every 5 minutes: chat confirmation reminders.
  - Nightly: retention cleanup and cron history pruning.
  - Email is sent by the `notification-dispatch` edge function. pg_cron calls
    it with a shared secret held in Vault. Rows are claimed with
    `FOR UPDATE SKIP LOCKED`.
  - `health` is a public liveness probe.
- **Live screens** subscribe to Supabase Realtime, filtered by organization,
  and re-render from the server.

## Email

In-app notifications always work. Email needs a verified sending domain in
Resend: set `RESEND_FROM` (for example `RoleCall <alerts@yourdomain.com>`) and
run `npm run setup:remote`. Supabase Auth SMTP can then be pointed at Resend
with the same domain. **No verified domain is configured yet.** Until one is,
email-worthy notifications are recorded as `skipped`, never as `sent`. Admins
reset passwords from the employee profile instead of by email.

## Deploying

Vercel builds `main` for production (rolecallmanager.vercel.app) and other
branches as previews.

1. `npm run setup:remote` to set Vercel env vars and Supabase secrets.
2. `npm run db:push` for new migrations.
3. `npx supabase functions deploy notification-dispatch health --use-api`
4. Push. Vercel builds and deploys.

To onboard a new customer organization, an operator inserts the organization
and its first admin employee with the service role, or uses the seed script
as a template. The admin then adds everyone else from People.
