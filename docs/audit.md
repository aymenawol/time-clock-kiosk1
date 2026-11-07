# RoleCall: audit of the v0 build

Audited 2026-11-07 against `main` at `d493fdb` and the live Supabase project
`tcfjhucprgepcxrnohca`. The owner asked for a rebuild that keeps every feature,
so this document records what exists, who uses it, what data it touches, what is
broken and what is missing. It covers both the code and the live database.

Detailed per-file findings, with file and line citations, are in the appendices:

- [audit/admin-routes.md](audit/admin-routes.md): every `app/admin` page and server action
- [audit/role-routes.md](audit/role-routes.md): driver, dispatcher, coordinator, technician, fueler, chat, board, login, middleware and `lib/`
- [audit/backend.md](audit/backend.md): the 49 migrations, RLS, SQL functions, the 5 edge functions, cron and the seed
- [audit/live-schema.txt](audit/live-schema.txt): the live column dump from the Management API

## 1. Size and shape

| Item | v0 |
|---|---|
| Routes (`page.tsx`) | 57: 28 under `/admin`, 13 under `/driver`, 3 dispatcher, plus board, chat, coordinator, fueler, supervisor, technician, balances, safety share, login, onboard and auth callback |
| Code | about 26k lines of TS/TSX/SQL |
| Migrations | 49, mixing a throwaway v1 schema with the v2 overhaul |
| Live tables | 56 in `public`, all with RLS on. None has an organization column |
| Edge functions | 5: `break-monitor`, `chat-reminder`, `notification-processor`, `wheelchair-escalation` and `health-check` (an unmodified template) |
| Cron (pg_cron) | `notification-processor`, `wheelchair-escalation` and `break-monitor` run every minute, `chat-reminder` every 5 minutes, and `nightly-gps-cleanup` at 03:00 UTC. Only the GPS cleanup job is in a migration |
| Storage | `lost-and-found` and `repairs` buckets, both private |
| Live data | Test data only: 17 employees, 8 shifts, 2 buses, 16 airlines, 68 queued notifications |
| Auth users | 14. Twelve are synthetic (`*@transdev.internal`, `*@test.local`). Two are the owner's own addresses (`aymenawol070106@gmail.com`, a UNLV address). None is a customer, so the reset is safe |
| Tests | 4 Vitest files of pure helpers. There are no tests for actions, RLS or auth, and no e2e tests |

## 2. Cross-cutting findings

These apply to every feature. The rebuild must fix all of them.

1. **There is no tenancy.** No table has an `organization_id`. Uniques such as
   employee number, bus number and airline name are global. Settings, the overtime
   banner and "one active emergency" are single global rows. The app is
   single-company and can't be sold to a second customer as it stands.
2. **PIN clock-in doesn't exist.** "Login by employee ID" is a Supabase password
   login. "Clock-in" is a dispatcher creating a `shifts` row on the sign-in sheet.
   `employees.pin` is a plaintext column that dispatchers, coordinators,
   supervisors and payroll can read, and nothing uses it. There is no kiosk
   device concept: `tablets` is just an asset list.
3. **Authorization is broken in several places:**
   - Service-role server actions check only "is logged in". This covers radio
     codes, flagging a bus out of service and end of shift. Any user can change
     any bus's status or close any shift.
   - Chat actions skip room-membership checks.
   - `management` can create admins and reset admin passwords.
   - An admin employee page reads `select *` with the service role and no guard.
   - Role lists differ between middleware, layouts, pages and actions, so payroll
     users are locked out of payroll and fuelers are locked out of their own forms.
   - Roles come from JWT `app_metadata`, so a terminated user keeps access until
     the token expires.
4. **There are RLS holes:**
   - The lockout functions `clear_login_attempts` and `register_login_attempt`,
     plus `generate_breaks` and the GPS cleanup, can be called with the anon key.
   - Several INSERT policies have no owner check: GPS positions, end-of-shift,
     wheelchair requests and chat sender.
   - UPDATE policies have no `WITH CHECK`.
   - Airlines and emergencies are readable by anon.
   - The `repairs` delete policy can never match.
   - Repair photos are readable by any logged-in user.
   - The public safety page's "token" isn't checked (`USING (is_active)`).
5. **The edge functions trust the anon key.** `verify_jwt=true` accepts it.
   `notification-processor` can double-send, marks rows "sent" when no email went
   out, and injects `payload.message` into HTML unescaped. `chat-reminder`
   deduplicates on a column that doesn't exist, so it re-sends every 5 minutes.
   `wheelchair-escalation` loses all of its notifications when one request has no
   driver.
6. **The labour rules are wrong for Nevada:**
   - Daily overtime is a flat "over 8 hours per shift", with no 1.5x minimum-wage
     test and no 24-hour workday.
   - "Weekly" overtime is computed over the whole pay period.
   - Unpaid meal time is never deducted.
   - Two shifts on one day collide on an upsert key.
   - Closed pay periods can still be recalculated.
   - "Today" is the UTC date everywhere, so after 4 or 5 pm Pacific the app shows
     tomorrow.
7. **Validation is thin.** zod covers 4 admin modules. Everything else casts
   `FormData` or trusts client JSON. State machines aren't enforced: bid cycles,
   OT shifts, forms, lost items, breaks and bus status all accept any transition.
8. **One customer is hardcoded:** Harry Reid (LAS) terminal coordinates and names,
   16 LAS airlines with phone numbers inside a migration, counting-sheet columns
   `rac/t1/t3/term1/term3_west/term3_east`, the radio codes `10-51` and `10-33`,
   the map centre, fixed "2 x 15-minute" breaks and "Transdev" in the docs.
9. **The infrastructure can't be reproduced.** Four of the cron jobs, the Vault
   secret, the extensions and the Auth settings exist only in the dashboard.
   `RECOVERY.md` and `README.md` describe a schema that no longer exists.
10. **There is dead or vestigial code:**
    - The offline IndexedDB queue (offline isn't required).
    - `profiles`, a third copy of each user's role.
    - `email_templates`, which nothing reads.
    - The v1 safety schedule table.
    - The `session_overrides` and `offline_sync_conflicts` tables.
    - Hand-written DB types that have drifted from the schema.
    - Many unused shadcn components.

## 3. Feature and data matrix

Roles use the owner's vocabulary (admin, supervisor, dispatcher, coordinator,
driver, fueler, technician). v0 also had `management` (an admin who can't run
payroll) and `payroll` (which can't reach the payroll page).

| # | Feature | v0 routes | Roles | Data (v0 tables / functions) | Broken | Missing |
|---|---|---|---|---|---|---|
| 1 | Sign-in and role routing | `/login`, `/auth/callback`, `/onboard`, `/`, `/unauthorized` | everyone | `auth.users`, `employees`, `profiles`, `login_attempts` | Lockout RPCs callable by anon; ID enumeration; four separate role-to-home maps; `/board`, `/chat`, `/fueler` and `/supervisor` unguarded by middleware | Password reset page, audit trail, org selection |
| 2 | **Time clock** (PIN kiosk) | none. The dispatcher's sign-in sheet stands in | all employees | `shifts.actual_start/end` | Duplicate active shifts possible; tablet never marked in use; blank signature accepted; UTC dates | Kiosk device pairing, hashed PINs, lockout, clock in and out, break punches |
| 3 | Breaks and compliance | `/driver` (start/end), `/dispatcher` (alerts, re-enable), `/coordinator` (verdicts) | driver, dispatcher, coordinator, supervisor | `breaks`, `generate_breaks`, `break-monitor` | Always exactly 2 x 15-minute breaks; no meal period; breaks written from the browser; monitor races drivers | Nevada meal and rest rules, per-org policy, waivers |
| 4 | Dispatch board | `/board`, `/dispatcher` | dispatcher, supervisor, admin | `shifts`, `buses`, `latest_bus_positions`, `fatigue_alerts`, `ot_banner` | Ignores new sign-ins live; map link unreachable for dispatcher | Org filter, assignment editing, wall-display mode |
| 5 | Sign-in sheet | `/dispatcher/sign-in`, `/admin/sign-in-sheets` | dispatcher, admin | `shifts`, `tablets`, `buses` | Inserts straight from the browser; no duplicate checks | Tie-in with kiosk clock-ins, edit and void with audit |
| 6 | Live GPS map and routes | `/admin/map`, board tiles | admin, dispatcher, supervisor | `bus_positions`, `current_bus_positions`, `terminal_coordinates` | Driver can post a position for any bus; LAS hardcoded; tracking stops when the dashboard unmounts | Routes, per-org locations, stale indicator |
| 7 | Radio codes | `/driver` | driver | `buses.status`, `shifts.radio_status` | Any user can set any bus's status | Per-org code list |
| 8 | Buses and fleet | `/admin/buses/*` | admin | `buses`, `bus_status_history`, `tablets` | Raw input inserted after zod; read actions unguarded; history has no actor | Transition rules, tablet management, vehicle types beyond EV/Diesel |
| 9 | Fleet readiness | `/admin/fleet-readiness` | admin | `buses`, `repair_notes` | Thresholds hardcoded | Configurable thresholds, actions |
| 10 | Inspections (pre/post trip) | `/driver/inspection/[type]`, `/admin/inspections` | driver, admin | `vehicle_inspections`, `inspection_items`, `repair_notes` | Each draft save duplicates repair notes; lock only enforced client-side | Per-org checklist, photos, review |
| 11 | Defects and repairs | `/technician` | technician | `repair_notes`, `repairs` bucket | Any technician can mark any bus ready from any state; lost-update on photos | Work-order states, resolution notes |
| 12 | Fueling and washing | `/fueler` | fueler | `buses` | Nav links to pages that block fuelers | Fuel log (gallons, kWh), history |
| 13 | End of shift | `/driver/end-of-shift` | driver | `end_of_shift_submissions`, `shifts`, `buses`, `tablets` | Any user can close any shift; double submits recompute hours | Required post-trip, fatigue check |
| 14 | Counting sheets | `/driver/counting-sheet`, `/admin/counting-sheets` | driver, admin, dispatcher | `counting_sheets`, `counting_rows`, `counting_sheet_revisions` | LAS columns hardcoded in schema; duplicate sheets | Per-org count locations, export |
| 15 | Wheelchair assist (10-51) | `/driver/10-51`, dispatcher panel | driver, dispatcher | `wheelchair_requests`, `airlines`, `wheelchair-escalation` | Driver can insert as anyone; escalation loses its notifications; 5-minute SLA hardcoded | Per-org SLA, cancel path |
| 16 | Airlines | `/admin/airlines` | admin | `airlines` | Anon-readable; LAS seed in a migration | Per-org list |
| 17 | Forms (time off, bid/vacation change, incident, FMLA, resignation) | `/driver/forms/*`, `/admin/forms/*` | all employees; admin reviews | `form_submissions`, `form_acknowledgements` | Any status to any status; resignation side effects not transactional; fuelers blocked | Per-type validation, balance deduction on approval |
| 18 | Balances (PTO, vacation, FMLA, seniority) | `/balances` | all employees | `employees.*_balance` | Back button assumes driver; balances are mutable numbers with no ledger | Ledger, accrual history |
| 19 | Shift bids | `/driver/bids`, `/admin/bids/*` | driver; admin runs | `shift_bid_cycles/slots/submissions/awards` | Award engine skips non-submitters; no window or state enforcement; no capacity check on overrides | Tests, notifications |
| 20 | Overtime (offers, bids, awards, off-day requests, banner) | `/driver/overtime`, `/dispatcher/overtime`, `/admin/overtime` | driver, dispatcher, admin | `overtime_shifts/bids/awards`, `off_day_requests`, `ot_banner` | Double award on double click; awarded shifts never shown to the driver; bids accepted after close | Fatigue and weekly-hours eligibility |
| 21 | Payroll | `/admin/payroll/*` | admin (`payroll` role locked out) | `pay_periods`, `daily_hours_records`, `payroll_exports` | Not Nevada-correct (see §2.6); CSV injection | Per-workweek overtime, pay rates, locking |
| 22 | Overtime and fatigue rules | `/admin/settings`, `/admin/fatigue` | admin, supervisor, dispatcher | `app_settings`, `fatigue_alerts`, `fn_fatigue_alert_notify` | Saved OT rules are ignored by payroll; alerts only created when payroll is recalculated | Real-time checks at clock-in, configurable thresholds |
| 23 | Safety meetings | `/driver/safety-meetings`, `/admin/safety-meetings`, `/safety/[token]` | all employees; admin manages | `safety_meetings`, `safety_meeting_signins`, `safety_meeting_schedules` | Two parallel systems; public token not enforced; drivers can mark themselves "excused" | Audience by role, sign-in window |
| 24 | Emergency broadcast | `/admin/emergency`, modal in driver shell | admin triggers; everyone acknowledges | `emergency_events`, `emergency_acknowledgements` | Anon-readable; one emergency DB-wide; only drivers see the modal | All roles acknowledge, history |
| 25 | Lost and found | `/driver/lost-found`, `/admin/lost-found` | driver reports; staff manage | `lost_items`, `lost_item_status_history`, bucket | No state machine; claimant ID stored in plaintext; history has no actor | Org-scoped storage paths |
| 26 | Chat | `/chat` | admin, dispatcher, supervisor | `chat_rooms/members/messages/deliveries/reads/confirmations` | No membership checks; drivers have no chat; reminders spam | Membership-based RLS, rooms for field staff |
| 27 | Notifications | bell in every shell, `/admin/notifications` | everyone | `notification_queue`, `notifications`, `notification_log`, `notification-processor` | Two identity keys; silent "sent"; HTML injection | Email only when a verified domain exists |
| 28 | Reports | `/admin/reports` | admin | hours, OT, forms, safety, bids | No date filters; unbounded export | Date range, more report types |
| 29 | Performance | `/admin/performance`, `/driver/performance` | admin, supervisor, driver | `driver_performance_snapshots` | Writer only records "present", so the percentages are meaningless | Metrics computed from real data |
| 30 | Settings | `/admin/settings` | admin | `app_settings` | Singleton; OT rules unused | Org profile, kiosks, locations, radio codes, checklists |
| 31 | Employees | `/admin/employees/*` | admin | `employees`, `profiles`, `auth.users` | Privilege escalation by `management`; unguarded detail page | PIN set/reset, org scoping, last-admin guard |
| 32 | Coordinator and supervisor overview | `/coordinator`, `/supervisor` | coordinator, supervisor | `shifts`, `breaks` | Every in-progress shift is flagged; UTC "today" | Day picker |
| 33 | Motion lock (driver UI locks while moving) | driver shell | driver | `session_overrides` | Client-side only, fails open | Keep as a client safety aid, not a control |

## 4. What the rebuild changes structurally

- Every table gets `organization_id`. RLS everywhere is scoped by membership and
  role. Settings, banners and emergencies are per organization.
- A single `employees` row is both the workforce record and the membership
  (`user_id` is set when the person has a login). Roles live in the database, not
  the JWT, so revocation is immediate.
- Kiosk clock-in uses a paired device, an employee number and a bcrypt-hashed PIN,
  with per-employee and per-device lockout. The punches write `time_entries` and
  `breaks`.
- One tested labour module (`lib/labor`) computes Nevada daily and weekly overtime,
  meal and rest breaks, and fatigue. Payroll, the kiosk and the monitors all use it.
- Customer-specific data is now per-organization configuration: locations and
  terminals, airlines, radio codes, counting columns, inspection checklist,
  vehicle statuses, and the break and fatigue policy.
- Edge functions check a shared cron secret, not "any JWT". They claim rows with
  `FOR UPDATE SKIP LOCKED` and record honest delivery status.
- Cron jobs, buckets and storage policies are all created by migrations.

`docs/design.md` covers the information architecture and design system.
`README.md` covers setup.
