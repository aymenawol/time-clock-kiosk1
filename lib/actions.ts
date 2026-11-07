import "server-only";
import { z } from "zod";
import { getAuth, type AuthContext } from "@/lib/auth/session";
import { can, type Capability } from "@/lib/auth/permissions";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export class ActionError extends Error {}

interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
}

/** Turn a Postgres / PostgREST error into a message that is safe to show. */
export function friendlyError(err: unknown): string {
  if (err instanceof ActionError) return err.message;
  const e = err as PgLikeError;
  switch (e?.code) {
    case "P0001": // raise exception from our functions: written for users
      return e.message ?? "That could not be done.";
    case "42501":
      return "You don't have permission to do that.";
    case "23505":
      return "That already exists.";
    case "23P01":
      return "That overlaps an existing record.";
    case "23503":
      return "That refers to something that no longer exists.";
    case "23514":
      return "Some values are out of range.";
    case "PGRST116":
      return "Not found.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** Throw if a Supabase call returned an error. */
export function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/**
 * Define a server action with zod validation and a permission check.
 * The handler runs with the caller's RLS-scoped client in `ctx.supabase`.
 *
 *   export const saveThing = action({ schema, capability: "fleetEdit" }, async (input, ctx) => {...})
 */
export function action<S extends z.ZodType, R = undefined>(
  opts: { schema: S; capability?: Capability },
  handler: (input: z.infer<S>, ctx: AuthContext) => Promise<R>,
): (input: z.input<S>) => Promise<ActionResult<R>> {
  return async (raw: z.input<S>) => {
    const auth = await getAuth();
    if (!auth || auth === "no-membership") return { ok: false, error: "Please sign in again." };
    if (opts.capability && !can(auth.employee.role, opts.capability)) {
      return { ok: false, error: "You don't have permission to do that." };
    }
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form.", fieldErrors };
    }
    try {
      const data = await handler(parsed.data, auth);
      return { ok: true, data: data as R };
    } catch (err) {
      if (!(err instanceof ActionError) && (err as PgLikeError)?.code !== "P0001") {
        console.error("[action]", err);
      }
      return { ok: false, error: friendlyError(err) };
    }
  };
}

/** Append to the organization audit log (best effort, never blocks the action). */
export async function audit(
  ctx: AuthContext,
  actionName: string,
  entity: string,
  entityId: string | null,
  data: Record<string, unknown> = {},
) {
  const { error } = await ctx.supabase.from("audit_events").insert({
    organization_id: ctx.org.id,
    actor_employee_id: ctx.employee.id,
    actor_user_id: ctx.userId,
    action: actionName,
    entity,
    entity_id: entityId,
    data: data as never,
  });
  if (error) console.error("[audit]", error);
}

// Common zod pieces.
export const zId = z.uuid();
export const zText = (max: number) => z.string().trim().max(max);
export const zOptionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
