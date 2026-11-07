# Audit: app/admin/ (+ actions/performance-snapshot.ts, scripts/check-admin-guards.mjs)

Paths below are relative to repo root; `A/` = `app/admin/`. Line numbers are from the files as read on 2026-11-07.

## 0. Cross-cutting findings (read first)

- **Route guard** `A/layout.tsx:5-17`: `getShellUser()`, allows only `admin` and `management`, else redirect `/unauthorized`. This is the ONLY guard for most pages (bids, buses, counting-sheets, employees/[id], fatigue, fleet-readiness, forms, inspections, map, overtime, payroll, reports, safety-meetings, settings, sign-in-sheets). Page-level guards exist only for airlines, emergency, lost-found, notifications, performance, bids (login only), forms (login only), overtime, reports, safety-meetings (login only).
- **Role model is inconsistent.** Layout lets in `admin` + `management`. Actions/pages variously allow `admin` only (airlines, emergency, notifications, fatigue-adjacent), `admin|management` (most), `admin|payroll` (payroll actions; `payroll` can never open `/admin/payroll` because the layout blocks it), `admin|management|payroll` (reports action), `dispatcher/supervisor/coordinator` (lost-found, performance, fatigue, overtime: dead branches under `/admin` because the layout blocks them; some are shared with `/dispatcher/*`). `management` is not in the owner's role list (admin, supervisor, dispatcher, coordinator, driver, fueler, technician). `payroll` and `management` are v0 inventions; role enum is in `lib/schemas/employee.ts:3-6`: admin, management, driver, dispatcher, coordinator, supervisor, technician, fueler_washer, payroll.
- **Layout-only authz is fragile** in Next App Router (layouts do not re-run on every client navigation/partial render; pages must guard themselves). `employees/[id]/page.tsx` fetches `select("*")` with the **service-role client and no guard at all**; `employees/page.tsx` relies on the action's guard.
- **Roles read from `user.app_metadata.role` (JWT)**: revocation/role changes lag until token refresh; no DB re-check. No `organization_id` anywhere, so there is no tenant scoping. Every query is global; all admin actions use `.eq('id', x)` with no org filter (multi-tenant rebuild must add this everywhere).
- **Two privilege models mixed**: ~half of the actions use the **service-role client** (bypasses RLS) after an in-code role check; the other half (bids, overtime, safety-meetings, forms) use the **user client and rely on RLS** to enforce write rules while the code check is the only visible one (RLS policies not audited here).
- **Almost no input validation.** zod used only in: buses (create/update), employees (create/invite/update), payroll correction, settings (break/OT rules). Everything else is raw FormData casts / unvalidated strings (dates, UUIDs, enums, lengths). FormData `as string` of null becomes inserted null/"null" errors.
- **No tests** for anything under `app/admin` or the guard script were found in scope (payroll calc lives in `lib/payroll-calc.ts`, not audited for tests here).
- **Hardcoded customer data**: `A/map/page.tsx:51` "Harry Reid International Airport"; `A/map/map-client.tsx:22` imports `TERMINALS, MAP_CENTER, MAP_DEFAULT_ZOOM` from `lib/terminals` (LAS-specific, global constants); `A/airlines/page.tsx` copy says "10-51 wheelchair request form" (a customer-specific form code); counting-sheet columns `rac, t1, t3, term1, term3_west, term3_east` are LAS-terminal-specific schema (`A/counting-sheets/page.tsx:20`). No literal "Transdev" string found in scope.
- **Dates/timezones**: default date filters use `new Date().toISOString().slice(0,10)` (UTC) in counting-sheets, inspections, sign-in-sheets pages. After ~4-5 PM Pacific it shows tomorrow. Payroll uses UTC `actual_start.split('T')[0]` as work_date and `period_end + 'T23:59:59'` (no tz). Wrong for Nevada payroll.
- **Notification plumbing is split**: `enqueueNotificationBatch` (lib/notifications) vs direct insert to `notification_queue` (forms/[id]/actions.ts:39) vs direct insert to `notifications` with a different column shape `{user_id,type,title,body,data}` (forms/[id]/actions.ts:131, uses auth user ids, others use employee ids). Likely dead/wrong table.
- **CSV exports**: no formula-injection guard anywhere (`=`, `+`, `-`, `@` prefix); `lib/payroll-calc.ts:100-103` `buildPayrollCSV` only quotes on comma (breaks on quote/newline); payroll CSV built client-side from loaded rows.
- **Pagination** inputs: inspections and sign-in-sheets use `parseInt(page)` without NaN/<1 guard (`inspections/page.tsx:12`, `sign-in-sheets/page.tsx:12`) → negative/NaN range.
- **Many `as any` casts** at page→client boundaries (bids, forms, inspections, counting, overtime, safety, sign-in): no typed DB layer (no generated Supabase types used).

## 1. Feature table

| Feature | Routes | Roles (who / how guarded) | Data | Broken | Missing |
|---|---|---|---|---|---|
| Airlines | `/admin/airlines` | admin only; page check `airlines/page.tsx:11` + `assertAdmin` in actions. Layout also admits management, who are then blocked by page | `airlines`; service-role | `.trim()` on unvalidated strings (throws on undefined); management blocked inconsistent with rest; no uniqueness; hardcoded copy about "10-51" form | zod validation, delete, phone format, audit |
| Shift bids | `/admin/bids`, `/bids/new`, `/bids/[id]` | admin+management (layout, plus per-action check). Pages check login only | `shift_bid_cycles`, `shift_bid_slots`, `shift_bid_submissions`, `shift_bid_awards`, `employees`; user client (RLS) | Award engine never implements non-submitter fill despite comment (bids/actions.ts:98-101); status transitions unvalidated server-side (any status to any status, even re-open `awarded`); `deleteSlotAction` doesn't check cycle id/status (UI hides it outside draft only) and cascades awards?; race/duplicates (no transaction, check-then-insert); `runAwardEngine` doesn't check cycle status=locked; `overrideAward` ignores slot capacity and wrong cycle/slot pair; seniority 9999 default hides missing data; `throw new Error` leaks DB messages | zod, submission-window enforcement (open/close times stored, not enforced here), tests, undo award, notify awardees, org scoping |
| Buses / fleet | `/admin/buses`, `/buses/new`, `/buses/[id]`, `buses/loading` | admin+management (layout + `requireAdminRole`) for writes; **reads via `getBusesAction/getBusDetailAction` have no role check** (RLS only) | `buses`, `bus_status_history`, `repair_notes`, `shifts`, `vehicle_inspections`, `tablets`; Realtime channel `admin-bus-board` (browser anon client); service-role for writes | `createBusAction` validates with zod but inserts the **raw** `data` not `parsed.data` (buses/actions.ts:253-262); `updateBusStatusAction` inserts history only when a reason given (relies on DB trigger otherwise; duplicate risk) and no transition rules; `createTabletAction` unvalidated, no UI uses it (dead); no duplicate bus_number handling; delete = soft delete (is_active=false) so `deleteBusAction` name misleads; UI browser client duplicated per component | Tablet management UI, status transition rules, bus_number uniqueness msg, VIN validation, maintenance schedule/PMI, org scoping |
| Fleet readiness | `/admin/fleet-readiness` | layout only; no page guard | `buses`, `repair_notes` (open defects); user client | EV charge threshold (<50%) and fuel threshold (<25%) hardcoded in UI (fleet-client.tsx:118,146); EV battery shares `fuel_level` column | Resolve-defect action, configurable thresholds, link to bus |
| Counting sheets (review) | `/admin/counting-sheets?date=` | layout only | `counting_sheets`, `counting_rows` (join driver/bus); user client | UTC date default; read-only | Edit/approve, export, totals per terminal, validation of columns; LAS-specific column names |
| Sign-in sheets | `/admin/sign-in-sheets?date=&page=` | layout only | `shifts` joined `employees`, `buses`, `tablets` | UTC date; page NaN; CSV client-side | Printing layout beyond `window.print()`, edit, per-driver signatures |
| Inspections (review) | `/admin/inspections?date=&type=&page=` | layout only | `vehicle_inspections`, `inspection_items`; damage drawing via `lib/damage` | UTC date; page NaN; `type` filter unvalidated; read-only | Defect→repair_note linking, approve/lock, photo view, export |
| Forms | `/admin/forms`, `/forms/[id]` | admin+management (`requireRole` in actions); pages check login only | `form_submissions`, `employees`, `shifts`, `notification_queue`, `notifications`; auth admin ban | `reviewFormAction` allows approving a `resignation` form without the termination side effects and lets any status transition (re-approve a denied form); `approveResignationAction` does not verify the submission is actually a resignation or pending; uses user client for `employees`/`shifts` writes (relies on RLS letting management terminate, else fails after partial work); no transaction (ordering workaround); ban 10y vs employees action 100y; `notifications` insert wrong table/shape; payroll recipients filtered by `role='payroll'` | Leave/PTO balance deduction on approval, comment required on denial/return, audit, validation, form-type-specific handlers |
| Employees | `/admin/employees`, `/new`, `/[id]`, `loading` | admin+management (action guard) | `employees`, `profiles`, `auth.users` (service-role `auth.admin.*`) | **Privilege escalation**: `management` can create/invite/promote `admin` and reset any admin's password (`resetEmployeePasswordAction` no target-role check, employees/actions.ts:358-386); no self-demotion/last-admin guard; `resetEmployeePasswordAction` has no zod/length check server-side (client-only >=8); email edit doesn't sync auth email; `createEmployeeAction` zod-validates then uses **raw `input`** for createUser and insert; `createEmployeeAction` and `getAllEmployeesAction` unused by UI (dead; create-with-password path); profiles insert failure swallowed (inconsistent state); orphan auth user if `updateUserById(app_metadata)` fails in invite; `pin: ""` placeholder; no PIN at all (owner wants PIN kiosk clock-in); CSV export unbounded + no formula escaping; `employees/[id]/page.tsx` unguarded service-role `select("*")`; duplicate `employee_id` not pre-checked; department/shift free text | PIN set/reset, PIN uniqueness, bulk import, audit log, deactivate vs terminate semantics, org scoping, hire_date/seniority recalculation, password policy |
| Fatigue | `/admin/fatigue` | layout only for page; actions: resolve = admin/management/supervisor, dismiss = admin/management/dispatcher | `fatigue_alerts` (+ joins `auth_users_resolved`, `auth_users_dismissed`); service-role | Page runs complex join then "fallback" only if result is null (not on error); `resolved_by_name` hardcoded null; `resolved_by/dismissed_by` store auth uid whereas emergency/lost-found store employees.id (inconsistent FK); resolve and dismiss not mutually exclusive; alerts only generated when payroll recalc runs (not real time) | Real-time fatigue detection, thresholds config (settings ignores them), notes required on dismiss, validation |
| Map | `/admin/map` | layout only | `shifts` (active), `buses`, `employees`, view `latest_bus_positions`; Realtime INSERT on `bus_positions` via browser anon client; Google Maps JS key `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Hardcoded "Harry Reid International Airport", LAS terminals/center; ETA from rolling 5 samples (`lib/gps-utils`); buses with no position hidden or null; realtime subscription not filtered by active bus; subscribes to all bus positions of all tenants | Routes management UI (spec says routes), geofencing, stale-GPS indicator, history playback, tenant filter |
| Notifications log | `/admin/notifications` | admin only (page check) | `notification_log` (limit 1000); user client | Hard cap 1000 rows, no pagination/filter server-side; CSV client-side no escaping; management blocked | Resend/retry, filter by date/type, preferences UI |
| Overtime | `/admin/overtime` | admin/management/dispatcher in actions; layout blocks dispatcher here (shared with `/dispatcher/overtime`) | `overtime_shifts`, `overtime_bids`, `overtime_awards`, `off_day_requests`, `ot_banner` (singleton), `employees`; user client | `awardOtShiftAction`: no check that shift is open or not already awarded (double award on double click), `insert(awards)` then separate status update (not atomic), awards by seniority only, no fatigue/weekly-hours eligibility check (e.g. NRS 608), unvalidated dates/numbers (`Number(null)=0` duration/slots), `bid_close_at` not enforced, banner update targets row `id='singleton'` (fails silently if missing; `.single()` banner default fallback), off-day request employee id unvalidated | Bid submission validation, rotation/equalization rules, OT hours tracking, tests |
| Payroll | `/admin/payroll`, `/payroll/[id]` | actions: admin or payroll only (NOT management); layout: admin/management only, so payroll role cannot reach UI and management can view but not act | `pay_periods`, `daily_hours_records`, `shifts`, `breaks`, `fatigue_alerts`, `payroll_exports`, `employees`; service-role | See section 2 payroll rules: constants hardcoded, ignores Nevada rules and `app_settings.overtime_rules`; **multiple shifts/day collide on upsert key `employee_id,work_date`** (batch upsert with duplicate keys errors; split shifts lose data); recalc overwrites manual corrections and is allowed on **closed** periods; no period validation (end>=start, overlap); `total_paid_hours` assumed DB generated; fatigue 10h rule; UTC dates; unpaid break time never deducted; `missedBreaks` param unused in calc; export log fire-and-forget | Nevada daily-OT rule (> 8 in 24h for < 1.5x min wage employees), wage data, state module with tests, period reopen, approvals, PTO/FMLA hours integration (hardcoded 0), audit trail beyond json, locking |
| Performance | `/admin/performance`, `loading` | admin/management/dispatcher/supervisor (page check; layout narrows to admin/management) | `employees` embed `driver_performance_snapshots`; writer `actions/performance-snapshot.ts` | Snapshot writer only records `attendance_status:'present'` + missed breaks; lateness, safety-meeting, inspection, counting metrics left to non-existent "performance job (N25)" so UI percentages are mostly 0/meaningless; attendance never 'late'/'absent' from this writer; 90-day window hardcoded; roles limited to driver + fueler_washer | The performance job, scoring weights, per-role metrics, export |
| Reports | `/admin/reports?tab=&page=` | layout; export action: admin/management/payroll; page login only | `shifts`, `overtime_awards`, `form_submissions`, `safety_meetings`+`safety_meeting_signins`, `shift_bid_awards`; user client (RLS) | `hours` report uses `shifts.total_hours` with no date range/employee filter; no date filters on any report; export unbounded; times formatted with server locale/tz; `window.print()` only | Date range, filters, charts, scheduled reports, payroll/OT/fatigue/lost-found reports |
| Safety meetings | `/admin/safety-meetings` | admin+management (actions); page login only | `safety_meetings`, `safety_meeting_signins`, `employees`, notification queue; user + service-role | Dept->roles map omits `dispatcher`, `supervisor` (non-coordinator) etc. (safety-meetings/actions.ts:251-257); no unique/valid date/time; complete/cancel not state-checked; `adminSignInEmployeeAction` can sign anyone in for cancelled/future meetings; notifies only employees with auth account | Attendance for self-sign-in (driver side), recurring meetings, sign-in sheet export, topic/attachments |
| Lost & found | `/admin/lost-found` | admin/management/dispatcher/supervisor/coordinator (page + `assertStaff`) | `lost_items`, `lost_item_status_history`, storage bucket `lost-and-found` (signed URLs 1h from browser client), `employees`; service-role | No state machine: any status to any status (e.g. disposed→found); `claimant_name` not required for `claimed`; `disposal_reason` may be `''`; `collectedBy` accepted from client (can attribute to others); history read through browser client relies on RLS | Intake form (admin side), claim ID verification, retention/disposal policy, search |
| Emergency | `/admin/emergency` | admin only (page + `assertAdmin`); management cannot trigger | `emergency_events` (partial unique index = one active), `emergency_acknowledgements`, `employees`; Realtime on `emergency_events` (browser anon); service-role | `message` unvalidated/unbounded; ack list excludes technician; ack poll every 10s per admin tab; realtime UPDATE handler captures stale `activeEvent` (empty-deps effect closure, eslint-disabled) so resolve from another session may not clear; resolve doesn't check event is active; `.single()` on employees fails for admin without employee row | Broadcast delivery (push/SMS), event history UI, drills, escalation |
| Settings | `/admin/settings` | admin+management (`requireRole`) | `app_settings` singleton: `break_rules`, `overtime_rules` (jsonb); service-role | **Overtime rules are saved but payroll ignores them** (hardcoded 8/40/1.5 in `lib/payroll-calc.ts`); `num()` falls back silently to defaults on blank; `award_method` free string; update targets `id='singleton'` (no upsert; no-op if row missing, returns success) | Org/company profile, roles, airlines/terminals config, state rule selector, audit trail |
| Notifications of other kinds | (n/a) | - | - | see cross-cutting | |

## 2. Concrete behaviours and rules by feature

### Airlines (`A/airlines/*`)
- List ordered by name (airlines/page.tsx:15-18). Upsert (insert or update by `id`) with name, terminal, phone, wheelchair_contact, notes, is_active (airlines/actions.ts:20-45). Toggle active (:47-55). Feeds the driver "10-51 wheelchair request" form.

### Shift bids (`A/bids/*`)
- Cycle lifecycle in UI: `draft -> published -> locked -> awarded` (bid-cycle-client.tsx:110-125). Slots editable/deletable only in draft in UI (:151,246); **server doesn't enforce**.
- Create cycle: name, start/end (end >= start), description, submission_open_at/close_at; `created_by` (bids/actions.ts:9-39).
- Slot: bid_number (>0), shift_start/end, report_time, days_sun..sat booleans, route_type, max_drivers (default 1), notes (:56-85).
- Award engine (:103-195): seniority order = `employees.seniority_number` asc (null=9999) then `hire_date` asc; for each submission (skip already awarded) give first ranked preference with capacity (`max_drivers` vs counted awards); else assign **first any slot with capacity**; inserts `award_method:'seniority'`, `preference_rank`. Non-submitters are **not** assigned (comment says they are). Existing awards pre-count capacity.
- Manual override: upsert on `(cycle_id, employee_id)` with `award_method:'manual'`, `override_reason` (:197-222). No capacity check. `awarded_by/awarded_at` stored on cycle when status=awarded (:47).
- Tabs: slots, submissions (with employee seniority), awards.

### Buses / fleet
- Statuses (lib/constants/bus-status.ts): ready, in_service, charging, fuel, wash, fuel_wash, maintenance_pmi, shopped_dvir, maintenance_repair, safety_hold, salvage, training. `AVAILABLE_STATUSES`/`OOS_STATUSES` drive fleet-readiness counts.
- Create: bus_number (upper-cased), vin, bus_type EV|Diesel, fuel_level, mileage, notes; status starts `ready`, `is_active:true` (buses/actions.ts:41-66).
- Update fields via zod `UpdateBusSchema`; status change with optional reason writes `bus_status_history` (:91-127); revalidates `/dispatcher`.
- Retire = `is_active=false` (history preserved) (:129-143). Bus detail shows last 50 status history, 20 shifts, repair notes, 30 inspections (:173-209).
- Admin board has live updates through Realtime channel `admin-bus-board`.
- Tablets: `createTabletAction` (tablet_number upper, serial, notes, is_available) exists, no UI.

### Fleet readiness
- Availability % = available statuses / fleet; EV charging queue (<50% fuel_level), Diesel fuel queue (<25%), maintenance queue (OOS statuses), open defects from `repair_notes where is_resolved=false` shown as "category — item" (fleet-readiness/page.tsx:12-33).

### Counting sheets / Sign-in sheets / Inspections (read-only review pages)
- Counting: one date, driver (name, seniority), bus, rows (departure_time, rac, t1, t3, term1, term3_west, term3_east), status, submitted_at.
- Sign-in sheets: one date, 50/page, shift scheduled/actual start/end, radio_status, employee, bus, tablet; CSV export + print (sign-in-sheets-client.tsx:46-73).
- Inspections: by date + type, 20/page, passed/failed items per inspection, `is_locked` badge, `has_defects`, damage drawing (strokes or legacy image via `lib/damage`).

### Forms
- List all `form_submissions`; detail review with status `approved|denied|returned` + comments → sets `reviewed_by/at`, `reviewer_comments`; notifies submitter (`form_approved|denied|returned`) (forms/[id]/actions.ts:7-53). Comment says the RLS policy `forms_own_update_returned` would otherwise let an employee self-approve (so RLS alone is known-weak).
- Resignation approval: terminate employee → cancel `scheduled|active` shifts → mark form approved → ban auth user 10 years (best effort) → notify payroll users (:55-137).

### Employees
- Directory: server-side search (name/employee_id/email, sanitized `[,()%*\\]`), role + status filter, sort seniority→hire_date→name (default; domain rule), 25/page, global stat counts (employees/actions.ts:420-489).
- Invite flow (UI uses invite only): Supabase invite email → redirect `/auth/callback`, set role in app_metadata, insert employee (balances pto/vacation/fmla default 0, status active) + profile (:197-275).
- Update: allow-listed strict zod; status change sets `is_active`, bans/unbans auth user (`876600h`), syncs profiles; role change syncs app_metadata + profiles (:279-345).
- Terminate/reactivate toggle, password reset (admin sets), CSV export of roster (:349-542).
- Statuses: active, on_leave, terminated.

### Fatigue
- Alert types `single_shift` (>=10h shift), `consecutive_days` (>5 distinct days in an ISO week), `ot_threshold` (weekly OT >=10h) — generated in payroll recalculation (payroll/actions.ts:276-357; lib/payroll-calc.ts:114-125). Resolve (with notes) or dismiss (with reason) (fatigue/actions.ts).

### Map
- Active shifts with assigned bus (inner join), latest position from view `latest_bus_positions`; live INSERTs on `bus_positions`; trail polyline (`TRAIL_LENGTH`), congestion dots, rolling-avg ETA (`lib/gps-utils`), terminals overlay (`lib/terminals`).

### Overtime
- Post OT shift: date, start_time, duration_hours, slots_available, description, bid_close_at, `status:'open'` (overtime/actions.ts:6-25). Close / cancel.
- Award: bids sorted seniority then hire_date, top `slots_available` get `overtime_awards` (`award_method:'seniority'`), shift → `awarded`, notify awardees in-app (:49-112).
- Banner (`ot_banner` singleton: active flag + message), shown on `/driver`. Off-day requests to a specific employee with date + message and notification (:136-167).

### Payroll
- Pay period: start/end/pay_date, `created_by` (payroll/actions.ts:185-202).
- Calculate (:209-361): shifts with `actual_start` in range and status `completed|active` → per shift `regular=min(total,8)`, `overtime=max(0,total-8)` (lib/payroll-calc.ts:21-26, **FLSA 8h/shift, not Nevada 24h-period rule, not wage-gated**); open shifts get 0 hours and `is_incomplete=true`; missed breaks counted (status `missed`); weekly step (`calcWeeklyOT`, :45-60) turns regular hours beyond 40 (week = **whole pay period**, not per workweek!) into OT; upsert `daily_hours_records` on `(employee_id, work_date)`.
  - **Bug**: `calcWeeklyOT` is applied to all of an employee's records in the period as one week; for 14-day/semi-monthly periods this treats 80 hours as one 40-hour week.
  - Fatigue alert dedup via `ignoreDuplicates` unique `(employee_id,shift_id,alert_type)` and "no open weekly alert" check.
- Close: blocked if any `is_incomplete` records; sets closed_by/at; notifies payroll/admin/management with totals (:367-433). Closed periods are not protected from recalculation or corrections.
- Correction: zod strict hours 0-24, appended to `audit_log` jsonb with previous values and reason (reason unvalidated/optional) (:439-489).
- Export CSV (client) + log row in `payroll_exports` (:495-509); CSV columns in lib/payroll-calc.ts:81-94.
- No pay rates/earnings: hours only.

### Performance
- 90-day window; metrics per driver/fueler: attendance % (present=100, late=70, absent=0 colouring, performance-client.tsx:57-59,162), safety meeting %, inspection %, missed breaks. Writer: `actions/performance-snapshot.ts` is an internal helper (not a server action, deliberately), service-role, upsert on `(employee_id,snapshot_date,shift_id)`, always `attendance_status:'present'`, `missed_breaks_count` only; other metrics default 0 → misleading percentages.

### Reports
- 5 tabs (hours, overtime, forms, safety, bids), 50 rows/page, CSV export of all rows through action `exportReportCSVAction` (reports/report-data.ts:9-18).

### Safety meetings
- Create (title, department drivers|coordinators|technicians|fueler_washer|all, date, time, location, notes) → notifies active employees by dept→role map (safety-meetings/actions.ts:250-302). Complete / cancel / admin sign-in of an employee as `present` with `added_by_admin` + note (upsert on `meeting_id,employee_id`).

### Lost & found
- Statuses: found → collected → returned_to_dispatch → claimed | disposed (no enforcement). Collected sets collected_by/at, claimed sets claimant name/id + time, disposed sets reason + time (lost-found/actions.ts:154-193). Photos from storage `lost-and-found` via signed URL; status history table.

### Emergency
- Types weather, airport_emergency, reroute, custom; one active event enforced by partial unique index (23505 mapped to friendly error); triggered_by/resolved_by = employees.id; ack status lists acked vs not-acked among driver, dispatcher, supervisor, coordinator, fueler_washer (emergency/actions.ts:14-87).

### Settings
- Break rules: break_count 2, duration 15, flex 45, break1 after 135 min, break2 before end 120, default shift 480, overstay reminder 17 / alert 20, dispatcher override. Overtime rules: daily 8, weekly 40, multiplier 1.5, award method seniority, bid cycle months 4 (defaults in settings/actions.ts:388-423). Break rules are read by the break subsystem; OT rules are not used by payroll.

## 3. Server actions inventory

Legend: V = input validation (zod = yes zod; manual = ad hoc checks; none). Role = server-side role check. Client = anon/user (RLS) = `createSupabaseServerClient`, admin = service-role `createSupabaseAdmin`.

| File | Action | V | Role check | Client |
|---|---|---|---|---|
| airlines/actions.ts | upsertAirlineAction | none (`.trim()` only) | admin | admin |
| airlines/actions.ts | toggleAirlineActiveAction | none | admin | admin |
| bids/actions.ts | createCycleAction | manual (name, dates) | admin, management | user |
| bids/actions.ts | updateCycleStatusAction | none (status arbitrary) | admin, management | user |
| bids/actions.ts | addSlotAction | manual (bid_number, times) | admin, management | user |
| bids/actions.ts | deleteSlotAction | none | admin, management | user |
| bids/actions.ts | runAwardEngineAction | none | admin, management | user |
| bids/actions.ts | overrideAwardAction | none (reason unvalidated) | admin, management | user |
| buses/actions.ts | createBusAction | zod (but raw data inserted) | admin, management | admin |
| buses/actions.ts | updateBusAction | zod | admin, management | admin |
| buses/actions.ts | updateBusStatusAction | manual (status in label map) | admin, management | admin |
| buses/actions.ts | deleteBusAction (soft) | none | admin, management | admin |
| buses/actions.ts | createTabletAction | none | admin, management | admin |
| buses/actions.ts | getBusesAction | none | **none** (RLS only; callable by any authenticated user) | user |
| buses/actions.ts | getBusDetailAction | none | **none** (RLS only) | user |
| emergency/actions.ts | triggerEmergencyAction | none (type union is TS-only) | admin | admin |
| emergency/actions.ts | resolveEmergencyAction | none | admin | admin |
| emergency/actions.ts | getEmergencyAckStatusAction | none | admin | admin |
| employees/actions.ts | createEmployeeAction | zod (raw input used after) | admin, management (can create admin) | admin (+auth.admin) |
| employees/actions.ts | inviteEmployeeAction | zod (raw input used after) | admin, management (can invite admin) | admin (+auth.admin) |
| employees/actions.ts | updateEmployeeAction | zod strict | admin, management (can change role to admin/ban anyone) | admin (+auth.admin) |
| employees/actions.ts | toggleEmployeeStatusAction | via update zod | admin, management | admin |
| employees/actions.ts | resetEmployeePasswordAction | **none** | admin, management (can reset admin pw) | admin (+auth.admin) |
| employees/actions.ts | getAllEmployeesAction | none | admin, management | admin |
| employees/actions.ts | getEmployeesPageAction | manual (page clamp, search sanitised) | admin, management | admin |
| employees/actions.ts | exportEmployeesCSVAction | none | admin, management | admin |
| fatigue/actions.ts | resolveAlertAction | none | admin, management, supervisor | admin |
| fatigue/actions.ts | dismissAlertAction | none | admin, management, dispatcher | admin |
| forms/[id]/actions.ts | reviewFormAction | none (status TS-only) | admin, management via `requireRole` | user + admin (notify) |
| forms/[id]/actions.ts | approveResignationAction | none | admin, management via `requireRole` | user (employees/shifts writes via RLS) + admin (ban) |
| lost-found/actions.ts | transitionLostItemAction | none | admin, management, dispatcher, supervisor, coordinator | admin |
| overtime/actions.ts | postOtShiftAction | none | admin, management, dispatcher | user |
| overtime/actions.ts | closeOtShiftAction | none | same | user |
| overtime/actions.ts | cancelOtShiftAction | none | same | user |
| overtime/actions.ts | awardOtShiftAction | none | same | user (+ queue helper) |
| overtime/actions.ts | updateBannerAction | none | same | user |
| overtime/actions.ts | sendOffDayRequestAction | none | same | user |
| payroll/actions.ts | createPayPeriodAction | none | admin, payroll | admin |
| payroll/actions.ts | calculatePayPeriodHoursAction | none | admin, payroll | admin |
| payroll/actions.ts | closePayPeriodAction | none | admin, payroll | admin |
| payroll/actions.ts | correctDailyHoursAction | zod strict (hours only; reason none) | admin, payroll | admin |
| payroll/actions.ts | logPayrollExportAction | none | admin, payroll (silent return) | admin |
| reports/actions.ts | exportReportCSVAction | manual (tab whitelist) | admin, management, payroll | user (RLS) |
| safety-meetings/actions.ts | createMeetingAction | none | admin, management | user + admin (recipients) |
| safety-meetings/actions.ts | completeMeetingAction | none | admin, management | user |
| safety-meetings/actions.ts | cancelMeetingAction | none | admin, management | user |
| safety-meetings/actions.ts | adminSignInEmployeeAction | none | admin, management | user |
| settings/actions.ts | updateBreakRulesAction | zod (`BreakRulesSchema`) | admin, management (`requireRole`) | admin |
| settings/actions.ts | updateOvertimeRulesAction | zod (`OvertimeRulesSchema`) | admin, management (`requireRole`) | admin |
| actions/performance-snapshot.ts | writePerformanceSnapshot | none (shiftId) | **none, by design: NOT a server action** (no `'use server'`); must only be called from `submitEndOfShiftAction` (app/driver/actions.ts) which uses `requireUser()`; note comment: caller doesn't verify the shift belongs to the caller here | admin |

Notes on the action-level patterns:
- Error contract is inconsistent: some return `{error}`, some `ActionResult` (`lib/actions/result`), some `throw new Error(dbMessage)`; thrown errors from `throw` in actions (bids, overtime, safety, forms) surface as generic production errors and leak DB messages in dev.
- Several actions silently succeed when the target row doesn't exist (update by id with no row-count check).
- No rate limiting, no audit logging (except payroll corrections jsonb and bus history), no idempotency.

## 4. `scripts/check-admin-guards.mjs` (static security gate)

- Purpose: parse every `'use server'` module under `app/` and `actions/` with the TypeScript compiler and fail if any exported function calls `createSupabaseAdmin` without an "authorization signal" (scripts/check-admin-guards.mjs:1-29, 80-173). Signals: a call to any function named `require*/assert*/ensure*`, OR any identifier/property text containing `app_metadata`, OR an `ALLOWLIST` entry (only `app/login/actions.ts#signInWithEmployeeId`, pre-auth, "rate-limited").
- Weaknesses:
  1. Name-based: any function called `requireX`/`assertX` passes, even one that checks nothing; **mere mention of `app_metadata` passes** (e.g. just reading it), no check that a role is compared.
  2. `requireUser()` counts as authorization, so any logged-in user passes for actions on client-supplied ids (the file's own comment admits this).
  3. Only checks functions that call `createSupabaseAdmin` **directly in the same function**: helpers that wrap the admin client (e.g. `writePerformanceSnapshot` which is a non-action), or actions calling a shared helper that uses admin, are not detected. Actions using the user client (RLS) are not checked at all (bids, overtime, safety, forms, buses reads: unguarded reads `getBusesAction`).
  4. Only module-level `'use server'` directive is detected; inline `'use server'` inside functions in server components is skipped.
  5. Only top-level exported function declarations and arrow/function-expression variable declarations are considered; `export { x }`/re-exports, `export default`, and functions added via object properties are missed.
  6. No tenant/organization scoping check, no check that role lists are correct (e.g. management escalation), no check for input validation.
  7. Not wired in as an npm script here (header says "wire into CI"); verify package.json before relying on it.
  8. Uses `typescript` as a runtime dep from a dev script (fine) and hard-coded `SCAN_DIRS = ['app','actions']` (misses `lib/` server code).

## 5. Rebuild recommendations (short)

1. Introduce `organization_id` on every table and in every query, JWT claim or membership table instead of reading `app_metadata.role` only; one `requireRole(org, roles)` helper used by every action (including reads and user-client actions).
2. Collapse role vocabulary to the owner's list; decide whether `management` and `payroll` exist; make layout, page, and action role sets identical (single constant).
3. Zod for every action input (including ids as uuid, dates, enums, FormData parsing), consistent `ActionResult`.
4. Put labour rules (Nevada daily OT > 8h/24h for wage < 1.5x min wage, weekly > 40h, per-workweek not per-period, split shifts, unpaid meal deduction, local timezone) in one tested module that payroll and settings both use; remove hardcoded 8/40.
5. Make state transitions explicit (bid cycles, lost items, OT shifts, forms, pay periods) and atomic (Postgres RPC/transactions for awards, resignation, pay period close).
6. Prevent `management` creating/resetting admins; protect last admin; add audit log.
7. Replace LAS-specific constants (terminals, map center, counting-sheet columns, "10-51") with per-organization configuration.
8. Fix payroll uniqueness (`employee_id, work_date` collides for multiple shifts) and block recalculation/corrections on closed periods.
