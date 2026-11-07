"use client";

import { AlertOctagon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

type Emergency = Pick<Tables<"emergencies">, "id" | "title" | "message" | "kind" | "created_at">;

/**
 * Blocks the screen while the organization has an active emergency that this
 * employee has not acknowledged. Mounted in every signed-in shell, so every
 * role sees it (v0 only showed it to drivers).
 */
export function EmergencyGate({ organizationId, employeeId }: { organizationId: string; employeeId: string }) {
  const [emergency, setEmergency] = useState<Emergency | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("emergencies")
      .select("id,title,message,kind,created_at")
      .eq("organization_id", organizationId)
      .eq("active", true)
      .maybeSingle();
    if (!data) return setEmergency(null);
    const { data: ack } = await supabase
      .from("emergency_acks")
      .select("emergency_id")
      .eq("emergency_id", data.id)
      .eq("employee_id", employeeId)
      .maybeSingle();
    setEmergency(ack ? null : data);
  }, [organizationId, employeeId]);

  useEffect(() => {
    const supabase = createClient();
    const initial = setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`emergency:${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "emergencies", filter: `organization_id=eq.${organizationId}` }, () => void load())
      .subscribe();
    return () => {
      clearTimeout(initial);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, load]);

  if (!emergency) return null;

  async function acknowledge() {
    if (!emergency) return;
    setSaving(true);
    const { error } = await createClient()
      .from("emergency_acks")
      .insert({ emergency_id: emergency.id, employee_id: employeeId, organization_id: organizationId });
    setSaving(false);
    if (!error || error.code === "23505") setEmergency(null);
  }

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="emergency-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-tile)] border-2 border-danger bg-surface shadow-[var(--shadow-pop)]">
        <div className="flex items-center gap-3 bg-danger px-5 py-4 text-white">
          <AlertOctagon className="size-7 shrink-0 animate-pulse" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Emergency · {emergency.kind}</p>
            <h2 id="emergency-title" className="text-lg font-bold">
              {emergency.title}
            </h2>
          </div>
        </div>
        <p className="whitespace-pre-wrap px-5 py-5 text-base leading-relaxed text-fg">{emergency.message}</p>
        <div className="px-5 pb-5">
          <Button variant="danger" size="xl" className="w-full" onClick={acknowledge} loading={saving}>
            I understand
          </Button>
        </div>
      </div>
    </div>
  );
}
