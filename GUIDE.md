# Rolecall — Complete Project Guide

> A full, easy-to-follow guide to the Rolecall transportation-operations platform: what it is, who uses it, every feature, and how the whole system fits together.

---

## Table of Contents

1. [What Rolecall Is](#1-what-rolecall-is)
2. [Technology Stack](#2-technology-stack)
3. [The Big Picture (Architecture)](#3-the-big-picture-architecture)
4. [Roles & Access](#4-roles--access)
5. [Logging In](#5-logging-in)
6. [The Operational Spine (the core daily lifecycle)](#6-the-operational-spine)
7. [Driver Tablet — Every Feature](#7-driver-tablet--every-feature)
8. [Dispatcher](#8-dispatcher)
9. [Coordinator & Supervisor](#9-coordinator--supervisor)
10. [Dispatch Board (Wall Display)](#10-dispatch-board-wall-display)
11. [Technician](#11-technician)
12. [Fueler / Washer](#12-fueler--washer)
13. [Admin Console — Every Section](#13-admin-console--every-section)
14. [Payroll](#14-payroll)
15. [Internal Chat](#15-internal-chat)
16. [Notifications](#16-notifications)
17. [Subsystems Deep-Dive](#17-subsystems-deep-dive)
18. [Database Reference](#18-database-reference)
19. [Async / Scheduling Layer](#19-async--scheduling-layer)
20. [Theming & Design System](#20-theming--design-system)
21. [Security Model](#21-security-model)
22. [Developer Guide](#22-developer-guide)
23. [Glossary & Reference Tables](#23-glossary--reference-tables)
24. [Operational Status & Owner To-Dos](#24-operational-status--owner-to-dos)

---

## 1. What Rolecall Is

**Rolecall** is a workforce-management and operations portal for an **airport shuttle-bus operator** — built for Transdev at **Harry Reid International Airport (LAS), Las Vegas**. It replaces a stack of paper workflows (sign-in sheets, trip-count sheets, vehicle inspections, time-off slips) with one real-time digital system.

- **Scale:** designed for **200+ daily users across 9 roles**.
- **Two audiences, two device profiles:**
  - **Field staff** (drivers, fuelers) work on **in-vehicle tablets** with big touch targets, a safety motion-lock, and offline support.
  - **Office staff** (dispatch, coordinators, admin, payroll) work on desktop consoles and a wall-mounted dispatch board.
- **What it manages:** the full life of a shift — signing a driver in, assigning a bus and tablet, tracking GPS, enforcing breaks, running pre/post-trip inspections, counting passengers, ending the shift, and feeding hours into payroll — plus shift bidding, overtime, fatigue monitoring, safety meetings, lost & found, wheelchair-assist requests, internal chat, and emergency broadcasts.

The codebase is the result of a **targeted production rebuild** (audited and rebuilt in phases 1–11). The original "v1" kiosk and legacy tables were removed; the "v2" data model and pure utility libraries were kept and the broken operational layers (shift-close, break generation, the async/cron layer, notifications, GPS) were rebuilt.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | **Next.js 16** (App Router, React Server Components) |
| UI runtime | **React 19**, TypeScript (strict mode) |
| Styling | **Tailwind CSS 4** with OKLCH semantic design tokens; `next-themes` for light/dark |
| Components | Radix UI primitives, `lucide-react` icons, `sonner` toasts, `recharts` charts, `cmdk` |
| Forms/validation | `react-hook-form` + **Zod** (server-side validation) |
| Backend | **Supabase** — Postgres, Auth, Realtime, Storage, Edge Functions (Deno) |
| Scheduling | **pg_cron + pg_net** calling Edge Functions |
| Email | **Resend** (transactional email via the notification processor) |
| Maps | **Google Maps** via `@vis.gl/react-google-maps` |
| PDF/export | CSV builders + `jspdf` |
| Testing | **Vitest** (unit tests for pure logic) |
| Hosting | **Vercel** (app) + Supabase (DB/functions); originally scaffolded on v0.app |

---

## 3. The Big Picture (Architecture)

Rolecall is a **server-first Next.js app on top of Supabase**. Five ideas explain almost everything:

1. **Server Components fetch data; Client Components are leaves.** Each route's `page.tsx` runs on the server, authenticates, fetches via an RLS-bound Supabase client, and passes data to a `*-client.tsx` island for interactivity.
2. **Mutations go through Server Actions.** Files named `actions.ts` export `'use server'` functions. The standard shape is: **authorize (`requireRole`) → validate (Zod `safeParse`) → write (checking `error`) → `revalidatePath` → return an `ActionResult`.**
3. **Row-Level Security (RLS) is the real security boundary.** Every table has policies keyed off the user's role, which lives in the **non-spoofable** `app_metadata.role` JWT claim (set server-side). Privileged actions that must bypass RLS use the service-role admin client — but only *after* a `requireRole` check.
4. **Realtime keeps screens live.** Dashboards subscribe to Postgres changes (`postgres_changes`). To avoid refetch storms, subscriptions are server-filtered (e.g. `date=eq.<today>`) and coalesced with `useDebouncedRefresh()`; the board merges payloads directly into state.
5. **The async "spine" runs on cron.** Things that must happen without a user present — closing the loop on breaks, processing the notification outbox, escalating wheelchair requests, nagging for chat confirmations — are **pg_cron jobs that POST to Edge Functions** every 1–5 minutes.

```
Browser (tablet / console / board)
   │  Server Components (RLS-bound reads)  +  Server Actions (writes)
   ▼
Supabase Postgres  ──RLS──  Auth (app_metadata.role)  ──  Realtime (live screens)
   │                                                         ▲
   │ pg_cron → pg_net → Edge Functions                       │
   ▼                                                         │
notification_queue (outbox) → processor → Resend email + materialize in-app → notifications → bell
```

### Project layout

```
app/                 Next.js routes (one folder per role + shared pages)
  page.tsx           Root: redirects each role to its home
  layout.tsx         Root layout (theme provider, fonts, analytics)
  login/ onboard/    Auth entry + password setup
  auth/callback/     Invite/OAuth code exchange
  driver/ dispatcher/ coordinator/ supervisor/ technician/ fueler/  Role apps
  admin/             Admin console (21 sections)
  board/ chat/ balances/ safety/[token]/   Shared & public pages
  error.tsx global-error.tsx loading.tsx   Error boundaries + skeleton
components/          Shared UI (driver-shell, notification-bell, damage board, theme)
lib/                 Pure logic + infrastructure (see §17, §21)
  domain-ish: payroll-calc, gps-utils, terminals, damage
  infra: supabase{,-server,-admin}, auth/rbac, actions/result, schemas/*, constants/*
actions/             performance-snapshot writer
supabase/
  migrations/        ~40 SQL migrations (phases 1–11)
  functions/         5 Edge Functions (Deno)
  seed.sql config.toml CRON_SETUP.md RECOVERY.md
tests/               Vitest suites (payroll, gps, n-tasks)
middleware.ts        Route protection + session refresh
```

---

## 4. Roles & Access

There are **9 roles**, stored in `employees.role` and mirrored into the JWT as `app_metadata.role`:

| Role | Home page | Can reach |
|---|---|---|
| **admin** | `/admin/employees` | Everything |
| **management** | `/admin/employees` | Everything (admin console + all ops) |
| **driver** | `/driver` | Driver tablet app only |
| **dispatcher** | `/dispatcher` | Dispatcher console, sign-in, overtime, board, chat |
| **coordinator** | `/coordinator` | Read-mostly monitoring + compliance verdicts |
| **supervisor** | `/coordinator` | Same as coordinator (route consolidated) |
| **technician** | `/technician` | Repair/defect queue |
| **fueler_washer** | `/fueler` | Fuel/wash queue (+ forms, safety, lost&found) |
| **payroll** | `/admin/payroll` | Payroll module |

`employees.status` is separately one of `active | on_leave | terminated`. Terminated employees are blocked at login and have their auth account banned.

**How access is enforced (defense in depth):**
- **`middleware.ts`** intercepts every request, refreshes the session, and gates route prefixes by role (redirecting to `/login` if signed out, `/unauthorized` if wrong role). Public exceptions: `/login`, `/onboard`, `/auth/callback`, `/unauthorized`, `/safety/*`, and static assets.
- **Each role layout** (e.g. `app/admin/layout.tsx`) re-checks the role server-side and redirects if it doesn't match.
- **Each Server Action** calls `requireRole(...)` before doing privileged work.
- **RLS policies** on the database are the final backstop.

---

## 5. Logging In

### Hybrid login (`app/login/page.tsx` + `app/login/actions.ts`)

The login screen has **two tabs**:

- **Employee ID (kiosk mode)** — for drivers/operators on tablets. A 4–8 digit numeric ID typed on an **on-screen keypad** (1-9, 0, DEL, CLEAR) plus a password.
  - The server action `signInWithEmployeeId()`:
    1. Validates the ID format (`/^\d{3,8}$/`).
    2. **Rate-limits** per ID — 5 attempts / 15-minute sliding window. On lockout: *"Too many attempts. Try again in X minute(s), or sign in with your email."* The counter is **durable in Postgres** (`register_login_attempt` / `clear_login_attempts` RPCs over a `login_attempts` table) so the cap holds across all serverless instances, with an automatic fallback to a per-instance in-memory limiter if the RPC isn't available yet.
    3. Uses the service-role client to look up the **email + status** for that `employee_id` (never reveals whether an ID exists — generic error either way).
    4. Rejects `terminated` employees.
    5. Signs in server-side with the resolved email + password, setting the session cookie.
    6. Clears the rate-limit counter on success and returns the role for redirect.
- **Staff Email (office mode)** — standard email + password, signed in directly via the Supabase client.

On success the user is routed to their role home (see the table in §4) or to a `redirectTo` param.

### Onboarding (`app/onboard/page.tsx`)

New employees are invited by an admin (magic-link email). The link lands on `/auth/callback` (which exchanges the code for a session) → `/onboard`, where the user sets a password (min 8 chars, confirmed) via `auth.updateUser`. They're then routed to their role home.

### Password reset

Admins can set a new password directly from the employee edit screen (no email round-trip) via `auth.admin.updateUserById`.

### Sign out

The shared `SignOutButton` calls `auth.signOut()` and returns to `/login`. Present in every role's header.

---

## 6. The Operational Spine

This is the **core daily lifecycle** that everything else hangs off. Understanding this one flow explains most of the app:

```
1. SIGN-IN   Dispatcher signs a driver in (assigns bus + tablet, captures signature,
             lunch/lunch-waiver). Shift row is created status='active', actual_start=now.
                │
2. BREAKS     A DB trigger (generate_breaks_on_active) fires and auto-creates the
   AUTO-GEN    two 15-minute break rows with their time windows.
                │
3. ON ROUTE   Driver tablet streams GPS to bus_positions (~every 10s). Driver taps
             radio codes (10-8 / 10-39 / 10-37 / 10-7) which update shift + bus status
             and notify the right roles. Motion-lock blacks out the screen while moving.
                │
4. BREAKS     Driver starts/stops each break in its window. The break-monitor cron
   ENFORCED    marks missed/overrun breaks and fires 17-min reminders / 20-min overstay
             alerts. Dispatcher can re-enable a missed break.
                │
5. INSPECT /  Pre-trip & post-trip inspections (defects → repair notes → bus OOS).
   COUNT       Passenger counting sheets per trip.
                │
6. END SHIFT  Driver submits End-of-Shift: fuel/charge level + bus status (Ready /
             Charge Required / Needs Shop / HAZARD). This action CLOSES the shift:
             stamps actual_end, computes total_hours (calcDailyHours), sets
             status='completed', frees the tablet, writes a performance snapshot.
                │
7. PAYROLL    Closed shifts feed the payroll daily-hours engine (regular vs OT,
             paid breaks not subtracted). Coordinators give each EOS an OK/Flag verdict.
             Excessive hours/days raise fatigue alerts.
```

If you ever wonder "why does X matter?", trace it back to this spine.

---

## 7. Driver Tablet — Every Feature

The driver app (`/driver/*`) is wrapped by **`components/driver-shell.tsx`**, which provides three always-on safety/reliability behaviors, plus a dashboard and a set of tools.

### 7.1 The Driver Shell (motion lock, offline, emergency)

- **Motion safety lock.** A `geolocation.watchPosition` loop reads GPS speed (`coords.speed`, m/s → mph). When speed **> 5 mph for 8 s**, the screen is replaced by a **full-screen black lock** showing a giant military clock (`HHMM`), the date, and *"Keep your eyes on the road."* It releases after speed **≤ 5 mph for 15 s**. Drivers flagged `motion_lock_exempt` (a `session_overrides` row) skip the lock.
- **Offline queue.** When `!navigator.onLine` or a write fails, data is saved to **IndexedDB** (`lib/indexed-db.ts`, DB `tc_offline`) across four stores: `pending_status_changes`, `pending_breaks`, `pending_counting_sheet_rows`, `pending_inspections`. A banner shows **NO CONNECTION → RECONNECTED, Syncing → ✓ Sync complete**. On reconnect, `triggerSync()` drains the queues in order into the **real** tables (radio status, breaks, `counting_sheets`+`counting_rows`, `vehicle_inspections`+`inspection_items`), deleting each entry only after a successful write.
- **Emergency alerts.** Subscribes to emergency events and shows them over everything (even the lock screen).

### 7.2 Dashboard (`app/driver/driver-dashboard.tsx`)

- Greeting + date; **OT banner** if management has one active.
- **GPS status pill** (green "tracking active" / red "GPS unavailable"). When the shift is active, GPS is written to `bus_positions` every 10 s (lat/lng, speed, heading, accuracy).
- **No-shift state:** *"No active shift today. See your dispatcher to be signed in."*
- **When a shift is active:** bus card (number, EV/Diesel, fuel/charge %), scheduled start/end, the radio-code bar, break management, and quick-launch tiles (Counting Sheet, Pre-Trip, Post-Trip, 10-51, Lost & Found, Forms, End of Shift).

### 7.3 Radio codes

Four big buttons. Each updates `shift.radio_status`, maps the **bus status**, and notifies roles (`app/driver/actions.ts → radioCodeAction`):

| Code | Meaning | Bus → | Notifies |
|---|---|---|---|
| **10-8** | In Service | `in_service` | dispatcher |
| **10-39** | On Break (driver on break, bus still in service) | `in_service` | dispatcher, supervisor |
| **10-37** | Fueling / Wash | `fuel` | dispatcher, admin, supervisor |
| **10-7** | Out of Service | `shopped_dvir` | dispatcher, management |

(The board also recognizes `10-51` "Assist Needed" and `10-33` "HAZARD".)

### 7.4 Breaks (driver side)

Two break cards (Break 1 / Break 2) show status and window. **Start Break** is enabled only inside the window (`window_open ≤ now ≤ window_close`). While active, a large banner shows a **MM:SS countdown** from `actual_start + duration_minutes`, turning red and showing "⚠ OVERRUN" past zero. **End Break** completes it. Starting/ending breaks also sends the 10-39 / 10-8 radio codes. See §17.1 for the full break engine.

### 7.5 Pre-trip / Post-trip inspections (`app/driver/inspection/[type]`)

- **11 checklist categories** (Exterior, Tires, Lights, Brake Systems, Steering, Gauges, Interior, Passenger Ramp, Parking Brake, Safety Equipment, Mirrors — defined as `INSPECTION_CHECKLIST` in `lib/supabase.ts`), each item marked **OK** or **DEF** (with a defect description).
- **Mileage:** pre-trip captures beginning mileage; post-trip captures ending mileage and computes miles driven.
- **Damage diagram:** a 4-view vector drawing canvas (Front, Rear, Driver Side, Curb Side) with Pen/Marker/Highlighter tools, 4 colors, undo/clear. Strokes are stored as **normalized vector points** (`lib/damage.ts`), not flattened PNGs (legacy PNGs still render).
- **Defects → action:** each DEF item creates a `repair_notes` row; submitting an inspection with defects calls `flagBusOutOfServiceAction` which moves the bus to `shopped_dvir` and notifies technicians/dispatch.
- Saved as `vehicle_inspections` (+ `inspection_items`); locks once submitted. Offline-safe.

### 7.6 Passenger counting sheet (`app/driver/counting-sheet`)

A per-trip grid: each row has a **departure time** and counts for **RAC, T1, T3, Term1, Term3 West, Term3 East**, with live row + grand totals. Add/delete rows. **Save Draft** persists non-empty rows; **Submit** marks it submitted and notifies admin/dispatch. Offline-safe (queues to IndexedDB). Stored in `counting_sheets` + `counting_rows`.

### 7.7 End of Shift (`app/driver/end-of-shift`)

- **Fuel/charge entry:** EV buses enter a % (< 50% ⇒ "Charge Required"); diesel buses pick Full / Over¾ / Over½ / Under¼.
- **Bus status after shift:** Ready for Service / Charge Required / Needs Shop / **⚠ HAZARD** (purple; alerts dispatch + management immediately).
- **On submit (`submitEndOfShiftAction`)** — this is the keystone that **closes the shift**: inserts the EOS submission, updates the bus (fuel + status), stamps `actual_end`, computes `total_hours` via `calcDailyHours`, sets `status='completed'`, frees the tablet (`tablets.is_available = true`), and best-effort writes a performance snapshot.

### 7.8 10-51 Wheelchair request (`app/driver/10-51`)

Driver submits passenger name + **airline** (autocomplete from the `airlines` directory, shows terminal/contact) + flight number. It creates a `wheelchair_requests` row (`status='pending'`) and shows live status: **acknowledged** (with dispatcher response) or **escalated** ("call dispatch directly") if no response in 5 minutes (the escalation cron — §19).

### 7.9 Digital forms (`app/driver/forms`)

Form types: **Time-Off** (leave types: Vacation / PTO / Jury Duty / Bereavement / Birthday), **Incident Report** (date, bus #, location, type, description, witnesses, passenger info, supervisor-contacted, injuries/damage), **FMLA Conversion** (dates, condition, provider, vacation-pay-usage, estimated hours), **Resignation** (last day, reason — warns access will be deactivated on approval), and a **Bid/Vacation-change** request. Submitted into `form_submissions` (validated, ≤20 KB payload). Drivers see status badges (submitted / under_review / approved / denied / returned) and **Confirm Receipt** on a decided form. See §17.6 for the approval workflow.

### 7.10 Other driver tools

- **Shift Bids** (`/driver/bids`) — view the active cycle's slots, submit up to 3 ranked preferences, and see your award. Seniority decides awards (§17.5).
- **Overtime** (`/driver/overtime`) — see the OT banner, respond to **off-day work requests** (Accept / Decline / Custom availability), and **bid on open OT shifts**; see awarded shifts.
- **Lost & Found** (`/driver/lost-found`) — report a found item with location, bag flag + contents, and up to 5 photos (uploaded to Storage); notifies dispatch.
- **Safety Meetings** (`/driver/safety-meetings`) — upcoming/past meetings; **Sign In** records attendance (`safety_meeting_signins`).
- **Performance** (`/driver/performance`) — last 90 days of `driver_performance_snapshots` (attendance, missed breaks, safety-meeting & inspection counts).
- **My Balances** (`/balances`) — self-service PTO / Vacation / FMLA balances + seniority rank (see §13/§14).

---

## 8. Dispatcher

Console at `/dispatcher` (roles: admin, management, dispatcher).

### 8.1 Dashboard (`dispatcher-client.tsx`)

- **Summary pills:** Active Drivers, Scheduled, Ready Buses, On Route, and a pulsing **Break Alerts** count.
- **Active Drivers table:** driver (name + seniority), bus, tablet, start time, **Break 1 / Break 2 badges** (pending/active/completed/missed/overrun), and current radio code.
- **Break Alerts panel:** every active/overrun/missed break with a **"Re-enable break"** button (`reEnableBreakAction`) that resets a break to pending, opens a fresh window now, and records the dispatcher override (`dispatcher_override_by/at`).
- **Ready buses** mini-list.
- Realtime via the `dispatcher-shifts` channel, server-filtered to today and **debounced** (1 s) to prevent refetch storms.

### 8.2 Digital Sign-In Sheet (`/dispatcher/sign-in`)

The dispatcher's main action: sign a driver in. Pick driver + bus + tablet, set scheduled start/end, lunch / lunch-waiver, capture a **signature** on a canvas, add notes → creates the shift `status='active'` with `actual_start=now`. (This is what triggers break auto-generation.) A live, printable list shows today's sign-ins with status and an "LW" badge for lunch waivers.

### 8.3 Wheelchair alerts (`wheelchair-alerts.tsx`)

A pulsing panel of pending/acknowledged/escalated `wheelchair_requests`. Dispatcher can **Respond** (free-text → status `acknowledged`, `dispatcher_response`, `responded_at`) or **Resolve**. Realtime on inserts/updates.

### 8.4 Overtime management (`/dispatcher/overtime`)

- **OT banner** editor (toggle active + message → shows on driver dashboards/board).
- **Post & close OT shifts** (date, start, duration, slots, bid-close, description); `closeOtShiftAction` stops bidding.
- **Off-day requests:** send a request to an employee for a specific date (enqueues an in-app notification asking them to respond).

---

## 9. Coordinator & Supervisor

`/coordinator` (roles: admin, management, coordinator, supervisor; the layout shows a **"Read-only"** badge). `/supervisor` simply **redirects to `/coordinator`** — the two restricted-scope monitor roles were consolidated.

- **Summary pills:** Active / Scheduled / Completed / Total.
- **Break alerts** + **Active Drivers** roster (with break badges and radio codes).
- **Shift notes:** inline editor per shift (`saveShiftNotesAction`).
- **EOS compliance verdicts (the coordinator's signature task):** for each completed shift, give an **✓ OK** or **✗ Flag** verdict with a note (`saveComplianceVerdictAction`). The UI **suggests** a verdict — Flag if any break was missed/overrun or the shift never closed, OK otherwise. Stored as `compliance_verdict / compliance_note / compliance_by / compliance_at`.

Writes use the admin client behind `requireRole`, since coordinators have no direct RLS write on shifts.

---

## 10. Dispatch Board (Wall Display)

`/board` (roles: admin, management, dispatcher, supervisor) — a chromeless, full-screen Kanban for a wall-mounted screen.

- **Top bar:** military clock (1 s tick), date, and counts (active drivers, available buses, OOS, fatigue alerts), plus links to the GPS map and dispatcher.
- **Bus grid:** one card per bus — number, EV/Diesel, **status** (canonical color), driver, radio code + meaning, **fuel/charge bar** (green/yellow/red), and a **GPS freshness dot** (green live / red "GPS⚠ Xm" if stale > 10 min). Click a card for a detail panel.
- **Detail panel:** driver, speed & heading, **ETA to each terminal** (computed from recent GPS samples via `calcETA`), and live/stale GPS status.
- **Alert ticker:** unresolved fatigue alerts.
- Realtime merges (no full refetch): shifts, `bus_positions` (keeps last 5 per bus for ETA), fatigue alerts, OT banner, buses.

---

## 11. Technician

`/technician` (roles: admin, management, technician). A queue of **open defects** (`repair_notes` where `is_resolved=false`), grouped by bus.

- **Log a defect** (bus, category, item, notes) manually, or they arrive automatically from inspections.
- Attach **photos** (uploaded to the `repairs` Storage bucket).
- **Mark Resolved** — and if it's the last open defect on a bus, optionally **mark the bus Ready** in the same step.

A DB trigger (`handle_repair_resolved`) supports the repair-resolution flow. "All Clear" shows when there are no open defects.

---

## 12. Fueler / Washer

`/fueler` (roles: admin, management, fueler_washer). A queue-based fuel/wash board.

- Three queues: **Needs Fuel + Wash**, **Needs Fueling**, **Needs Wash**, plus a read-only **Ready fleet** overview and today's safety meetings.
- `completeServiceAction(busId, 'fuel'|'wash', fuelLevel?)` advances a bus:
  - `fuel` + status `fuel` → `ready`; `fuel` + `fuel_wash` → `wash` (wash still owed).
  - `wash` + status `wash` → `ready`; `wash` + `fuel_wash` → `fuel` (fuel still owed).
  - Fueling also writes the new `fuel_level` (0–100).
- The **`fuel_wash`** status models a bus that needs both — complete each task to clear it.

---

## 13. Admin Console — Every Section

`/admin/*` (roles: admin, management only). Navigation (`admin-nav.tsx`) exposes **21 sections**:

| # | Section | What it does |
|---|---|---|
| 1 | **Employees** | Directory with search/filter/sort (seniority default), pagination, status counts, CSV export. Detail/edit all fields + leave balances; **invite** (magic-link) or create-with-password; deactivate/reactivate (bans/unbans auth); password reset. Role changes sync to `app_metadata.role` + `profiles`. |
| 2 | **Fleet** (buses) | Real-time Kanban of all buses; create bus (number, EV/Diesel, VIN, fuel, mileage); change status (logged in `bus_status_history`); manage tablets. Detail page has tabs (info, status history, shifts, repairs, inspections). |
| 3 | **Fleet Status** (readiness) | Availability % (color-coded), in-service & OOS counts, charging queue (EV <50%), fuel queue (diesel <25%), maintenance queue, and open defects by bus. |
| 4 | **Shift Bids** | Create bid cycles (draft → published → locked → awarded), add slots (bid #, times, days, route type, capacity), collect ranked preferences, and run the **seniority award engine**. 3 tabs: slots / submissions / awards. |
| 5 | **Overtime** | Create OT shifts, award by seniority, manage off-day requests, edit the OT banner. |
| 6 | **Forms** | Review every submission; approve / deny / return with comments; `under_review` state; resignation approval terminates the employee. (See §17.6.) |
| 7 | **Safety** (meetings) | Schedule meetings (title, department, date, required), track attendance, export. |
| 8 | **Live Map** | Google-Maps view of active buses from `latest_bus_positions`, with route polylines and per-bus popups. Requires `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. |
| 9 | **Payroll** | Pay periods + daily-hours engine (see §14). |
| 10 | **Fatigue** | Fatigue alerts (single-shift / consecutive-days / weekly-OT); resolve, add notes, export. |
| 11 | **Emergency** | Trigger / clear a fleet-wide full-screen emergency broadcast (`emergency_events`). **Admin-only.** |
| 12 | **Chat** | Link to internal chat (§15). |
| 13 | **Performance** | 90-day driver/fueler metrics from `driver_performance_snapshots`. |
| 14 | **Lost & Found** | Full lifecycle: found → collected → returned → claimed / disposed; photos; search; export. |
| 15 | **Airlines** | CRUD the LAS airline directory (name, terminal, phone, wheelchair contact) used by the 10-51 form. |
| 16 | **Notifications** | Read-only audit log of all notifications (`notification_log`) with channel/status; export. |
| 17 | **Reports** | Paginated, exportable reports across 5 tabs: Hours (from `shifts`), Overtime Awards, Form Submissions, Safety Meetings, Bid Awards. Server-side pagination; CSV export covers all rows. |
| 18 | **Sign-In Sheets** | Daily roster by date with attendance, tablet/bus assignments; export. |
| 19 | **Counting Sheets** | Review submitted passenger counts by date (per-trip rows). |
| 20 | **Inspections** | Review pre/post-trip inspections by date/type; see items, defects, damage; lock; export. |
| 21 | **Rules & Config** (settings) | Edit `break_rules` and `overtime_rules` in `app_settings` (see §17.1, §14). |

---

## 14. Payroll

`/admin/payroll` (admin, management, payroll).

- **Pay periods** (`pay_periods`): start/end + pay date; open → closed.
- **Daily hours records** (`daily_hours_records`): per employee per day — `regular_hours`, `overtime_hours`, `pto_hours`, `fmla_hours`, `total_paid_hours`, `missed_breaks`, `is_incomplete`, plus clock in/out.
- **The engine** (`lib/payroll-calc.ts`, fully unit-tested and pure):
  - **`calcDailyHours(in, out)`** — daily threshold **8.0 h**: regular = min(total, 8), overtime = max(0, total − 8). This is what EOS uses to stamp `total_hours`.
  - **`calcWeeklyOT(records)`** — weekly threshold **40 h**: any regular hours beyond the weekly budget reclassify to overtime.
  - **Paid breaks are not subtracted** from hours.
  - **`buildPayrollCSV(rows)`** — properly escaped CSV export.
  - **Fatigue helpers:** `shouldRaiseFatigueAlert(total) ⇒ total ≥ 10 h`; weekly limits `WEEKLY_DAYS_LIMIT = 5` and `WEEKLY_OT_ALERT_HOURS = 10`; ISO-week helpers (`isoWeekKey`, `daysWorkedByWeek`, `maxDaysInAnyWeek`, `weeklyOtHours`).
- Admins can correct hours within safe bounds (`DailyHoursCorrectionSchema`, 0–24 per bucket) before closing a period.

---

## 15. Internal Chat

`/chat` (roles: admin, management, dispatcher, supervisor).

- **Rooms** from `chat_room_members` → `chat_rooms`, ordered emergency → department → group → direct.
- Loads the last 50 messages per room with sender names and the confirmation/delivery/read arrays.
- **Realtime** on `chat_messages` (insert/update) plus `chat_confirmations`, `chat_deliveries`, `chat_reads`.
- **Status ladder** on your own messages: **Sent → Delivered (n) → Read (n) → Confirmed (n)**. Opening a room auto-marks others' messages delivered + read.
- **Require confirmation:** management/admin can flag a message as requiring acknowledgement; recipients get a Confirm button and an **unconfirmed badge** per room. The `chat-reminder` cron nags unconfirmed recipients (bounded — §19).
- **Emergency alert:** admins have a 🚨 button that calls `triggerEmergencyAction`.
- Admins can soft-delete messages.

---

## 16. Notifications

Two complementary surfaces, one durable pipeline:

- **In-app bell** (`components/notification-bell.tsx`, mounted in all role headers): fetches the latest 20 from the `notifications` table for the current user, subscribes to inserts in realtime, and marks all read on open. Dot colors are semantic by type (emergency=purple, overdue/denied=red, approved=green, wheelchair=orange, OT/bid=blue, safety/maintenance=amber).
- **Email** via Resend, handled by the `notification-processor` cron.

**The pipeline** (see §17.2 and §19):
```
producer → enqueueNotification(recipientId = employees.id, channels[], payload)
         → notification_queue (durable outbox: pending/retry/sent/failed)
            ├─ channel 'in_app' → trigger fn_queue_to_notifications materializes a row
            │                     in `notifications` → realtime → bell
            └─ notification-processor (cron 1m) → email via Resend + audit to notification_log
```
Channels are **email + in-app only** (the legacy "SMS"/"push" branches fall back to email).

---

## 17. Subsystems Deep-Dive

### 17.1 Break engine

- **Policy** (admin-configurable in `app_settings.break_rules`, defaults): **2 × 15-minute paid breaks**; Break 1 window opens **135 min** after start, Break 2 opens **120 min** before estimated end; **+45 min flex** window; overstay **reminder at 17 min**, **alert at 20 min**; dispatcher override allowed.
- **Generation:** `generate_breaks(shift_id)` (SECURITY DEFINER, idempotent) computes windows from `actual_start` and the rules. The **`generate_breaks_on_active` trigger** runs it automatically whenever a shift becomes `active` with an `actual_start`.
- **Enforcement:** the **`break-monitor`** Edge Function (cron, 1 min) marks pending-past-window breaks `missed` (alerts dispatch/coordinator/supervisor), sends the 17-min reminder to the driver once (`sms_reminder_sent`), and at 20 min marks the break `overrun` and alerts dispatch/management/supervisors (`overrun_alert_sent`).
- **Override:** dispatcher `reEnableBreakAction` reopens a break with a fresh window and records the override.

### 17.2 Notifications facade (`lib/notifications.ts`)

`enqueueNotification({ recipientId, eventType, channels, payload })` and `enqueueNotificationBatch([...])` insert one `notification_queue` row per channel using the admin client. **Recipient is always `employees.id`.** Producers across the app (radio/hazard, break alerts, form decisions, OT/off-day, wheelchair, fatigue, safety) all funnel through this.

### 17.3 GPS storage & read model

- Driver tablets insert into **`bus_positions`** (history; payload includes `driver_id` so the RLS `WITH CHECK` passes).
- A trigger **`fn_upsert_current_position`** keeps **`current_bus_positions`** (PK `bus_id`, one row per bus) up to date on each insert.
- The **`latest_bus_positions`** view now reads from `current_bus_positions` — **O(buses)** instead of `DISTINCT ON` over the whole history. A BRIN index keeps history scans cheap, and `cleanup_old_bus_positions()` runs **nightly via cron** (`nightly-gps-cleanup`, 3 AM) to bound retention.
- **RLS:** `current_bus_positions` is row-level-secured (staff roles + the bus's own driver may read; only admins delete; writes happen only through the SECURITY DEFINER trigger), and `latest_bus_positions` is a **`security_invoker` view** so it enforces the caller's RLS rather than the view owner's.
- **`lib/gps-utils.ts`** provides `haversineMeters`, `calcETA` (rolling-average speed → minutes), `calcNearestTerminalEta`, `getTerminalCongestion` (green/yellow/red by buses-near-terminal), and staleness helpers.
- **`lib/terminals.ts`** holds the LAS terminal coordinates (T1, T3 West, T3 East, RAC; 200 m radii) and the map center/zoom.

### 17.4 Offline queue

`lib/indexed-db.ts` exposes `queueWrite / getAllQueued / deleteQueued / countQueued` over the four `pending_*` stores. The driver shell drains them on reconnect into the real tables (§7.1). Counting-sheet and inspection saves enqueue automatically when offline.

### 17.5 Shift bidding & seniority

Cycles move draft → published → locked → awarded. Drivers submit up to 3 ranked preferences. The **award engine** sorts submitters by `seniority_number` (then hire date) and assigns each their highest-ranked still-available slot, then fills remaining slots to non-submitters by seniority. Each award records the matched preference rank. The same seniority logic backs overtime awards.

### 17.6 Forms approval workflow

`form_submissions` carries `status` (submitted / under_review / approved / denied / returned), `payload` (JSON, type-specific), `reviewer_comments`, and a `version` for resubmissions. Admin review (`reviewFormAction`) enqueues a decision notification to the employee; the driver confirms receipt (`form_acknowledgements`). Resignation approval terminates the employee and deactivates access.

### 17.7 Damage drawing (`lib/damage.ts`)

Structured vector strokes: `DamageStroke { view, color, width, opacity, points[] }` with points normalized 0..1 against a 400×200 reference, organized by 4 views. Renders crisply at any size (`strokePath` builds the SVG path), with backward-compatible parsing of legacy PNG drawings. `components/damage-board.tsx` is the editor; `damage-strokes-view.tsx` is the read-only renderer for technicians/admins.

### 17.8 Fatigue

`fatigue_alerts` carries types `single_shift` (≥10 h), `consecutive_days` (>5 days/week), and `ot_threshold` (weekly OT). A DB trigger (`fn_fatigue_alert_notify`, with a dedup index) notifies on new alerts. Admins resolve/dismiss them; the board shows unresolved ones.

---

## 18. Database Reference

The schema was built across **12 migration phases** (phase 12 = audit-remediation security hardening). Tables grouped by concern (current, v2 model — legacy v1 tables were dropped in phase 11):

- **Auth & people:** `profiles` (auth↔role mirror), `employees` (the roster — single `name` column, `employee_id`, `email`, `role`, `status`, `seniority_number`, `pto_balance`/`vacation_balance`/`fmla_balance`, `auth_user_id`), `app_settings` (singleton `id='singleton'`: `break_rules`, `overtime_rules`, `notification_preferences`), `session_overrides` (e.g. `motion_lock_exempt`), `login_attempts` (durable brute-force counter).
- **Fleet:** `buses` (number, VIN, EV/Diesel, `fuel_level`, mileage, `status`), `bus_status_history`, `tablets`.
- **Shifts & breaks:** `shifts` (employee, bus, tablet, scheduled/actual start-end, `status`, `radio_status`, `total_hours`, signature, lunch fields, compliance verdict, notes), `breaks` (per-shift, `break_number` 1|2, window_open/close, actual_start/end, `duration_minutes`, status, `sms_reminder_sent`, `overrun_alert_sent`, `dispatcher_override_*`).
- **Inspections & repairs:** `vehicle_inspections` (type, mileage, `has_defects`, `damage_drawing`, locked), `inspection_items`, `repair_notes`.
- **Counting:** `counting_sheets`, `counting_rows` (per-trip terminal counts).
- **Bids & overtime:** `shift_bid_cycles`, `shift_bid_slots`, `shift_bid_submissions`, `shift_bid_awards`; `overtime_shifts`, `overtime_bids`, `overtime_awards`, `off_day_requests`, `ot_banner` (singleton).
- **Forms & safety:** `form_submissions`, `form_acknowledgements`; `safety_meetings`, `safety_meeting_signins`; `safety_meeting_schedules` (backs the public share page).
- **GPS:** `bus_positions` (history), `current_bus_positions` (latest per bus), view `latest_bus_positions`, `terminal_coordinates` (ops-role-scoped reference).
- **Payroll & fatigue & performance:** `pay_periods`, `daily_hours_records`, `fatigue_alerts`, `driver_performance_snapshots`.
- **Comms:** `chat_rooms`, `chat_room_members`, `chat_messages`, `chat_confirmations`, `chat_deliveries`, `chat_reads`; `notification_queue` (outbox), `notifications` (in-app bell), `notification_log` (audit); `emergency_events`.
- **Service ops:** `wheelchair_requests`, `lost_items`, `airlines`.

**Key functions / RPCs:** `handle_updated_at` (generic timestamp trigger fn), `get_my_role` / `get_my_employee_id` / `has_role(roles[])` (RLS helpers), `generate_breaks(shift_id)`, `log_bus_status_change`, `handle_repair_resolved`, `fn_upsert_current_position`, `fn_queue_to_notifications` (in-app convergence), `fn_fatigue_alert_notify`, `log_lost_item_status_change`, `cleanup_old_bus_positions`, and the durable login limiter `register_login_attempt` / `clear_login_attempts`. (The dead `custom_access_token_hook` JWT hook was dropped in phase 10.)

**Phase-12 RLS hardening:** `current_bus_positions` got RLS (driver GPS was previously readable with the anon key); `safety_meeting_schedules` write policies were role-gated (admin/management) and the leftover open `USING(true)` read policy dropped (public reads remain limited to `is_active=true` via the share page); `terminal_coordinates` reads scoped to ops roles.

**Notable triggers:** `generate_breaks_on_active` (shifts), `queue_to_notifications` (notification_queue), `upsert_current_position` (bus_positions), `fatigue_alert_notify` (fatigue_alerts), `trg_bus_status_change`, `trg_repair_resolved`, plus `set_*_updated_at` timestamp triggers everywhere.

**RLS model:** every table is RLS-protected; policies use the `app_metadata.role` claim via `has_role(...)`. Reads use an RLS-bound client; privileged writes use the service-role admin client behind `requireRole`.

**Realtime publication:** shifts, breaks, buses, bus_positions, wheelchair_requests, fatigue_alerts, ot_banner, notifications, and the chat tables (messages/confirmations/deliveries/reads) are published for live UI.

---

## 19. Async / Scheduling Layer

The "spine" that runs without a user. `pg_cron` + `pg_net` POST to Edge Functions (all registered in `config.toml` with `verify_jwt=true`, callable only with the service-role bearer; the key lives in Supabase Vault — see `supabase/CRON_SETUP.md`).

| Cron job | Schedule | Edge Function | What it does |
|---|---|---|---|
| `notification-processor` | every 1 min | `notification-processor` | Drains up to 50 pending/retry `notification_queue` rows; sends email via Resend; writes `notification_log`; retries up to 2× then marks `failed`. (In-app delivery is handled by the convergence trigger, not here.) |
| `break-monitor` | every 1 min | `break-monitor` | Marks missed/overrun breaks; fires 17-min driver reminders and 20-min overstay alerts; enqueues notifications. |
| `wheelchair-escalation` | every 1 min | `wheelchair-escalation` | Escalates `pending` wheelchair requests with no response > 5 min; notifies the driver ("call dispatch directly") and management. |
| `chat-reminder` | every 5 min | `chat-reminder` | Nags recipients of unconfirmed required messages — **bounded**: only messages 30 min–24 h old, ≥55 min between reminders, max 3 per recipient per message. |
| `nightly-gps-cleanup` | daily 3 AM | *(SQL, no function)* | Runs `cleanup_old_bus_positions()` directly to bound GPS history retention. |
| (boilerplate) | — | `health-check` | Public health endpoint (`verify_jwt=false`). |

---

## 20. Theming & Design System

- **Source:** `app/globals.css` defines an **OKLCH semantic token system** for **light + dark**, wired into Tailwind 4's `@theme`. `components/theme-provider.tsx` (next-themes) drives it; `components/theme-toggle.tsx` is the ☀/🌙 toggle, mounted in every role header.
- **Brand:** **Rolecall blue** (`--primary` ≈ `oklch(0.546 0.215 262.9)`), not the old red.
- **Operational ramps** (each with base / surface / border, light + dark): **ok** (green = ready), **warn** (amber = break/fuel/wash), **danger** (red = OOS/missed), **hazard** (**purple**), **info** (blue = in-service), **neutral** (gray = salvage).
- **Bus statuses** map to these via `lib/constants/bus-status.ts` (see §23). UI uses tokens (`bg-card`, `text-muted-foreground`, `border-border`, etc.) so light mode works; the driver motion-lock intentionally stays black.

---

## 21. Security Model

- **Non-spoofable role:** `app_metadata.role` is set server-side and is the single source of truth for authorization. The old duplicate JWT role hook was removed.
- **RBAC (`lib/auth/rbac.ts`):** `requireUser()` (401 if signed out) and `requireRole(...roles)` (403 if wrong role) return a discriminated `AuthResult`. **Every action using the admin client must call `requireRole` first.**
- **Validation (Zod, `lib/schemas/*`):** `.strict()` allow-list schemas for employee, bus, payroll corrections, settings (break/overtime rule bounds), and dispatcher overtime/off-day FormData (`overtime.ts`) prevent mass-assignment, NaN, and out-of-range config. Driver form submissions validate the form-type enum + payload size.
- **Uniform results (`lib/actions/result.ts`):** `ActionResult<T>` = `{ success:true, data }` or `{ success:false, error, fieldErrors? }`, built with `ok` / `fail` / `failValidation` (maps Zod issues to field errors).
- **Build-time authz gate (`scripts/check-admin-guards.mjs`):** a static check (wired into `npm run build` and `npm run check:guards`) that **fails the build** if any `'use server'` function calls the RLS-bypassing admin client (`createSupabaseAdmin`) without an authorization signal (`require*/assert*/ensure*` guard, an inline `app_metadata` role check, or a justified allowlist entry). Prevents the "admin client without authz" bug class from recurring.
- **HTTP security headers (`next.config.mjs`):** applied to every route — `frame-ancestors 'none'` + `X-Frame-Options: DENY` (clickjacking), HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a `Permissions-Policy` that keeps `geolocation=(self)` on (driver GPS) while disabling camera/microphone. (A full script/style CSP is staged for a later report-only pass.)
- **Other guards:** durable login rate-limiting, terminated-employee block, `verify_jwt` on cron functions, service-role key kept in Vault/server-only env, RLS on every table, and `next.config.mjs` keeps `ignoreBuildErrors:false` so schema/type drift fails the build.

---

## 22. Developer Guide

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Anon key (RLS-bound) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Admin client + Edge Functions (never expose) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | client | Live map / board ETA |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Edge Function secrets | Email notifications |

`.env.local.example` covers the two public vars; the rest live in Vercel env + Supabase function secrets.

### NPM scripts

```
npm run dev          # next dev
npm run build        # check-admin-guards + next build (strict — type errors fail)
npm run check:guards # static admin-client authz gate (scripts/check-admin-guards.mjs)
npm run start        # next start
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest watch

# Supabase (wrappers around the CLI)
npm run supabase:start | stop | status | login | link
npm run supabase:db:push | db:pull | db:reset | db:new
npm run supabase:types        # regenerate lib/database.types.ts
npm run supabase:fn:serve | fn:deploy | fn:list
```

### Local setup (quick start)

1. `npm install`
2. Create `.env.local` with the Supabase vars (and Maps/Resend if testing those).
3. `npm run supabase:start` (local stack) or link a hosted project (`supabase:link`).
4. Apply migrations: `npm run supabase:db:push` (or `db:reset` to also run `seed.sql`).
5. `npm run dev` → open the app; sign in (seed creates kiosk drivers `1234`/`1001`).
6. Before committing: `npm run typecheck && npm test`.

### Deploying changes

- **App:** push to `main` → Vercel auto-deploys.
- **Migrations:** apply in filename order with `supabase:db:push`. ⚠ Phase-10 JWT-hook drop requires disabling the Auth "Custom Access Token" hook first; phase-11 legacy-table drop is an irreversible CASCADE.
- **Edge Functions:** `npm run supabase:fn:deploy`.
- **Cron:** ensure the 4 jobs exist (see `supabase/CRON_SETUP.md`); `supabase/RECOVERY.md` documents recovery.

### Tests (`tests/`)

- `payroll-calc.test.ts` — daily/weekly OT boundaries (exactly 8 h / 40 h), midnight crossing, CSV escaping, fatigue at 10 h.
- `gps-utils.test.ts` — haversine, ETA null/positive cases, congestion thresholds, staleness.
- `n-tasks.test.ts` — ISO-week helpers, nearest-terminal ETA, damage stroke parsing/SVG.
- `overtime-schema.test.ts` — dispatcher OT/off-day FormData validation (bad types, bounds).

---

## 23. Glossary & Reference Tables

### Radio codes (`lib/constants/radio-codes.ts`)

| Code | Meaning |
|---|---|
| 10-8 | In Service |
| 10-39 | On Break |
| 10-37 | Fueling / Wash |
| 10-7 | Out of Service |
| 10-51 | Assist Needed (wheelchair) |
| 10-33 | HAZARD |

### Bus statuses (`lib/constants/bus-status.ts`)

`ready` · `in_service` · `charging` · `fuel` · `wash` · `fuel_wash` · `maintenance_pmi` · `shopped_dvir` · `maintenance_repair` · `safety_hold` · `salvage` · `training`.

- **Available:** `ready`
- **Shop:** `shopped_dvir`, `maintenance_repair`, `maintenance_pmi`
- **Out of service:** the shop set + `safety_hold`, `salvage`
- Colors follow the operational ramps (green/blue/teal/amber/cyan/red/**purple**=safety_hold/gray=salvage/indigo=training).

### Terminals (LAS, `lib/terminals.ts`)

Terminal 1 (T1), Terminal 3 West (T3W), Terminal 3 East (T3E), Rental Car Center (RAC) — each with lat/lng and a 200 m radius.

### Leave types (Time-Off form)

Vacation · PTO · Jury Duty · Bereavement · Birthday.

### Key terms

- **EOS** — End of Shift (the submission that closes a shift).
- **DVIR** — Driver Vehicle Inspection Report (pre/post-trip).
- **10-51** — wheelchair-assist request.
- **Compliance verdict** — coordinator's OK/Flag review of a completed shift.
- **Motion lock** — the GPS-speed screen lock on driver tablets.
- **Outbox** — the durable `notification_queue` processed by cron.

---

## 24. Operational Status & Owner To-Dos

All application code is complete and `typecheck` + tests are green. Going fully live still depends on a few owner-provided items:

- **Secrets/keys:** `RESEND_API_KEY` (+ verified sending domain), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, production SMTP for Auth invites/resets.
- **Deploy steps:** apply the staged migrations in order (⚠ disable the Auth custom-access-token hook before the phase-10 drop; ⚠ confirm no v1 data before the phase-11 CASCADE drop; phase-12 adds the durable login limiter + RLS/authz hardening), deploy/refresh the Edge Functions, and verify the cron jobs (the 4 edge-function jobs + the nightly GPS-cleanup SQL job).
- **Data:** real employee roster (with seniority numbers), fleet + tablet inventory, and verified airline/terminal data.

For the full audit history and rebuild rationale, see the authoritative plan referenced in the project notes.

---

*This guide reflects the codebase as built. When in doubt, the code in `app/`, `lib/`, and `supabase/` is the source of truth — file paths are cited throughout so you can jump straight to the implementation.*
