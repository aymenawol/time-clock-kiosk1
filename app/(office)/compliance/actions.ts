"use server";

import { z } from "zod";
import { action, ActionError, audit, check, zId } from "@/lib/actions";

/** Record the compliance verdict (ok or flag) and note for a shift. */
export const setComplianceVerdict = action(
  {
    schema: z.object({
      shiftId: zId,
      verdict: z.enum(["ok", "flag"]),
      note: z.string().trim().max(2000, "Keep the note under 2000 characters").default(""),
    }),
    capability: "complianceVerdict",
  },
  async ({ shiftId, verdict, note }, ctx) => {
    if (verdict === "flag" && note.length < 3) throw new ActionError("Add a short note explaining the flag.");
    const rows = check(
      await ctx.supabase
        .from("shifts")
        .update({
          compliance_verdict: verdict,
          compliance_note: note || null,
          compliance_by: ctx.employee.id,
          compliance_at: new Date().toISOString(),
        })
        .eq("id", shiftId)
        .eq("organization_id", ctx.org.id)
        .select("id"),
    );
    if (!rows || rows.length === 0) throw new ActionError("That shift no longer exists. Refresh the page.");
    await audit(ctx, "shift.compliance", "shifts", shiftId, { verdict });
  },
);
