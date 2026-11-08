"use server";

import { z } from "zod";
import { must } from "@/components/records/must";
import { action, ActionError, audit, check, zId } from "@/lib/actions";

export const assignDefect = action(
  { schema: z.object({ id: zId, employeeId: zId.nullable() }), capability: "defectsWork" },
  async ({ id, employeeId }, ctx) => {
    if (employeeId) {
      const tech = check(
        await ctx.supabase
          .from("employees")
          .select("id, role, status")
          .eq("id", employeeId)
          .eq("organization_id", ctx.org.id)
          .maybeSingle(),
      );
      if (!tech || tech.role !== "technician" || tech.status === "terminated") {
        throw new ActionError("Pick an active technician.");
      }
    }
    check(
      await ctx.supabase.from("defects").update({ assigned_to: employeeId }).eq("id", id).eq("organization_id", ctx.org.id),
    );
    await audit(ctx, "defect.assign", "defects", id, { assigned_to: employeeId });
  },
);

export const updateDefectStatus = action(
  {
    schema: z.object({
      id: zId,
      status: z.enum(["open", "in_progress", "deferred", "resolved"]),
      note: z.string().trim().max(2000).optional(),
    }),
    capability: "defectsWork",
  },
  async ({ id, status, note }, ctx) => {
    if (status === "resolved" && !note) throw new ActionError("Add a resolution note before resolving.");
    if (status === "deferred" && !note) throw new ActionError("Say why this is deferred.");
    const patch =
      status === "resolved"
        ? { status, resolution_note: note ?? null, resolved_by: ctx.employee.id, resolved_at: new Date().toISOString() }
        : {
            status,
            resolution_note: status === "deferred" ? (note ?? null) : null,
            resolved_by: null,
            resolved_at: null,
          };
    check(await ctx.supabase.from("defects").update(patch).eq("id", id).eq("organization_id", ctx.org.id));
    await audit(ctx, "defect.status", "defects", id, { status, note: note ?? null });
  },
);

export const putVehicleInShop = action(
  { schema: z.object({ defectId: zId }), capability: "defectsWork" },
  async ({ defectId }, ctx) => {
    const defect = must(
      check(
        await ctx.supabase
          .from("defects")
          .select("vehicle_id, severity, item")
          .eq("id", defectId)
          .eq("organization_id", ctx.org.id)
          .single(),
      ),
    );
    if (defect.severity !== "critical") throw new ActionError("Only critical defects can put a vehicle in the shop.");
    const vehicle = must(
      check(await ctx.supabase.from("vehicles").select("status").eq("id", defect.vehicle_id).eq("organization_id", ctx.org.id).single()),
    );
    if (vehicle.status === "shop") throw new ActionError("The vehicle is already in the shop.");
    if (vehicle.status === "retired") throw new ActionError("This vehicle is retired.");
    check(
      await ctx.supabase.rpc("set_vehicle_status", {
        p_vehicle_id: defect.vehicle_id,
        p_status: "shop",
        p_reason: `Critical defect: ${defect.item}`,
      }),
    );
  },
);
