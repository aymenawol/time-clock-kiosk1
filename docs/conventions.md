# RoleCall code conventions

Read `docs/design.md` (IA and design system) and `docs/audit.md` (what v0 did)
first. These rules keep every feature consistent and secure.

## Data access

- **Pages are Server Components.** Start every page with
  `const auth = await requireAuth("<capability>")` from `@/lib/auth/session`.
  The capability comes from `lib/auth/permissions.ts`. That one matrix drives
  the sidebar, guards and tests.
- Query with `auth.supabase`. It is user-scoped, so RLS always applies. **Always
  filter by `.eq("organization_id", auth.org.id)`**, because a user can belong
  to more than one organization.
- Never import `@/lib/supabase/admin` (service role) in feature code. The only
  exceptions are the kiosk, Auth admin operations (creating logins, resetting
  passwords) and cron. Each of those authorizes the caller first.
- Types: `Tables<"x">`, `Enums<"y">` from `@/lib/supabase/types`. Never use
  `any`.

## Mutations

- Put server actions in a `"use server"` `actions.ts` next to the route. Define
  each one with the `action()` helper:

  ```ts
  "use server";
  import { z } from "zod";
  import { action, ActionError, audit, check, zId } from "@/lib/actions";

  export const retireVehicle = action(
    { schema: z.object({ id: zId, reason: z.string().trim().min(3).max(500) }), capability: "fleetEdit" },
    async ({ id, reason }, ctx) => {
      check(await ctx.supabase.from("vehicles").update({ status: "retired", active: false })
        .eq("id", id).eq("organization_id", ctx.org.id));
      await audit(ctx, "vehicle.retire", "vehicles", id, { reason });
    },
  );
  ```

- Every input is validated with zod, and every action has a capability.
  - Throw `ActionError("message")` for errors the user should see.
  - Database errors raised by our SQL functions with code `P0001` are already
    phrased for users.
- Call `audit()` for admin and supervisor changes to people, pay, settings and
  fleet.
- **State changes with side effects go through the RPCs in the migrations**:
  - Field actions: `set_radio_status`, `start_break`, `end_break`,
    `submit_inspection`, `submit_end_of_shift`, `submit_count_sheet`,
    `safety_sign_in`, `submit_bid_preferences`, `record_position`.
  - Office actions: `reopen_break`, `award_ot_offer`, `apply_bid_awards`,
    `review_form`, `lock_pay_period`, `unlock_pay_period`, `set_employee_pin`.
- In client components, call actions with
  `const [run, pending] = useAction(fn, { success: "Saved" })` from
  `@/components/ui/use-action`. It toasts errors and refreshes server data.

## Live data

Put `<LiveRefresh organizationId={auth.org.id} tables={["shifts","breaks"]} />`
(from `@/components/realtime/use-live-refresh`) in a page that must update
live. The server page stays the source of truth. The tables published to
Realtime are: shifts, breaks, vehicles, vehicle_latest_positions,
assist_requests, emergencies, emergency_acks, announcements, chat_messages,
chat_receipts, notifications, fatigue_alerts, defects.

## Time

- Show every time in the organization's time zone with `@/lib/format`:
  `fmtTime(d, auth.org.timezone, auth.settings.clock24h)`, `fmtDate`,
  `fmtDateTime`, `fmtMinutes`. Get "today" with `todayIn(auth.org.timezone)`.
  Never use `toISOString().slice(0, 10)` for a local date.
- `shifts.work_date` is the local date of clock-in.
- Labour math (overtime, breaks, fatigue, pay) lives only in `lib/labor/*`.

## UI

- Use `components/ui/*`: Button, Input, Select, Textarea, Checkbox, Field,
  Card, CardHeader, CardBody, Badge, Table, Dialog, Menu, Tabs, PageHeader,
  EmptyState, Stat, Avatar, Skeleton. For status pills use
  `components/domain/status.tsx`.
- Colours come only from tokens (`bg-surface`, `text-muted`, `text-danger`,
  `bg-primary-soft`, and so on). No raw hex values.
- Light and dark must both work.
- **Office pages:** `PageHeader`, then cards and tables. Tables scroll inside
  their card. Lay pages out mobile first so they work from 360 px wide.
- **Field pages (`/m/*`):** a single column (the shell is `max-w-xl`), touch
  targets at least 48 px (`size="lg"` or `"xl"`), and the main action as a
  full-width button.
- Copy is sentence case with plain verbs. Errors say what to do next.
- Accessibility: label every input (`Field`), give icon buttons an
  `aria-label`, use `role="alert"` for errors.

## Files

- Route-specific components go next to the route (e.g.
  `app/(office)/fleet/_components/...`) or in `components/<area>/`.
- Don't change shared foundations (`lib/*`, `components/ui/*`,
  `components/shell/*`, `supabase/migrations/*`, `proxy.ts`) without
  coordinating. If you need a schema change, write the SQL in your report
  instead of creating a migration.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and
`npm run test:e2e` must all pass before pushing.
