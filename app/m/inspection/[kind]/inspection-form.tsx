"use client";

import { AlertTriangle, Check, Save, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DamageDiagram, type DamageStroke } from "@/components/domain/damage-diagram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { saveInspection, submitInspection } from "../actions";

export interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  critical: boolean;
}

type Answer = { ok: boolean | null; note: string };

export function InspectionForm({
  kind,
  vehicleNumber,
  lastOdometer,
  items,
  initial,
}: {
  kind: "pre_trip" | "post_trip";
  vehicleNumber: string;
  lastOdometer: number | null;
  items: ChecklistItem[];
  initial: {
    answers: Record<string, Answer>;
    odometer: number | null;
    notes: string;
    damage: DamageStroke[];
  };
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(initial.answers);
  const [odometer, setOdometer] = useState(initial.odometer !== null ? String(initial.odometer) : "");
  const [notes, setNotes] = useState(initial.notes);
  const [damage, setDamage] = useState<DamageStroke[]>(initial.damage);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const [runSave, saving, saveErrors] = useAction(saveInspection, {
    success: "Draft saved",
    onSuccess: () => setDirty(false),
  });
  const [runSubmit, submitting] = useAction(submitInspection, {
    success: (r) =>
      r.critical
        ? "Inspection submitted. The vehicle is going to the shop."
        : r.defects
          ? `Inspection submitted with ${r.defects} defect${r.defects === 1 ? "" : "s"}.`
          : "Inspection submitted. All items passed.",
    onSuccess: () => {
      setDirty(false);
      setConfirming(false);
    },
  });

  // Warn before leaving with unsaved answers.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const groups = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const it of items) map.set(it.category, [...(map.get(it.category) ?? []), it]);
    return [...map.entries()];
  }, [items]);

  const answered = items.filter((it) => answers[it.id]?.ok != null).length;
  const failed = items.filter((it) => answers[it.id]?.ok === false);
  const criticalFailed = failed.filter((it) => it.critical);
  const missingNotes = failed.filter((it) => !answers[it.id]?.note.trim());

  function set(id: string, patch: Partial<Answer>) {
    setDirty(true);
    setAnswers((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { ok: null, note: "" }), ...patch } }));
  }

  function passRest(group: ChecklistItem[]) {
    setDirty(true);
    setAnswers((prev) => {
      const next = { ...prev };
      for (const it of group) if (next[it.id]?.ok == null) next[it.id] = { ok: true, note: "" };
      return next;
    });
  }

  function payload() {
    return {
      kind,
      answers: items.map((it) => ({ itemId: it.id, ok: answers[it.id]?.ok ?? null, note: answers[it.id]?.note ?? "" })),
      odometer: odometer.trim() === "" ? null : Number(odometer),
      notes,
      damage,
    };
  }

  function trySubmit() {
    setShowErrors(true);
    const firstOpen = items.find((it) => answers[it.id]?.ok == null) ?? missingNotes[0];
    if (firstOpen) {
      toast.error(
        answered < items.length
          ? `${items.length - answered} item${items.length - answered === 1 ? " still needs" : "s still need"} a pass or fail.`
          : "Add a short note to every failed item.",
      );
      document.getElementById(`item-${firstOpen.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (odometer.trim() === "") {
      toast.error("Enter the odometer reading.");
      document.getElementById("odometer")?.focus();
      return;
    }
    setConfirming(true);
  }

  const busy = saving || submitting;

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([category, group]) => {
        const done = group.filter((it) => answers[it.id]?.ok != null).length;
        return (
          <Card key={category}>
            <CardHeader
              title={category}
              description={`${done} of ${group.length} checked`}
              actions={
                done < group.length ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => passRest(group)}>
                    <Check /> Pass the rest
                  </Button>
                ) : null
              }
            />
            <ul className="divide-y divide-border">
              {group.map((it) => {
                const a = answers[it.id];
                const missing = showErrors && (a?.ok == null || (a.ok === false && !a.note.trim()));
                return (
                  <li
                    key={it.id}
                    id={`item-${it.id}`}
                    className={cn("scroll-mt-20 px-4 py-3", missing && "bg-danger-soft/60")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium leading-snug text-fg">{it.label}</p>
                        {it.critical ? (
                          <Badge tone="danger" className="mt-1">
                            Critical
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-1.5" role="group" aria-label={`${it.label}: pass or fail`}>
                        <button
                          type="button"
                          aria-pressed={a?.ok === true}
                          aria-label="Pass"
                          onClick={() => set(it.id, { ok: true, note: "" })}
                          className={cn(
                            "flex h-12 w-14 items-center justify-center rounded-[var(--radius-control)] border text-sm font-semibold transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            a?.ok === true
                              ? "border-success bg-success text-white"
                              : "border-border bg-surface text-muted hover:bg-surface-2",
                          )}
                        >
                          <Check className="size-5" />
                        </button>
                        <button
                          type="button"
                          aria-pressed={a?.ok === false}
                          aria-label="Fail"
                          onClick={() => set(it.id, { ok: false })}
                          className={cn(
                            "flex h-12 w-14 items-center justify-center rounded-[var(--radius-control)] border text-sm font-semibold transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            a?.ok === false
                              ? "border-danger bg-danger text-white"
                              : "border-border bg-surface text-muted hover:bg-surface-2",
                          )}
                        >
                          <X className="size-5" />
                        </button>
                      </div>
                    </div>
                    {a?.ok === false ? (
                      <div className="mt-2">
                        <label htmlFor={`note-${it.id}`} className="sr-only">
                          What is wrong with {it.label}?
                        </label>
                        <Input
                          id={`note-${it.id}`}
                          value={a.note}
                          maxLength={300}
                          placeholder="What's wrong? (required)"
                          aria-invalid={showErrors && !a.note.trim() ? true : undefined}
                          className="h-12 text-base"
                          onChange={(e) => set(it.id, { note: e.target.value })}
                        />
                        {it.critical ? (
                          <p className="mt-1 text-xs text-danger">A failed critical item puts the vehicle in the shop.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      <Card>
        <CardHeader title="Odometer and notes" />
        <CardBody className="flex flex-col gap-4">
          <Field
            label="Odometer"
            htmlFor="odometer"
            hint={lastOdometer !== null ? `Last recorded ${lastOdometer.toLocaleString("en-US")}` : undefined}
            error={saveErrors.odometer?.[0]}
          >
            <Input
              id="odometer"
              type="number"
              inputMode="numeric"
              min={0}
              className="h-12 font-mono text-lg"
              value={odometer}
              onChange={(e) => {
                setDirty(true);
                setOdometer(e.target.value.replace(/[^\d]/g, "").slice(0, 7));
              }}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" hint="Optional">
            <Textarea
              id="notes"
              maxLength={2000}
              value={notes}
              onChange={(e) => {
                setDirty(true);
                setNotes(e.target.value);
              }}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Damage" description="Draw on the vehicle where you see new damage. Leave blank if none." />
        <CardBody>
          <DamageDiagram
            value={damage}
            onChange={(d) => {
              setDirty(true);
              setDamage(d);
            }}
          />
        </CardBody>
      </Card>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-1 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2 text-sm">
          <span className="tabular text-muted">
            <span className="font-semibold text-fg">{answered}</span> of {items.length} checked
          </span>
          {failed.length ? (
            <Badge tone={criticalFailed.length ? "danger" : "warning"}>
              {failed.length} failed{criticalFailed.length ? ` · ${criticalFailed.length} critical` : ""}
            </Badge>
          ) : null}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${items.length ? (answered / items.length) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <Button
            type="button"
            size="lg"
            variant="secondary"
            loading={saving}
            disabled={busy}
            onClick={() => void runSave(payload())}
          >
            <Save /> {dirty ? "Save" : "Saved"}
          </Button>
          <Button type="button" size="lg" disabled={busy} onClick={trySubmit}>
            <Send /> Submit
          </Button>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={`Submit ${kind === "pre_trip" ? "pre-trip" : "post-trip"} inspection?`}
          description={`Vehicle ${vehicleNumber}. You can't change it after you submit.`}
        >
          <div className="flex flex-col gap-4">
            {failed.length ? (
              <div className="flex flex-col gap-2">
                {criticalFailed.length ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    A critical item failed. Vehicle {vehicleNumber} goes to the shop and dispatch is told.
                  </p>
                ) : null}
                <p className="text-sm font-medium text-fg">
                  {failed.length} defect{failed.length === 1 ? "" : "s"} will be reported:
                </p>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {failed.map((it) => (
                    <li key={it.id} className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2">
                      <span className="font-medium text-fg">{it.label}</span>
                      {it.critical ? <span className="text-danger"> · critical</span> : null}
                      <span className="block text-muted">{answers[it.id]?.note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm text-success">
                <Check className="size-4" /> All {items.length} items passed.
              </p>
            )}
            {damage.length ? (
              <p className="text-sm text-muted">
                {damage.length} damage mark{damage.length === 1 ? "" : "s"} drawn.
              </p>
            ) : null}
            <Button
              size="xl"
              className="w-full"
              variant={criticalFailed.length ? "danger" : "primary"}
              loading={submitting}
              onClick={() => void runSubmit(payload())}
            >
              <Send /> Submit inspection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
