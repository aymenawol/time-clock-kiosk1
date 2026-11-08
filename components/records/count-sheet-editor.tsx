"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { updateCountSheet } from "@/app/(office)/counts/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";

interface Row {
  departure_time: string;
  counts: Record<string, string>;
}

export function CountSheetEditor({
  sheetId,
  title,
  columns,
  rows,
}: {
  sheetId: string;
  title: string;
  columns: { id: string; name: string }[];
  rows: { departure_time: string; counts: Record<string, number> }[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Row[]>([]);
  const [reason, setReason] = useState("");
  const [run, pending, errors] = useAction(updateCountSheet, {
    success: "Counting sheet updated",
    onSuccess: () => setOpen(false),
  });

  const start = () =>
    setDraft(
      rows.map((r) => ({
        departure_time: r.departure_time,
        counts: Object.fromEntries(columns.map((c) => [c.id, String(r.counts[c.id] ?? 0)])),
      })),
    );

  const setCell = (i: number, patch: Partial<Row>) => setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          start();
          setReason("");
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Pencil aria-hidden />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent title={`Edit ${title}`} description="Every edit is saved as a revision with your reason." className="max-w-3xl">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await run({
              id: sheetId,
              reason,
              rows: draft.map((r) => ({
                departure_time: r.departure_time,
                counts: Object.fromEntries(columns.map((c) => [c.id, Number.parseInt(r.counts[c.id] || "0", 10) || 0])),
              })),
            });
          }}
        >
          <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-2">Departure</th>
                  {columns.map((c) => (
                    <th key={c.id} className="px-2 py-2">
                      {c.name}
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {draft.map((r, i) => (
                  <tr key={i}>
                    <td className="p-1.5">
                      <Input
                        type="time"
                        aria-label={`Departure time, row ${i + 1}`}
                        value={r.departure_time}
                        required
                        onChange={(e) => setCell(i, { departure_time: e.target.value })}
                        className="w-28"
                      />
                    </td>
                    {columns.map((c) => (
                      <td key={c.id} className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={999}
                          inputMode="numeric"
                          aria-label={`${c.name}, row ${i + 1}`}
                          value={r.counts[c.id] ?? ""}
                          onChange={(e) => setCell(i, { counts: { ...r.counts, [c.id]: e.target.value } })}
                          className="w-20"
                        />
                      </td>
                    ))}
                    <td className="p-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove row ${i + 1}`}
                        onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setDraft((d) => [...d, { departure_time: "", counts: Object.fromEntries(columns.map((c) => [c.id, "0"])) }])
              }
            >
              <Plus aria-hidden />
              Add departure
            </Button>
          </div>
          <Field label="Reason for the edit" htmlFor="cs-reason" error={errors.reason?.[0]}>
            <Textarea
              id="cs-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              maxLength={500}
              className="min-h-16"
            />
          </Field>
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
