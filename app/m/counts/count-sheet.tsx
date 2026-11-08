"use client";

import { CheckCircle2, Plus, Save, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { saveCountSheet, submitCountSheet } from "./actions";

export interface CountColumn {
  id: string;
  code: string;
  name: string;
}
export interface CountRow {
  departure_time: string;
  counts: Record<string, number>;
}
interface EditRow extends CountRow {
  key: number;
}

const DEFAULT_ROWS = 10;
let keySeq = 0;
const newKey = () => ++keySeq;
const cell =
  "h-11 rounded-[var(--radius-control)] border border-border bg-surface text-fg text-center tabular disabled:border-transparent disabled:bg-transparent disabled:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CountSheet({
  columns,
  initialRows,
  submitted,
  submittedAt,
  driverName,
  vehicleNumber,
  dateLabel,
}: {
  columns: CountColumn[];
  initialRows: CountRow[];
  submitted: boolean;
  submittedAt: string | null;
  driverName: string;
  vehicleNumber: string | null;
  dateLabel: string;
}) {
  const [rows, setRows] = useState<EditRow[]>(() => {
    const base = initialRows.map((r) => ({ ...r, key: newKey() }));
    const fill = submitted ? 0 : Math.max(0, DEFAULT_ROWS - base.length);
    return [...base, ...Array.from({ length: fill }, () => ({ key: newKey(), departure_time: "", counts: {} }))];
  });
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [runSave, saving] = useAction(saveCountSheet, { success: "Draft saved", onSuccess: () => setDirty(false) });
  const [runSubmit, submitting] = useAction(submitCountSheet, {
    success: "Counting sheet submitted",
    onSuccess: () => {
      setDirty(false);
      setConfirming(false);
    },
  });
  const busy = saving || submitting;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const rowTotal = (r: CountRow) => columns.reduce((s, c) => s + (r.counts[c.id] ?? 0), 0);
  const totals = useMemo(() => {
    const byCol: Record<string, number> = {};
    for (const c of columns) byCol[c.id] = rows.reduce((s, r) => s + (r.counts[c.id] ?? 0), 0);
    return byCol;
  }, [rows, columns]);
  const grand = Object.values(totals).reduce((s, n) => s + n, 0);
  const filled = rows.filter((r) => r.departure_time || rowTotal(r) > 0).length;

  function patch(key: number, fn: (r: EditRow) => EditRow) {
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.key === key ? fn(r) : r)));
  }
  const payload = () => ({
    rows: rows.map((r) => ({ departure_time: r.departure_time, counts: r.counts })),
  });

  return (
    <div className="flex flex-col gap-4">
      {submitted ? (
        <div
          className="flex items-center gap-2 rounded-[var(--radius-card)] border border-success/30 bg-success-soft px-4 py-3 text-sm text-success"
          role="status"
        >
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Submitted</span>
            {submittedAt ? ` ${submittedAt}` : ""}. Ask dispatch if something needs fixing.
          </span>
        </div>
      ) : null}

      <Card>
        <dl className="grid grid-cols-3 divide-x divide-border text-sm">
          <div className="px-3 py-3">
            <dt className="text-xs text-muted">Driver</dt>
            <dd className="truncate text-fg">{driverName}</dd>
          </div>
          <div className="px-3 py-3">
            <dt className="text-xs text-muted">Bus</dt>
            <dd className="text-fg">{vehicleNumber ? `#${vehicleNumber}` : "-"}</dd>
          </div>
          <div className="px-3 py-3">
            <dt className="text-xs text-muted">Date</dt>
            <dd className="text-fg">{dateLabel}</dd>
          </div>
        </dl>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">Passengers counted per departure and location</caption>
            <thead>
              <tr className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="w-9 px-2 py-2 text-center font-medium">
                  #
                </th>
                <th scope="col" className="px-2 py-2 text-left font-medium">
                  Depart
                </th>
                {columns.map((c) => (
                  <th key={c.id} scope="col" title={c.name} className="px-1 py-2 text-center font-medium">
                    {c.code}
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 text-center font-semibold text-fg">
                  Total
                </th>
                {!submitted ? (
                  <th scope="col" className="w-10">
                    <span className="sr-only">Remove row</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="px-2 text-center text-xs text-muted">{i + 1}</td>
                  <td className="px-1 py-1">
                    <input
                      type="time"
                      aria-label={`Row ${i + 1} departure time`}
                      value={r.departure_time}
                      disabled={submitted}
                      onChange={(e) => patch(r.key, (x) => ({ ...x, departure_time: e.target.value }))}
                      className={cn(cell, "w-28 px-1 text-left")}
                    />
                  </td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-1 py-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Row ${i + 1} ${c.name}`}
                        value={r.counts[c.id] ? String(r.counts[c.id]) : ""}
                        disabled={submitted}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          const n = parseInt(e.target.value.replace(/\D/g, "").slice(0, 3), 10) || 0;
                          patch(r.key, (x) => ({ ...x, counts: { ...x.counts, [c.id]: n } }));
                        }}
                        className={cn(cell, "w-14")}
                      />
                    </td>
                  ))}
                  <td className="px-2 text-center font-semibold text-fg tabular">{rowTotal(r) || ""}</td>
                  {!submitted ? (
                    <td className="px-1">
                      <button
                        type="button"
                        aria-label={`Delete row ${i + 1}`}
                        onClick={() => {
                          setDirty(true);
                          setRows((prev) => prev.filter((x) => x.key !== r.key));
                        }}
                        className="flex size-10 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-surface-2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="size-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface-2 text-xs font-semibold text-fg">
                <td colSpan={2} className="px-2 py-3 uppercase tracking-wide">
                  Totals
                </td>
                {columns.map((c) => (
                  <td key={c.id} className="px-1 py-3 text-center tabular">
                    {totals[c.id] || ""}
                  </td>
                ))}
                <td className="px-2 py-3 text-center text-base text-primary tabular">{grand || ""}</td>
                {!submitted ? <td /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {!submitted ? (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-[var(--radius-card)] border border-border bg-surface/95 p-3 shadow-[var(--shadow-pop)] backdrop-blur">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted">
              <span className="font-semibold text-fg tabular">{grand}</span> passengers · {filled} departure
              {filled === 1 ? "" : "s"}
            </span>
            {dirty ? <Badge tone="warning">Unsaved</Badge> : <Badge tone="neutral">Saved</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="col-span-2"
              disabled={busy}
              onClick={() => {
                setDirty(true);
                setRows((prev) => [...prev, { key: newKey(), departure_time: "", counts: {} }]);
              }}
            >
              <Plus /> Add row
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              loading={saving}
              disabled={busy}
              onClick={() => void runSave(payload())}
            >
              <Save /> Save draft
            </Button>
            <Button type="button" size="lg" disabled={busy || filled === 0} onClick={() => setConfirming(true)}>
              <Send /> Submit sheet
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent title="Submit counting sheet?" description="You can't change it after you submit.">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg">
              {grand} passenger{grand === 1 ? "" : "s"} across {filled} departure{filled === 1 ? "" : "s"}.
            </p>
            <Button size="xl" className="w-full" loading={submitting} onClick={() => void runSubmit(payload())}>
              <Send /> Submit sheet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
