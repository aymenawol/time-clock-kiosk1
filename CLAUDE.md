# RoleCall — repo instructions

RoleCall is workforce and operations software for airline ground transportation
and ground-handling companies. It is sold to more than one company, so every
piece of data belongs to an organization (tenant), and nothing is hardcoded to
one customer. Next.js (App Router) + React + Tailwind + TypeScript on Supabase,
hosted on Vercel.

## Product decisions (from the owner, 2026-11-07)

- **Every feature in the original v0 build stays.** That includes time clock,
  roles (admin, supervisor, dispatcher, coordinator, driver, fueler, technician),
  dispatch board, live GPS map and routes, buses and fleet readiness,
  inspections, fueling, forms, sign-in and counting sheets, payroll, overtime,
  fatigue, balances, shift bids, safety meetings, emergency, lost and found,
  wheelchair escalation, chat, notifications, reports, performance and settings.
  They get rebuilt with better information architecture, not dropped.
- **Clock-in is by PIN** on a shared kiosk.
- **Labour rules are Nevada.** Daily overtime is over 8 hours in a 24-hour
  period for employees paid under 1.5x the state minimum wage. Weekly overtime
  is over 40 hours. Check the current NRS 608 rules and minimum wage before
  coding them. Keep the rules in one tested module so other states can be added.
- **Devices:** shared tablet kiosk, phones (drivers in the field), and desktop
  (admin and dispatch). Fully responsive. Offline support is not required.
- **The look is new.** Don't keep the v0 styling.
- **No real data or users exist yet**, so the schema can be redesigned and the
  database reset.

## Rules

- **Migrations are CLI-only:** `npx supabase migration new <name>`, then fill in
  the generated file. Never hand-create files in `supabase/migrations/`.
- **RLS on every table**, scoped by organization and role. Wrap
  `auth.uid()`/helper calls in `(select ...)`.
- **Secrets live in `.env.local` only.** Never commit them and never print
  them.
- **Test before you push:** `npm run typecheck`, `npm run lint`, `npm test`,
  `npm run build`, plus the e2e suite.
