"use client";

import { Wrench } from "lucide-react";
import { useState } from "react";
import { assignDefect, putVehicleInShop, updateDefectStatus } from "@/app/(office)/fleet/defects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { DefectStatusPill, SeverityPill } from "./defect-pills";

export interface DefectView {
  id: string;
  vehicleNumber: string;
  vehicleStatus: string;
  item: string;
  category: string;
  description: string | null;
  severity: string;
  status: string;
  assignedTo: string | null;
  reportedBy: string;
  reportedAt: string;
  resolutionNote: string | null;
  photos: string[];
}

export function DefectDetailButton({
  defect,
  technicians,
  canWork,
}: {
  defect: DefectView;
  technicians: { id: string; name: string }[];
  canWork: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [assign, assigning] = useAction(assignDefect, { success: "Assignment saved" });
  const [setStatus, changing, statusErrors] = useAction(updateDefectStatus, {
    success: "Defect updated",
    onSuccess: () => {
      setNote("");
      setOpen(false);
    },
  });
  const [shop, shopping] = useAction(putVehicleInShop, { success: "Vehicle put in the shop" });

  const closed = defect.status === "resolved";
  const transitions = (["open", "in_progress", "deferred", "resolved"] as const).filter((s) => s !== defect.status);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          {canWork && !closed ? "Work" : "View"}
        </Button>
      </DialogTrigger>
      <DialogContent title={defect.item} description={`Vehicle ${defect.vehicleNumber}, ${defect.category}`} className="max-w-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityPill severity={defect.severity} />
            <DefectStatusPill status={defect.status} />
            <span className="text-xs text-muted">
              Reported by {defect.reportedBy}, {defect.reportedAt}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-fg">{defect.description ?? "No description."}</p>
          {defect.resolutionNote ? (
            <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">
              <span className="font-medium">Note: </span>
              {defect.resolutionNote}
            </p>
          ) : null}

          {defect.photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {defect.photos.map((src, i) => (
                <a key={i} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-control)] border border-border">
                  {/* Signed Supabase URLs, short lived: next/image would add nothing. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Defect photo ${i + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          ) : null}

          {canWork ? (
            <>
              <Field label="Assigned technician" htmlFor={`as-${defect.id}`}>
                <Select
                  id={`as-${defect.id}`}
                  defaultValue={defect.assignedTo ?? ""}
                  disabled={assigning}
                  onChange={(e) => void assign({ id: defect.id, employeeId: e.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Note"
                htmlFor={`note-${defect.id}`}
                hint="Required to resolve or defer"
                error={statusErrors.note?.[0]}
              >
                <Textarea id={`note-${defect.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {transitions.map((s) => (
                  <Button
                    key={s}
                    variant={s === "resolved" ? "success" : "secondary"}
                    loading={changing}
                    onClick={() => void setStatus({ id: defect.id, status: s, note: note.trim() || undefined })}
                  >
                    {{ open: "Reopen", in_progress: "Start work", deferred: "Defer", resolved: "Resolve" }[s]}
                  </Button>
                ))}
              </div>
              {defect.severity === "critical" && !closed && defect.vehicleStatus !== "shop" ? (
                <div className="border-t border-border pt-4">
                  <Button variant="danger" loading={shopping} onClick={() => void shop({ defectId: defect.id })}>
                    <Wrench aria-hidden />
                    Put vehicle {defect.vehicleNumber} in the shop
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
