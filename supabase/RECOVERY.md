# Supabase Recovery Guide

This project can be rebuilt from migrations in `supabase/migrations`.

This repo is configured for a CLI-first workflow so you can manage DB changes and Edge Functions from terminal without doing routine schema work in Supabase dashboard.

## What this recovers

- Core tables: `employees`, `vehicles`, `time_entries`, `dvi_records`, `timesheets`
- Optional form tables: `incident_reports`, `time_off_requests`, `overtime_requests`, `fmla_conversions`
- Safety schedules: `safety_meeting_schedules`
- View: `active_clock_ins`
- RLS policies and realtime publication setup used by the app

## 1) Create a new Supabase project

1. Create a new project in Supabase.
2. Save:
   - Project URL
   - `anon` public API key
   - Project ref
   - Database password

## 2) Initialize and link CLI

From repo root:

```bash
pnpm install
pnpm supabase:login
pnpm supabase:link
```

## 3) Push migrations to hosted database

```bash
pnpm supabase:db:push
```

This applies all migration files in order.

Notes:
- Some realtime `ALTER PUBLICATION` statements may fail if a table is already added. That is safe.
- Migrations are rerunnable where practical.

## 4) Reconnect your app

Create `.env.local` (see `.env.local.example`) and set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then run:

```bash
pnpm install
pnpm dev
```

## 5) Verify app health

- Open app and test employee lookup, clock in, and clock out.
- Submit a DVI and a timesheet.
- Submit one optional form.
- Confirm realtime updates appear in admin panel.
- Open safety route and verify schedule loads.

## 6) Daily CLI workflow

Database:

```bash
# Local stack (Docker)
pnpm supabase:start

# Create migration
pnpm supabase:db:new -- add_new_feature

# Apply migrations to linked hosted project
pnpm supabase:db:push

# Pull hosted schema into a new migration
pnpm supabase:db:pull

# Generate TypeScript types from linked DB
pnpm supabase:types
```

Edge Functions:

```bash
# Create new function scaffold
npx --yes supabase functions new my-function

# Serve functions locally
pnpm supabase:fn:serve

# Deploy all functions to linked project
pnpm supabase:fn:deploy

# List deployed functions
pnpm supabase:fn:list
```

## 7) SQL editor fallback (if needed)

If CLI linking is blocked, run migrations in SQL Editor in this order:

1. `supabase/migrations/20240101_init_core_schema.sql`
2. `supabase/migrations/202412220000_add_optional_forms.sql`
3. `supabase/migrations/202412220001_enable_realtime.sql`
4. `supabase/migrations/202501010001_add_lunch_waiver.sql`
5. `supabase/migrations/202501010002_add_safety_meeting_schedules.sql`

## Important limitation

Deleted project data is not recoverable from this repository unless you have backups or exports elsewhere. This setup rebuilds schema, policies, and seeded records defined in migrations.
