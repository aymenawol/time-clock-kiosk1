"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";
import { ROLES } from "@/lib/auth/permissions";
import type { AuthContext } from "@/lib/auth/session";
import { newPairingCode, sha256 } from "@/lib/kiosk";
import { isValidTimeZone } from "@/lib/scheduling/datetime";
import { orgSettingsSchema } from "@/lib/settings";
import { SECTION_BY_SLUG } from "./_lib/sections";

/* ---------------------------------------------------------------- settings */

type Json = Record<string, unknown>;

export const saveGeneral = action(
  {
    schema: z.object({
      name: z.string().trim().min(1, "Enter the organization name.").max(120),
      timezone: z.string().refine(isValidTimeZone, "Pick a valid time zone."),
      workweekStartsOn: z.coerce.number().int().min(0).max(6),
      clock24h: z.boolean(),
    }),
    capability: "settings",
  },
  async (v, ctx) => {
    const raw = (ctx.org.settings ?? {}) as Json;
    const merged = { ...raw, workweekStartsOn: v.workweekStartsOn, clock24h: v.clock24h };
    const parsed = orgSettingsSchema.safeParse(merged);
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the values.");
    const rows = check(
      await ctx.supabase
        .from("organizations")
        .update({ name: v.name, timezone: v.timezone, settings: merged as never })
        .eq("id", ctx.org.id)
        .select("id"),
    );
    if (!rows?.length) throw new ActionError("You can't change this organization.");
    await audit(ctx, "settings.general", "organizations", ctx.org.id, {
      name: v.name,
      timezone: v.timezone,
      workweekStartsOn: v.workweekStartsOn,
      clock24h: v.clock24h,
    });
  },
);

export const saveSection = action(
  {
    schema: z.object({
      section: z.string(),
      values: z.record(z.string(), z.union([z.number(), z.boolean(), z.string(), z.null()])),
    }),
    capability: "settings",
  },
  async ({ section, values }, ctx) => {
    const def = SECTION_BY_SLUG.get(section);
    if (!def) throw new ActionError("Unknown settings section.");

    // Only fields that the section defines can be saved, with the right type.
    const clean: Json = {};
    for (const f of def.fields) {
      const v = values[f.key];
      if (v === undefined) continue;
      if (f.type === "number") {
        if (typeof v !== "number" || !Number.isFinite(v)) throw new ActionError(`${f.label}: enter a number.`);
        clean[f.key] = Math.round(v * 1_000_000) / 1_000_000;
      } else if (f.type === "boolean") {
        if (typeof v !== "boolean") throw new ActionError(`${f.label}: choose on or off.`);
        clean[f.key] = v;
      } else {
        if (typeof v !== "string" || !f.options.some((o) => o.value === v)) throw new ActionError(`${f.label}: pick one of the options.`);
        clean[f.key] = v;
      }
    }

    const raw = (ctx.org.settings ?? {}) as Json;
    const merged = { ...raw, [section]: { ...((raw[section] as Json | undefined) ?? {}), ...clean } };
    const parsed = orgSettingsSchema.safeParse(merged);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = def.fields.find((f) => f.key === issue?.path[1]);
      throw new ActionError(`${field?.label ?? "Settings"}: ${issue?.message ?? "check the value."}`);
    }
    // Cross-field rules that the schema can't express.
    if (section === "fatigue") {
      const f = parsed.data.fatigue;
      if (f.warnShiftHours > f.maxShiftHours) throw new ActionError("The warning length can't be longer than the maximum shift length.");
    }
    const rows = check(
      await ctx.supabase.from("organizations").update({ settings: merged as never }).eq("id", ctx.org.id).select("id"),
    );
    if (!rows?.length) throw new ActionError("You can't change this organization.");
    await audit(ctx, "settings.update", "organizations", ctx.org.id, { section, values: clean });
  },
);

/* ------------------------------------------------------------------ kiosks */

const PAIRING_MINUTES = 15;

export const pairKiosk = action(
  { schema: z.object({ name: z.string().trim().min(1, "Name the kiosk (for example Terminal 1 desk).").max(80) }), capability: "settings" },
  async ({ name }, ctx) => {
    const code = newPairingCode();
    const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000);
    check(
      await ctx.supabase.from("kiosk_pairing_codes").insert({
        organization_id: ctx.org.id,
        code_hash: sha256(code),
        device_name: name,
        expires_at: expiresAt.toISOString(),
        created_by: ctx.employee.id,
      }),
    );
    await audit(ctx, "kiosk.pair_code", "kiosk_pairing_codes", null, { name });
    return { code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt: expiresAt.toISOString(), name };
  },
);

export const revokeKiosk = action(
  { schema: z.object({ id: zId }), capability: "settings" },
  async ({ id }, ctx) => {
    const rows = check(
      await ctx.supabase
        .from("kiosk_devices")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", ctx.org.id)
        .is("revoked_at", null)
        .select("id"),
    );
    if (!rows?.length) throw new ActionError("That kiosk was already revoked.");
    await audit(ctx, "kiosk.revoke", "kiosk_devices", id);
  },
);

/* --------------------------------------------------------------- catalogues */

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const optNumber = (min: number, max: number) => z.number().min(min).max(max).nullish().transform((v) => v ?? null);

async function remove(ctx: AuthContext, table: "locations" | "airlines" | "routes" | "radio_codes" | "checklist_items" | "tablets", id: string) {
  const { error, data } = await ctx.supabase.from(table).delete().eq("id", id).eq("organization_id", ctx.org.id).select("id");
  if (error) {
    if (error.code === "23503") throw new ActionError("It is still in use. Mark it inactive instead of deleting it.");
    throw error;
  }
  if (!data?.length) throw new ActionError("That record no longer exists.");
  await audit(ctx, `${table}.delete`, table, id);
}

async function dup<T>(run: () => Promise<T>, what: string): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") throw new ActionError(`${what} already exists.`);
    throw e;
  }
}

// Locations
const locationSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1, "Enter a name.").max(80),
  code: z.string().trim().regex(/^[A-Za-z0-9_-]{1,12}$/, "Use up to 12 letters, numbers, dashes or underscores."),
  kind: z.enum(["terminal", "depot", "rental_car", "stop", "other"]),
  lat: optNumber(-90, 90),
  lng: optNumber(-180, 180),
  radius_m: z.number().int().min(10, "At least 10 m.").max(5000, "At most 5000 m."),
  is_count_column: z.boolean(),
  sort: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export const saveLocation = action({ schema: locationSchema, capability: "settings" }, async ({ id, ...v }, ctx) => {
  await dup(async () => {
    if (id) check(await ctx.supabase.from("locations").update(v).eq("id", id).eq("organization_id", ctx.org.id));
    else check(await ctx.supabase.from("locations").insert({ ...v, organization_id: ctx.org.id }));
  }, "A location with that code");
  await audit(ctx, id ? "location.update" : "location.create", "locations", id ?? null, { code: v.code });
});
export const deleteLocation = action({ schema: z.object({ id: zId }), capability: "settings" }, ({ id }, ctx) => remove(ctx, "locations", id));

// Airlines (v0: name, terminal, phone, wheelchair contact, notes, active)
const airlineSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1, "Enter the airline name.").max(80),
  location_id: zId,
  phone: optText(40),
  assist_contact: optText(120),
  notes: optText(1000),
  active: z.boolean(),
  iata_code: z
    .string()
    .trim()
    .toUpperCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^[A-Z0-9]{2,3}$/.test(v), "Use the 2 or 3 character IATA code, for example UA."),
});

export const saveAirline = action({ schema: airlineSchema, capability: "settings" }, async ({ id, ...v }, ctx) => {
  await dup(async () => {
    if (id) check(await ctx.supabase.from("airlines").update(v).eq("id", id).eq("organization_id", ctx.org.id));
    else check(await ctx.supabase.from("airlines").insert({ ...v, organization_id: ctx.org.id }));
  }, "An airline with that name");
  await audit(ctx, id ? "airline.update" : "airline.create", "airlines", id ?? null, { name: v.name });
});
export const setAirlineActive = action(
  { schema: z.object({ id: zId, active: z.boolean() }), capability: "settings" },
  async ({ id, active }, ctx) => {
    check(await ctx.supabase.from("airlines").update({ active }).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, "airline.active", "airlines", id, { active });
  },
);
export const deleteAirline = action({ schema: z.object({ id: zId }), capability: "settings" }, ({ id }, ctx) => remove(ctx, "airlines", id));

// Routes: ordered stops are locations
const routeSchema = z.object({
  id: zId.optional(),
  name: z.string().trim().min(1, "Enter a name.").max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Pick a colour."),
  stop_ids: z.array(zId).max(40),
  active: z.boolean(),
});

export const saveRoute = action({ schema: routeSchema, capability: "settings" }, async ({ id, ...v }, ctx) => {
  const stops = [...new Set(v.stop_ids)];
  if (stops.length > 0) {
    const found = check(await ctx.supabase.from("locations").select("id").eq("organization_id", ctx.org.id).in("id", stops));
    if ((found?.length ?? 0) !== stops.length) throw new ActionError("One of the stops no longer exists.");
  }
  await dup(async () => {
    if (id) check(await ctx.supabase.from("routes").update({ ...v, stop_ids: stops }).eq("id", id).eq("organization_id", ctx.org.id));
    else check(await ctx.supabase.from("routes").insert({ ...v, stop_ids: stops, organization_id: ctx.org.id }));
  }, "A route with that name");
  await audit(ctx, id ? "route.update" : "route.create", "routes", id ?? null, { name: v.name });
});
export const deleteRoute = action({ schema: z.object({ id: zId }), capability: "settings" }, ({ id }, ctx) => remove(ctx, "routes", id));

// Radio codes
const VEHICLE_STATUSES = [
  "ready", "in_service", "charging", "needs_fuel", "needs_wash", "needs_fuel_wash",
  "pmi", "shop", "repair", "safety_hold", "training", "retired",
] as const;

const radioSchema = z.object({
  id: zId.optional(),
  code: z.string().trim().min(1, "Enter the code.").max(12),
  label: z.string().trim().min(1, "Enter a label.").max(60),
  sets_vehicle_status: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (VEHICLE_STATUSES as readonly string[]).includes(v), "Pick a vehicle status."),
  notify_roles: z.array(z.enum(ROLES)),
  is_alert: z.boolean(),
  driver_selectable: z.boolean(),
  sort: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export const saveRadioCode = action({ schema: radioSchema, capability: "settings" }, async ({ id, ...v }, ctx) => {
  const row = { ...v, sets_vehicle_status: v.sets_vehicle_status as (typeof VEHICLE_STATUSES)[number] | null };
  await dup(async () => {
    if (id) check(await ctx.supabase.from("radio_codes").update(row).eq("id", id).eq("organization_id", ctx.org.id));
    else check(await ctx.supabase.from("radio_codes").insert({ ...row, organization_id: ctx.org.id }));
  }, "That radio code");
  await audit(ctx, id ? "radio_code.update" : "radio_code.create", "radio_codes", id ?? null, { code: v.code });
});
export const deleteRadioCode = action({ schema: z.object({ id: zId }), capability: "settings" }, ({ id }, ctx) => remove(ctx, "radio_codes", id));

// Inspection checklist
const checklistSchema = z.object({
  id: zId.optional(),
  category: z.string().trim().min(1, "Enter a category.").max(60),
  label: z.string().trim().min(1, "Enter the item.").max(120),
  critical: z.boolean(),
  sort: z.number().int().min(0).max(9999),
  active: z.boolean(),
});

export const saveChecklistItem = action({ schema: checklistSchema, capability: "settings" }, async ({ id, ...v }, ctx) => {
  if (id) check(await ctx.supabase.from("checklist_items").update(v).eq("id", id).eq("organization_id", ctx.org.id));
  else check(await ctx.supabase.from("checklist_items").insert({ ...v, organization_id: ctx.org.id }));
  await audit(ctx, id ? "checklist.update" : "checklist.create", "checklist_items", id ?? null, { label: v.label });
});
export const deleteChecklistItem = action(
  { schema: z.object({ id: zId }), capability: "settings" },
  ({ id }, ctx) => remove(ctx, "checklist_items", id),
);

// Tablets
const tabletSchema = z.object({
  id: zId.optional(),
  number: z.string().trim().min(1, "Enter the tablet number.").max(20),
  serial: optText(80),
  notes: optText(500),
  active: z.boolean(),
});

export const saveTablet = action({ schema: tabletSchema, capability: "settings" }, async ({ id, ...v }, ctx) => {
  await dup(async () => {
    if (id) check(await ctx.supabase.from("tablets").update(v).eq("id", id).eq("organization_id", ctx.org.id));
    else check(await ctx.supabase.from("tablets").insert({ ...v, organization_id: ctx.org.id }));
  }, "A tablet with that number");
  await audit(ctx, id ? "tablet.update" : "tablet.create", "tablets", id ?? null, { number: v.number });
});
export const deleteTablet = action({ schema: z.object({ id: zId }), capability: "settings" }, ({ id }, ctx) => remove(ctx, "tablets", id));
