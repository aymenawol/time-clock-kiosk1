# RoleCall: information architecture and design system

RoleCall runs the day for an airline ground-transportation or ground-handling
operation. People clock in at a shared kiosk, drivers work from their phones, and
dispatch, supervisors and admins work from desktops and tablets. One deployment
serves many companies (organizations). Every screen is scoped to the active
organization.

## 1. What comparable products teach us

| Product | Pattern we take |
|---|---|
| Deputy, Homebase, When I Work | A **kiosk** is a dedicated, paired device that shows only the clock-in flow: a big clock, "enter your PIN", then one screen of large buttons for the next valid action (start break, end break, clock out). It returns to idle by itself. Management screens are grouped as **Schedule, Timesheets, People, Reports**. |
| UKG | Separates "my stuff" (requests, balances, schedule) from "manage" views, and makes **timecard exceptions** (missed punches, missed breaks) the manager's main queue. |
| TripSpark, RouteMatch, Samsara | The dispatch board is **one dense screen**: a live list of vehicles and drivers with status chips, a map pane, and an alert rail (late, off-route, assist requests). Statuses are colour-coded and consistent everywhere. |
| Samsara driver app | The phone home is a **duty-status card** (on shift, on break, vehicle) with the DVIR (inspection) as the first action, and few, large buttons. |
| Fleetio | **Inspections create issues, issues become work orders**, and a vehicle's page shows status, inspections, issues and history on one timeline. Readiness is a fleet-level summary. |

## 2. Personas and devices

| Persona | Roles | Device | Home |
|---|---|---|---|
| Anyone clocking in | every employee | shared tablet kiosk | `/kiosk` (paired device, no login) |
| Driver | driver | phone | `/m`: shift card |
| Fueler | fueler | phone or tablet | `/m`: fuel and wash queue |
| Technician | technician | tablet or desktop | `/m`: defect queue |
| Dispatcher | dispatcher | desktop, wall TV | `/board` |
| Coordinator | coordinator | desktop or tablet | `/compliance` |
| Supervisor | supervisor | desktop or tablet | `/dashboard` |
| Admin | admin | desktop | `/dashboard` |

v0's `management` role is folded into **admin**. v0's `payroll` role is too:
payroll is an admin capability. `fueler_washer` becomes **fueler**.

## 3. Information architecture

### 3.1 Public and device surfaces

| Route | Purpose |
|---|---|
| `/login` | Email and password. Rate-limited by Supabase Auth. |
| `/auth/callback`, `/auth/set-password` | Invite and recovery links, then set a password |
| `/kiosk` | Full-screen PIN clock. Shows a pairing screen when the device isn't paired yet. |
| `/s/[token]` | Public safety-meeting schedule for one organization. The token is checked server-side. |

### 3.2 Field app: `/m/*` (phone-first, bottom tab bar)

Tabs adapt to the role:

| Tab | Driver | Fueler | Technician |
|---|---|---|---|
| Home | Shift card: clock state, vehicle, radio-code buttons, break timer, today's checklist (pre-trip, counts, post-trip, end of shift) | Fuel and wash queue | Defect queue |
| Requests | Forms, bids, overtime, time off | Forms, overtime | Forms, overtime |
| Chat | Rooms they belong to | same | same |
| Me | Balances, seniority, performance, safety meetings, lost and found report, notifications, theme, sign out | same | same |

Driver task pages:

- `/m/inspection/[pre|post]`: checklist and damage diagram
- `/m/counts`: passenger counting sheet
- `/m/assist`: wheelchair or special-assist request
- `/m/end-shift`: end-of-shift vehicle report
- `/m/lost-found`: report a found item
- `/m/forms`, `/m/forms/new/[type]`
- `/m/bids`
- `/m/overtime`
- `/m/safety`
- `/m/me`

Fuelers and technicians also get `/m/fuel` and `/m/defects`.

GPS is reported from the driver's phone while they are on shift with a vehicle
assigned. Tracking lives in the field shell, so it doesn't stop when the driver
changes page.

### 3.3 Office app (desktop-first, grouped sidebar; becomes a drawer below `lg`)

| Group | Item | Route | Roles |
|---|---|---|---|
| Overview | Dashboard | `/dashboard` | admin, supervisor |
| Operations | Dispatch board | `/board` | admin, supervisor, dispatcher, coordinator (read-only) |
| | Live map | `/map` | admin, supervisor, dispatcher |
| | Sign-in sheet | `/sign-in-sheet` | admin, supervisor, dispatcher, coordinator |
| | Assist requests | `/assists` | admin, supervisor, dispatcher |
| | Breaks and compliance | `/compliance` | admin, supervisor, dispatcher, coordinator |
| | Emergency | `/emergency` | everyone can view; admin and supervisor trigger |
| | Chat | `/chat` | all office roles |
| Fleet | Vehicles | `/fleet`, `/fleet/[id]` | admin, supervisor, dispatcher (status only) |
| | Readiness | `/fleet/readiness` | admin, supervisor, dispatcher |
| | Inspections | `/fleet/inspections` | admin, supervisor, dispatcher |
| | Defects | `/fleet/defects` | admin, supervisor, dispatcher (read) |
| | Fuel log | `/fleet/fuel` | admin, supervisor |
| People | Employees | `/people`, `/people/[id]` | admin (edit), supervisor (read) |
| | Timesheets | `/timesheets` | admin, supervisor |
| | Forms | `/forms`, `/forms/[id]` | admin, supervisor |
| | Safety meetings | `/safety` | admin, supervisor, coordinator (attendance) |
| | Performance | `/performance` | admin, supervisor |
| | Fatigue | `/fatigue` | admin, supervisor, dispatcher |
| Scheduling | Shift bids | `/bids`, `/bids/[id]` | admin |
| | Overtime | `/overtime` | admin, supervisor, dispatcher |
| Pay | Payroll | `/payroll`, `/payroll/[id]` | admin |
| Records | Counting sheets | `/counts` | admin, supervisor, dispatcher, coordinator |
| | Lost and found | `/lost-found` | admin, supervisor, dispatcher, coordinator |
| | Reports | `/reports` | admin, supervisor |
| | Notifications log | `/notifications` | admin |
| Settings | Organization, labour rules, breaks and fatigue, kiosks, locations, airlines, routes, radio codes, inspection checklist, counting columns | `/settings/*` | admin |

Office staff also have personal items (forms, balances, safety sign-in), so the
user menu has a **"My requests"** link to `/m/me`.

**One permission matrix** (`lib/auth/permissions.ts`) drives the sidebar, page
guards, server-action guards and e2e expectations. RLS enforces the same matrix
in the database.

### 3.4 Role homes

- **Dashboard** (admin, supervisor): who is on the clock now, fleet readiness,
  open alerts (missed breaks, fatigue, assists, defects), forms waiting for
  review, current pay period.
- **Dispatch board** (dispatcher): a dense table of active shifts showing driver,
  vehicle, radio status, break state, last GPS, ETA to nearest location and
  fatigue flags. On the right is an alert rail: assist requests (with SLA timers),
  missed or overrunning breaks and fatigue alerts. The overtime banner runs across
  the top. **Wall mode** hides all chrome.
- **Compliance** (coordinator): today's shifts, each with its breaks against the
  Nevada plan, plus a verdict (ok or flag) and notes.
- **Kiosk**: idle screen with org name, large clock and date, and "Enter your
  employee number". Then a keypad for the PIN. Then a confirmation card with the
  name, current state and the valid actions only. It resets after 8 seconds.
  Errors are generic ("Employee number or PIN is incorrect"). Lockouts show a
  wait time.

## 4. Design system

The look is new. It has a calm, high-contrast operations console for office
screens, and big, high-legibility targets for field and kiosk.

### 4.1 Tokens

Defined once as CSS variables in `app/globals.css` and exposed to Tailwind v4
through `@theme inline`. Components never use raw hex values.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F6F7F9` | `#0B0F14` | app background |
| `--surface` | `#FFFFFF` | `#121821` | cards, panels |
| `--surface-2` | `#EEF1F5` | `#18202B` | subtle fills, table headers |
| `--border` | `#DCE1E8` | `#253041` | hairlines |
| `--text` | `#0E1726` | `#E7ECF3` | body |
| `--text-muted` | `#5B6676` | `#93A0B2` | secondary |
| `--primary` | `#1F4FD8` | `#5B8CFF` | primary actions, links, focus |
| `--primary-fg` | `#FFFFFF` | `#0B0F14` | text on primary |
| `--accent` | `#F5A524` | `#F7B547` | brand mark, kiosk highlights (safety-vest amber) |
| `--success` | `#13804B` | `#3DD68C` | ok, ready, on time |
| `--warning` | `#B26A00` | `#F5B649` | due soon, low fuel |
| `--danger` | `#C62828` | `#FF6B6B` | missed, out of service, emergency |
| `--info` | `#0B6BCB` | `#5CB8FF` | informational |
| `--ring` | `--primary` at 45% | same | focus ring |

Each status colour has a `-soft` background (about 12% tint) for pills and
banners. Text contrast is AA or better in both themes.

**Vehicle status palette** (used everywhere a vehicle appears):

| Colour | Statuses |
|---|---|
| ready | success |
| in service | primary |
| charging, fueling, washing | info |
| PMI or repair | warning |
| shop (DVIR) or safety hold | danger |
| training | accent |
| retired | muted |

### 4.2 Type

- **Geist** for UI and **Geist Mono** for clocks, IDs and numbers, through
  `next/font`. Times and hours use `tabular-nums`.
- Scale (rem): 0.75 caption, 0.875 body-sm (office tables), 1 body,
  1.125 lead, 1.25 h3, 1.5 h2, 1.875 h1, 3 to 6 kiosk clock.
- Weights: 400 body, 500 labels and table headers, 600 headings and buttons.

### 4.3 Spacing, radius, elevation

- 4 px grid. Office density uses 8 and 12 px inside controls. Field and kiosk use
  16 and 24 px.
- Radius: 6 px controls, 10 px cards, 16 px kiosk tiles, full for pills.
- Elevation comes from borders, not shadows. A single soft shadow is reserved for
  popovers and dialogs.
- Hit targets: at least 40 px office, 48 px field, 72 px kiosk keys.

### 4.4 Components (`components/ui`)

Built on Radix primitives and lucide icons, styled only with tokens:

- **Form controls:** Button (primary, secondary, ghost, danger; sizes sm, md, lg,
  xl), Input, Textarea, Select (native, for mobile), Checkbox, Switch, Field
  (label, hint, error).
- **Display:** Card, Badge and StatusPill, Table (sticky header, zebra off, row
  hover), EmptyState, Skeleton, Avatar (initials), Stat tile.
- **Overlays:** Dialog, Sheet (side drawer), DropdownMenu, Tabs, Tooltip, Toast
  (sonner), ConfirmButton (two-step for destructive actions).
- **Domain:** Keypad (kiosk and PIN), ClockFace, VehicleStatusPill,
  BreakTimeline, ShiftCard, MapView (Google Maps), DamageDiagram (vector strokes
  on 4 vehicle views).

### 4.5 Layout rules

- **Office:**
  - Sidebar 248 px (collapsible to 64 px icons), top bar 56 px, content max-width
    1440 px with 24 px gutters.
  - Tables scroll horizontally inside their card on small screens. The page never
    scrolls sideways.
- **Field:**
  - Single column with a 16 px gutter and a bottom tab bar of 64 px plus the safe
    area.
  - The main action is a full-width button at the bottom of the viewport.
- **Kiosk:**
  - Landscape and portrait tablets, centred column up to 560 px with the clock
    above.
  - No navigation, no hover-only affordances.
  - The screen dims after 2 minutes idle.
- All views work from 360 px to 1920 px.

### 4.6 Themes

Light and dark themes come from the tokens above, chosen through `next-themes`
(class strategy). The default is "system". The kiosk defaults to dark (less glare
in terminals at night) and can be overridden in the kiosk settings.

### 4.7 Content style

Sentence case. Plain verbs on buttons ("Clock in", "Start break", "Report
defect"). Times are in the organization's time zone with 24-hour format optional
per organization. Errors say what happened and what to do next.

## 5. Technical decisions that shape the UI

- Next.js 16.4 App Router. Server Components read through a **user-scoped
  Supabase client**, so RLS always applies. Mutations are **server actions** with
  zod validation and a role guard. The service-role client is used only where
  there is no user session (kiosk punches, cron) or for Auth admin operations.
- `cacheComponents` is **off**. Every screen is per-user and per-organization, so
  static shells buy little and Suspense-everywhere would slow the build-out.
  Revisit when Next makes it mandatory.
- `proxy.ts` (the Next 16 name for middleware) only refreshes the Supabase
  session and redirects anonymous users to `/login`. Authorization happens in
  layouts, pages and actions against the database, never the JWT alone.
- Live screens (board, map, assists, chat, emergency, notifications) subscribe
  to Supabase Realtime filtered by `organization_id`. RLS applies to Realtime too.
