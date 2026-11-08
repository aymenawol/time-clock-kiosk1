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

## 5. Forms and sheets preserved from v0

The owner built the original forms from the real paper ones. Each rebuilt
screen below keeps the v0 fields, sections, field order, labels, columns and
print view. Styling, responsiveness, accessibility and validation are new. v0
never used jspdf, despite the dependency: its only exports were CSV files and
`window.print()` views, and those are kept.

| Form or sheet | v0 original (on `main`) | Rebuilt at |
|---|---|---|
| Pre/post-trip inspection checklist (11 categories, item order, damage diagram, mileage) | `app/driver/inspection/[type]/inspection-client.tsx`, `lib/supabase.ts` (`INSPECTION_CHECKLIST`), `components/damage-board.tsx` | `/m/inspection/[kind]`, `/fleet/inspections/[id]` |
| Counting sheet (departure time, RAC, T1, T3, Term 1, Term 3 West, Term 3 East, row totals, 10 blank rows) | `app/driver/counting-sheet/counting-sheet-client.tsx`, `app/admin/counting-sheets/*` | `/m/counts`, `/counts` |
| Sign-in sheet (and print view) | `app/dispatcher/sign-in/sign-in-client.tsx`, `app/admin/sign-in-sheets/sign-in-sheets-client.tsx` | `/sign-in-sheet` |
| End-of-shift report (fuel labels, EV battery, ready / charge required / shop / hazard) | `app/driver/end-of-shift/end-of-shift-client.tsx` | `/m/end-shift` |
| Fuel and wash queue | `app/fueler/*` | `/m/fuel`, `/fleet/fuel` |
| Wheelchair 10-51 request and dispatcher alerts | `app/driver/10-51/wheelchair-form.tsx`, `app/dispatcher/wheelchair-alerts.tsx` | `/m/assist`, `/assists` |
| Employee forms (time off, bid/vacation change, incident report, FMLA conversion, resignation) | `app/driver/forms/**`, `app/admin/forms/**` | `/m/forms/**`, `/forms/**` |
| Lost and found intake and status sheet | `app/driver/lost-found/lost-found-form.tsx`, `app/admin/lost-found/lost-found-client.tsx` | `/m/lost-found`, `/lost-found` |
| Safety meetings and the public monthly schedule poster | `app/admin/safety-meetings/*`, `components/safety-meeting-schedule.tsx`, `app/safety/[token]/page.tsx` | `/safety`, `/s/[token]`, `/m/safety` |
| Emergency broadcast form and acknowledgement list | `app/admin/emergency/emergency-client.tsx` | `/emergency` |
| Payroll period sheet and CSV (v0 headers kept, rate and $ columns appended) | `app/admin/payroll/**`, `lib/payroll-calc.ts` (`buildPayrollCSV`) | `/payroll/[id]` |
| Overtime sheet (posted shifts, bids, awards, off-day requests, banner) | `app/admin/overtime/*`, `app/dispatcher/overtime/*`, `app/driver/overtime/*` | `/overtime`, `/m/overtime` |
| Shift-bid cycle (slots with bid number, times, report time, day boxes, route type, max drivers; rank 3) | `app/admin/bids/**`, `app/driver/bids/*` | `/bids/**`, `/m/bids` |
| Employee directory and employee form | `app/admin/employees/**` | `/people/**` |
| Reports tables (hours, overtime, forms, safety, bids) | `app/admin/reports/*` | `/reports` |
| Settings: break and overtime rules (v0 labels and order) | `app/admin/settings/*`, `lib/schemas/settings.ts` | `/settings` |

## 6. v0 business rules carried over (source of truth)

These come from the v0 code and migrations. The rebuild keeps them; only the
bugs and security holes are fixed. All values are per-organization settings
(`lib/settings.ts`), and the demo organization uses these defaults.

| Rule | v0 behaviour | v0 source | Rebuild |
|---|---|---|---|
| Breaks | Two paid 15-minute rest breaks. Break 1 window opens 135 min after start, break 2 opens 120 min before the planned end. Each window lasts 45 min. Planned shift is 480 min when unscheduled | migration `20260601000001` `generate_breaks` | `breaks.restPolicy = "fixed_two"` (default), `lib/labor/breaks.ts` |
| Break reminder / overrun | Reminder at 17 min (2 min grace), overrun at 20 min (5 min grace). A missed break is one still pending after its window closes. The dispatcher re-opens it with a new 45-minute window | `supabase/functions/break-monitor`, `app/dispatcher/actions.ts` | `private.run_break_monitor`, `reopen_break` |
| Break alert recipients | Missed: dispatcher, coordinator, supervisor. Overrun: dispatcher, management, supervisor | break-monitor | same; management maps to admin |
| Lunch | `has_lunch` / `lunch_waiver` flags on the sign-in | sign-in sheet | `shifts.meal_waived`; 30-minute unpaid meal planned for 8 h shifts |
| Overtime thresholds | 8 h daily, 40 h weekly, 1.5x | `app_settings.overtime_rules` | `settings.labor`; daily OT gated by the Nevada 1.5x-minimum-wage rule (owner decision in CLAUDE.md) |
| Week | ISO week, Monday start | `lib/payroll-calc.ts` `isoWeekKey` | `workweekStartsOn = 1` |
| Hours rounding | Hours rounded to 2 decimals | end-of-shift `total_hours` | minutes internally, shown as hours to 2 decimals |
| Pay period | Biweekly, closed by payroll, corrections audited | `app/admin/payroll/actions.ts` | `pay_periods` + lock/unlock; locked periods are immutable (v0 allowed edits after close: bug) |
| Fatigue | Single shift ≥ 10 h; more than 5 days in a week; weekly OT ≥ 10 h. Notifies dispatcher, supervisor, management | `lib/payroll-calc.ts`, migration `20260601000006` | same thresholds (`fatigue.*`), checked at every punch instead of only at payroll recalculation. Added FMCSA checks: 15 h on duty, 8 h rest, 60 h / 7 days |
| Wheelchair 10-51 escalation | 5 minutes without a dispatcher response escalates. Notifies the driver ("call dispatch directly") and admin/management | `supabase/functions/wheelchair-escalation` | `private.run_assist_escalation`, `assist.escalationMinutes = 5` |
| Radio codes | 10-8 In Service → in service (notify dispatcher). 10-39 On Break → in service (dispatcher, supervisor). 10-37 Fueling/Wash → fuel (dispatcher, admin, supervisor). 10-7 Out of Service → shopped DVIR (dispatcher, management). Board-only: 10-51 Assist Needed, 10-33 HAZARD | `lib/constants/radio-codes.ts`, `app/driver/actions.ts` | `radio_codes` rows (seeded identically) |
| Bus statuses | Ready, In Service, Charging, Fuel, Wash, Fuel + Wash, Maintenance (PMI), Shopped (DVIR), Repair, Safety Hold, Salvage, Training | `lib/constants/bus-status.ts` | same labels (`components/domain/status.tsx`) |
| End of shift | Ready → ready; charge required → charging; shop → shopped DVIR; hazard → safety hold (alerts dispatcher, management, admin). Diesel labels Full 100 / Over 3/4 80 / Over 1/2 60 / Under 1/4 20. EV "charge required" under 50% | `app/driver/actions.ts` | `submit_end_of_shift` |
| Fueler | fuel → ready; wash → ready; fuel + wash → wash after fueling, → fuel after washing | `app/fueler/actions.ts` | `/m/fuel` |
| Inspection defects | Any failed item → defect note, bus to Shopped (DVIR), notify technician / dispatcher / management | `flagBusOutOfServiceAction` | defects per failed item; vehicle to shop when a critical item fails |
| Fleet readiness | EV charge queue under 50%, diesel fuel queue under 25% | `fleet-client.tsx` | `readiness.*` settings |
| Shift bids | Cycle draft → published → locked → awarded. Rank up to 3 slots. Award by seniority number, then hire date | `app/admin/bids/actions.ts` | open/closed/awarded; non-submitters are no longer silently placed (bug) |
| Overtime awards | By seniority, then hire date, top N by slots | `app/admin/overtime/actions.ts` | `award_ot_offer` (locks the offer, no double award) |
| Login ID | Employee ID 3–8 digits on a keypad | `app/login/actions.ts` | kiosk employee number 3–8 digits + PIN 4–8 digits |
| Roles | admin, management, dispatcher, coordinator, supervisor, technician, fueler_washer, payroll, driver | role CHECK | CLAUDE.md's 7 roles. management and payroll fold into admin; fueler_washer becomes fueler |

### Nevada (NRS 608) items

The owner asked for these to be flagged rather than changed silently. On
2026-11-08 the owner delegated the decisions, and the choices were made in
favour of the law:

1. **Rest breaks on long shifts: decided to top up to the legal minimum.** v0
   always planned two rest breaks. NAC 608.145 requires a third at 11 hours
   worked and a fourth at 15.
   - The company schedule (`fixed_two`, the default) keeps v0's two breaks at
     v0's times.
   - For shifts of 11 or more hours worked, it now adds the extra breaks, each
     placed in the largest gap between the planned breaks.
   - Shifts under 11 hours behave exactly as in v0.
2. **Unpaid lunch: decided to deduct only a meal that is actually taken.** v0
   recorded `has_lunch` but paid the whole span.
   - The rebuild records the meal as an unpaid break when the employee takes it
     and excludes it from hours.
   - A waived meal (`meal_waived`) stays paid.
   - Nothing is auto-deducted. A driver kept on duty through lunch is paid for
     it.
   - NRS 608.019 requires a 30-minute meal for 8 continuous hours unless the
     employee voluntarily waives it.
3. **Weekly overtime per pay period.** v0 counted 40 hours across a whole
   biweekly period, which underpays a 50/30 split. The rebuild counts per
   workweek. This is a bug fix and required by law.
4. **Daily overtime for everyone.** v0 paid daily overtime regardless of rate.
   NRS 608.018 applies it only below 1.5x minimum wage. The owner chose the
   Nevada rule in CLAUDE.md, so the rebuild applies it, and an employee can be
   marked daily-OT exempt (4x10 agreement, CBA, Motor Carrier Act).
