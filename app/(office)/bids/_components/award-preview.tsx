"use client";

import { AlertTriangle, CheckCircle2, UserRoundCog } from "lucide-react";
import * as React from "react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { awardBids } from "@/lib/scheduling/bids";
import { compareSeniority } from "@/lib/scheduling/seniority";
import { applyAwards } from "../actions";

export interface PreviewLine {
  id: string;
  number: number;
  label: string;
  capacity: number;
}

export interface PreviewEmployee {
  id: string;
  name: string;
  number: string;
  seniorityNumber: number | null;
  hireDate: string | null;
  /** Ranked line ids, or null when the employee did not bid. */
  choices: string[] | null;
}

interface Override {
  /** "" = leave without a line */
  lineId: string;
  reason: string;
}

interface Row {
  emp: PreviewEmployee;
  lineId: string | null;
  choiceRank: number | null;
  method: "seniority" | "auto" | "manual" | null;
  reason: string | null;
  state: "awarded" | "unassigned" | "not_submitted";
}

export function AwardPreview({
  cycleId,
  lines,
  employees,
  initialOverrides,
  canApply,
  alreadyAwarded,
}: {
  cycleId: string;
  lines: PreviewLine[];
  employees: PreviewEmployee[];
  initialOverrides: Record<string, Override>;
  canApply: boolean;
  alreadyAwarded: boolean;
}) {
  const [fill, setFill] = React.useState(false);
  const [overrides, setOverrides] = React.useState<Record<string, Override>>(initialOverrides);
  const [editing, setEditing] = React.useState<PreviewEmployee | null>(null);
  const [run] = useAction(applyAwards, {
    success: (d) => `Awarded ${d.count} ${d.count === 1 ? "line" : "lines"}. Employees were notified.`,
  });

  const lineById = React.useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);

  const { rows, usage, problems } = React.useMemo(() => {
    const pinned = new Map<string, number>();
    for (const o of Object.values(overrides)) if (o.lineId) pinned.set(o.lineId, (pinned.get(o.lineId) ?? 0) + 1);
    const pool = employees.filter((e) => !overrides[e.id]);
    const result = awardBids({
      lines: lines.map((l) => ({ id: l.id, capacity: Math.max(0, l.capacity - (pinned.get(l.id) ?? 0)) })),
      employees: pool.map((e) => ({ id: e.id, seniorityNumber: e.seniorityNumber, hireDate: e.hireDate })),
      preferences: new Map(pool.filter((e) => e.choices?.length).map((e) => [e.id, e.choices ?? []])),
      fillNonSubmitters: fill,
    });
    const awardByEmp = new Map(result.awards.map((a) => [a.employee_id, a]));
    const unassigned = new Set(result.unassigned);

    const out: Row[] = [...employees]
      .sort((a, b) => compareSeniority(a, b))
      .map((emp) => {
        const o = overrides[emp.id];
        if (o) {
          const rank = o.lineId && emp.choices ? emp.choices.indexOf(o.lineId) : -1;
          return {
            emp,
            lineId: o.lineId || null,
            choiceRank: rank >= 0 ? rank + 1 : null,
            method: o.lineId ? "manual" : null,
            reason: o.reason,
            state: o.lineId ? "awarded" : emp.choices?.length ? "unassigned" : "not_submitted",
          };
        }
        const a = awardByEmp.get(emp.id);
        if (a) return { emp, lineId: a.line_id, choiceRank: a.choice_rank, method: a.method, reason: null, state: "awarded" };
        return {
          emp,
          lineId: null,
          choiceRank: null,
          method: null,
          reason: null,
          state: unassigned.has(emp.id) ? "unassigned" : "not_submitted",
        };
      });

    const used = new Map<string, number>();
    for (const r of out) if (r.lineId) used.set(r.lineId, (used.get(r.lineId) ?? 0) + 1);
    const issues: string[] = [];
    for (const l of lines) {
      if ((used.get(l.id) ?? 0) > l.capacity) issues.push(`Line ${l.number} has more awards than its ${l.capacity} seats.`);
    }
    return { rows: out, usage: used, problems: issues };
  }, [employees, lines, overrides, fill]);

  const awarded = rows.filter((r) => r.lineId);
  const unassignedCount = rows.filter((r) => r.state === "unassigned").length;
  const notSubmittedCount = rows.filter((r) => r.state === "not_submitted").length;
  const manualCount = rows.filter((r) => r.method === "manual").length;

  async function apply() {
    return run({
      cycle_id: cycleId,
      awards: awarded.map((r) => ({
        employee_id: r.emp.id,
        line_id: r.lineId as string,
        choice_rank: r.choiceRank,
        method: r.method ?? "manual",
        reason: r.method === "manual" ? r.reason || null : null,
      })),
    });
  }

  const lineName = (id: string | null) => (id ? `Line ${lineById.get(id)?.number ?? "?"}` : "-");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Award preview"
          description="Most senior first, each bidder gets their highest-ranked line with a seat. Nothing is saved until you apply."
          actions={
            canApply ? (
              <ConfirmButton
                title={alreadyAwarded ? "Replace the current awards?" : "Apply these awards?"}
                description={`${awarded.length} employees get a line${manualCount ? `, ${manualCount} by manual override` : ""}. Each awardee is notified.${alreadyAwarded ? " The awards saved earlier are replaced." : ""}`}
                confirmLabel="Apply awards"
                onConfirm={apply}
                disabled={problems.length > 0 || awarded.length === 0}
              >
                <CheckCircle2 aria-hidden />
                Apply awards
              </ConfirmButton>
            ) : null
          }
        />
        <CardBody className="flex flex-col gap-4">
          {!canApply ? (
            <p className="rounded-[var(--radius-control)] bg-info-soft px-3 py-2 text-sm text-info">
              This is a preview. Close bidding to apply awards.
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={fill} onChange={(e) => setFill(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium text-fg">Fill open seats with employees who did not bid</span>
              <span className="block text-muted">
                After every bidder is placed, remaining seats go to non-bidders by seniority, in line order.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Seats used per line">
            {lines.map((l) => {
              const u = usage.get(l.id) ?? 0;
              return (
                <Badge key={l.id} tone={u > l.capacity ? "danger" : u === l.capacity ? "success" : "neutral"}>
                  <span className="tabular">
                    Line {l.number}: {u}/{l.capacity}
                  </span>
                </Badge>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              <strong className="tabular">{awarded.length}</strong> awarded
            </span>
            <span className={cn(unassignedCount && "text-warning")}>
              <strong className="tabular">{unassignedCount}</strong> bidders without a line
            </span>
            <span className="text-muted">
              <strong className="tabular">{notSubmittedCount}</strong> did not bid and have no line
            </span>
          </div>
          {problems.length ? (
            <div role="alert" className="rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-sm text-danger">
              {problems.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          ) : null}
          {unassignedCount ? (
            <p className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Some bidders lost every line they picked. They are not moved to another line automatically. Use Override to place
              them.
            </p>
          ) : null}
        </CardBody>
        <Table>
          <THead>
            <tr>
              <TH className="w-16">Sen. #</TH>
              <TH>Employee</TH>
              <TH>Choices</TH>
              <TH>Award</TH>
              <TH className="w-28">
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.emp.id}>
                <TD className="tabular text-muted">{r.emp.seniorityNumber ?? "-"}</TD>
                <TD className="min-w-40">
                  <p className="font-medium">{r.emp.name}</p>
                  <p className="text-xs text-muted tabular">#{r.emp.number}</p>
                </TD>
                <TD>
                  {r.emp.choices?.length ? (
                    <ol className="flex flex-wrap gap-1">
                      {r.emp.choices.map((lid, i) => (
                        <li
                          key={`${lid}-${i}`}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-xs tabular",
                            lid === r.lineId ? "bg-success-soft font-semibold text-success" : "bg-surface-2 text-muted",
                          )}
                        >
                          {i + 1}. L{lineById.get(lid)?.number ?? "?"}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <span className="text-xs text-muted">No bid</span>
                  )}
                </TD>
                <TD className="whitespace-nowrap">
                  {r.lineId ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lineName(r.lineId)}</span>
                      {r.method === "manual" ? (
                        <Badge tone="accent" title={r.reason ?? undefined}>
                          Manual
                        </Badge>
                      ) : r.method === "auto" ? (
                        <Badge tone="info">Auto fill</Badge>
                      ) : (
                        <Badge tone="success">Choice {r.choiceRank}</Badge>
                      )}
                    </div>
                  ) : r.state === "unassigned" ? (
                    <Badge tone="warning">No seat left</Badge>
                  ) : (
                    <span className="text-xs text-muted">{overrides[r.emp.id] ? "Kept off (manual)" : "-"}</span>
                  )}
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {overrides[r.emp.id] ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setOverrides((prev) => {
                            const next = { ...prev };
                            delete next[r.emp.id];
                            return next;
                          })
                        }
                      >
                        Undo
                      </Button>
                    ) : null}
                    <Button size="sm" variant="secondary" onClick={() => setEditing(r.emp)}>
                      <UserRoundCog aria-hidden />
                      Override
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {editing ? (
        <OverrideDialog
          key={editing.id}
          employee={editing}
          lines={lines}
          usage={usage}
          current={overrides[editing.id] ?? { lineId: rows.find((r) => r.emp.id === editing.id)?.lineId ?? "", reason: "" }}
          onClose={() => setEditing(null)}
          onSave={(o) => {
            setOverrides((prev) => ({ ...prev, [editing.id]: o }));
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function OverrideDialog({
  employee,
  lines,
  usage,
  current,
  onClose,
  onSave,
}: {
  employee: PreviewEmployee;
  lines: PreviewLine[];
  usage: Map<string, number>;
  current: Override;
  onClose: () => void;
  onSave: (o: Override) => void;
}) {
  const [lineId, setLineId] = React.useState(current.lineId);
  const [reason, setReason] = React.useState(current.reason);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent title={`Override for ${employee.name}`} description="Manual awards are saved with your reason.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 3) {
                setError("Give a reason (at least 3 characters).");
                return;
              }
              onSave({ lineId, reason: reason.trim() });
            }}
          >
            <Field label="Line" htmlFor="ov-line">
              <Select id="ov-line" value={lineId} onChange={(e) => setLineId(e.target.value)}>
                <option value="">No line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} ({usage.get(l.id) ?? 0}/{l.capacity} taken)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reason" htmlFor="ov-reason" error={error}>
              <Textarea
                id="ov-reason"
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Medical accommodation, agreed with the employee"
                aria-invalid={Boolean(error) || undefined}
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">Set override</Button>
            </div>
          </form>
        </DialogContent>
    </Dialog>
  );
}
