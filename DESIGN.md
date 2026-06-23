# Rolecall — Design System & UI Conventions

This is the single source of truth for how Rolecall's UI looks and behaves. It
exists so every screen — built by anyone — is consistent, responsive, and works
in **light mode (the default)** and dark mode.

---

## 0. The brief (refined)

> Rolecall serves two audiences on two device profiles: **field staff** (drivers,
> fuelers) on in-vehicle tablets/phones, and **office staff** (dispatch,
> coordinators, admin, payroll) on desktop consoles + a wall-mounted board. The UI
> must be **light by default**, fully **responsive (phone → tablet → desktop)**,
> and organized by what each role actually does day-to-day — frequent actions
> front-and-center, rare ones tucked away. Everything clickable shows a pointer
> cursor. Aesthetic: clean, modern, "airy" for office screens; dense and glanceable
> for live operational screens (board, dispatcher). Brand color is **Rolecall blue**.

## 1. Principles

1. **Tokens, never hardcoded colors.** No `bg-gray-900`, `text-white`,
   `#2563EB`, `bg-red-950`. Use the semantic tokens below so light/dark both work.
2. **Mobile-first & responsive.** Design for a phone, scale up with `sm:`/`md:`/
   `lg:`. Never assume desktop width. No fixed pixel widths that overflow small
   screens.
3. **The shell owns chrome.** Page/`*-client` components render **content only**.
   Do **not** add `min-h-screen`, page `bg-background`, top-level `max-w-*`
   centering, or navigation — the role layout/shell already provides them.
4. **Reuse primitives** from `components/ui/*`. Don't re-roll buttons/cards/inputs.
5. **Never change logic.** Presentation only: `className`, element structure,
   icon swaps, `<a>`→`<Link>`. Do not touch data fetching, server actions, state,
   handlers, props, or exported signatures.

## 2. Color tokens (Tailwind 4, defined in `app/globals.css`)

Surfaces & text:
- `bg-background` — app canvas (faint gray in light). **Only the shell uses this.**
- `bg-card` / `text-card-foreground` — elevated surfaces (white in light)
- `bg-popover` — menus/popovers
- `text-foreground` — primary text
- `text-muted-foreground` — secondary text, labels, captions, timestamps
- `bg-muted` / `bg-secondary` / `bg-accent` — subtle fills, chips, hover states
- `border-border` / `border-input` — all borders
- `ring-ring` — focus ring (branded blue)

Brand:
- `bg-primary` / `text-primary-foreground` — primary actions, brand
- `text-primary` — brand-colored text/links/active nav

Operational semantic ramps — each has **solid** (`X`), **surface** (`X-surface`,
a tinted background), and **border** (`X-border`):

| Ramp | Meaning | Classes |
|---|---|---|
| `ok` | ready / in-service / success / approved | `text-ok bg-ok-surface border-ok-border` |
| `warn` | break / fuel / wash / pending / caution | `text-warn bg-warn-surface border-warn-border` |
| `danger` | OOS / missed / denied / error / overdue | `text-danger bg-danger-surface border-danger-border` |
| `hazard` | hazard / emergency (**purple**) | `text-hazard bg-hazard-surface border-hazard-border` |
| `info` | informational / EV / in-service blue | `text-info bg-info-surface border-info-border` |
| `neutral` | salvage / inactive / generic | `text-neutral bg-neutral-surface border-neutral-border` |

`destructive` / `destructive-foreground` exist for destructive buttons.

## 3. Color replacement map (apply mechanically)

| Hardcoded | Replace with |
|---|---|
| `bg-white`, `bg-gray-50/100`, `bg-zinc-900`, `bg-gray-900` (as a card) | `bg-card` |
| page wrapper `bg-gray-950`/`bg-black` | remove (shell owns it) |
| `text-white` (on a card/page) | `text-foreground` |
| `text-white` (on a solid colored button/badge) | keep `text-white` (it's on a saturated fill) |
| `text-black` | `text-foreground` |
| `text-gray-400/500/600`, `text-zinc-400` | `text-muted-foreground` |
| `text-gray-300/200` | `text-foreground` (or `text-muted-foreground` if secondary) |
| `border-gray-700/800`, `border-zinc-800` | `border-border` |
| `bg-gray-800/700` (chip/hover) | `bg-muted` / `hover:bg-accent` |
| `#2563EB` / `bg-blue-600` (brand) | `bg-primary` / `text-primary` |
| green (`bg-green-*`, `text-green-*`) | the `ok` ramp |
| amber/yellow (`*-yellow-*`, `*-amber-*`, `*-orange-*`) | the `warn` ramp |
| red (`*-red-*`) | the `danger` ramp |
| purple/violet (`*-purple-*`, `*-violet-*`) | the `hazard` ramp |
| blue (`*-blue-*`, `*-sky-*`, info usage) | the `info` ramp (or `primary` for brand actions) |
| teal/emerald (EV, etc.) | `info` (or `ok` if it means "ready") |

For a colored "tag/pill/status" block, prefer the **`<Badge variant>`** primitive
over hand-rolling surface+border+text classes.

## 4. Semantic status → variant

- **Bus status** (`lib/constants/bus-status.ts`): ready→`ok`, in_service→`info`,
  fuel/wash/fuel_wash→`warn`, shopped_dvir/OOS→`danger`, hazard→`hazard`,
  salvage→`neutral`.
- **Radio codes:** 10-8→`ok`, 10-39→`warn`, 10-37→`info`, 10-7→`danger`,
  10-33 hazard→`hazard`.
- **Break status:** completed→`ok`, active→`info`, pending→`neutral/warn`,
  missed/overrun→`danger`.
- **Form status:** approved→`ok`, submitted/under_review→`info`, returned→`warn`,
  denied→`danger`.
- **Fatigue / emergency:** `danger` / `hazard`.

## 5. Primitives (`components/ui/*`)

- `Button` — variants: `default` (brand), `secondary`, `outline`, `ghost`,
  `destructive`, `success`, `link`; sizes: `sm`, `default`, `lg`, `xl` (big touch
  targets for field/kiosk), `icon`, `icon-sm`. Replace raw `<button class="bg-blue-600…">`.
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter` — replace hand-rolled `bg-card border rounded-xl p-*` blocks.
- `Badge` — variants per §2 ramps + `default/secondary/outline`.
- `Input`, `Textarea`, `Label` — replace raw inputs; they include focus rings.
- `Separator`, `Skeleton`, `Spinner`.
- `Sheet` (drawer, Radix dialog), `Command`/`CommandDialog` (cmdk) — for overlays.

Icons: **lucide-react**, not emoji, for navigation/actions/status. Emoji is OK
only where it's deliberate content (e.g. an alert glyph inside a message).

## 6. Responsiveness rules

- Multi-column layouts: start single-column, add columns at breakpoints —
  `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
- **Tables / wide content:** wrap in `<div className="overflow-x-auto">…</div>`
  (or `-mx-4 px-4` on mobile) so they scroll instead of breaking the page.
  Consider a card list on `sm` and a table on `md+` for dense data.
- Never use fixed widths wider than the viewport; use `w-full max-w-*`, `min-w-0`,
  `flex-wrap`, and `truncate` to prevent overflow.
- Filter/toolbar rows: `flex flex-col gap-2 sm:flex-row sm:items-center`.
- Stat/summary pills: `grid grid-cols-2 gap-3 md:grid-cols-4`.
- Forms: single column on phone, `sm:grid-cols-2` for short paired fields.
- Modals/dialogs: `w-[92vw] max-w-lg`, scroll body if tall.

## 7. Cursor, focus, motion

- `cursor: pointer` on interactive elements is **global** (in `globals.css`). Don't
  add it manually, but don't fight it. Disabled controls get `not-allowed`.
- Focus rings are global (`:focus-visible`). Primitives already include them.
- Respect `prefers-reduced-motion` (handled globally for our animations).

## 8. Navigation & links

- Internal navigation uses Next `<Link href>`, **never** `<a href>` (which forces a
  full reload). Swap any `<a href="/…">` to `<Link>`.
- Per-screen back/section navigation should match the shell; don't add bespoke
  top nav bars inside pages.

## 9. Hard constraints (do not break)

- Do not modify: server actions (`actions.ts`), Supabase queries, realtime
  subscriptions, offline/IndexedDB code, GPS, motion-lock, Zod schemas, props,
  exported function names/signatures.
- Do not remove features, fields, or conditionals. Keep every handler wired.
- The driver **motion-lock** screen stays black; the **emergency** modal stays
  alarming (hazard/danger) — these are intentional.
- Keep `'use client'` / server-component boundaries exactly as they are.

## 10. Per-screen checklist

1. Remove page-level `min-h-screen` / `bg-background` / outer `max-w` centering
   (shell owns it). Keep inner content spacing (`space-y-*`, grids).
2. Replace hardcoded colors per §3; use ramps for status.
3. Swap hand-rolled buttons/cards/inputs/badges for primitives where it's a clean
   1:1 — otherwise at least tokenize the classes.
4. Make every grid/table/toolbar responsive per §6.
5. `<a href>` → `<Link>`; emoji nav/action glyphs → lucide icons.
6. Verify nothing logical changed.
