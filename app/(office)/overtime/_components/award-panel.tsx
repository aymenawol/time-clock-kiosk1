"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { awardOffer } from "../actions";

export interface PanelBidder {
  id: string;
  rank: number;
  name: string;
  number: string;
  role: keyof typeof ROLE_LABEL;
  seniorityLabel: string;
  weekHours: string;
  projectedHours: string;
  exceeds: boolean;
  active: boolean;
  bidAtLabel: string;
}

export function AwardPanel({
  offerId,
  title,
  slots,
  awardable,
  maxWeeklyHours,
  bidders,
  seniorityIds,
  others,
  awards,
}: {
  offerId: string;
  title: string;
  slots: number;
  awardable: boolean;
  maxWeeklyHours: string;
  bidders: PanelBidder[];
  /** The most senior bidders within the weekly limit, up to the slot count. */
  seniorityIds: string[];
  others: { id: string; name: string; number: string; role: keyof typeof ROLE_LABEL }[];
  awards: { name: string; method: string; atLabel: string }[];
}) {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [extra, setExtra] = React.useState("");
  const [run, pending] = useAction(awardOffer, { success: (d) => `Awarded to ${d.count}` });

  const toggle = (id: string, on: boolean) => setSelected((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const manualIds = [...selected, ...(extra ? [extra] : [])];

  return (
    <Card>
      <CardHeader
        title={`Bids for ${title}`}
        description={`${slots} slot${slots === 1 ? "" : "s"}. Bidders are ranked by seniority.`}
      />
      <CardBody className="flex flex-col gap-4">
        {awards.length > 0 ? (
          <div className="rounded-[var(--radius-control)] bg-success-soft p-3 text-sm text-success">
            <p className="font-medium">Awarded</p>
            <ul className="mt-1 list-inside list-disc">
              {awards.map((a) => (
                <li key={a.name + a.atLabel}>
                  {a.name} ({a.method}, {a.atLabel})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {bidders.length === 0 ? (
          <p className="text-sm text-muted">No bids yet.</p>
        ) : (
          <div className="-mx-4 border-y border-border">
            <Table>
              <THead>
                <tr>
                  <TH className="w-10">
                    <span className="sr-only">Select</span>
                  </TH>
                  <TH>Rank</TH>
                  <TH>Employee</TH>
                  <TH>Role</TH>
                  <TH>Seniority</TH>
                  <TH className="text-right">Week so far</TH>
                  <TH className="text-right">With this shift</TH>
                  <TH>Bid at</TH>
                </tr>
              </THead>
              <TBody>
                {bidders.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <Checkbox
                        aria-label={`Select ${b.name}`}
                        disabled={!awardable || !b.active}
                        checked={selected.includes(b.id)}
                        onChange={(e) => toggle(b.id, e.target.checked)}
                      />
                    </TD>
                    <TD className="tabular">{b.rank}</TD>
                    <TD>
                      <span className="font-medium">{b.name}</span>
                      <span className="ml-2 text-xs text-muted">#{b.number}</span>
                      {!b.active ? <Badge className="ml-2">Inactive</Badge> : null}
                    </TD>
                    <TD>{ROLE_LABEL[b.role]}</TD>
                    <TD className="tabular">{b.seniorityLabel}</TD>
                    <TD className="text-right tabular">{b.weekHours} h</TD>
                    <TD className="text-right tabular">
                      {b.exceeds ? (
                        <Badge tone="warning" title={`Over the ${maxWeeklyHours} h weekly limit`}>
                          <AlertTriangle className="size-3" aria-hidden /> {b.projectedHours} h
                        </Badge>
                      ) : (
                        <>{b.projectedHours} h</>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{b.bidAtLabel}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
        {bidders.some((b) => b.exceeds) ? (
          <p className="flex items-center gap-2 text-sm text-warning" role="status">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Flagged bidders would pass {maxWeeklyHours} hours this week. Awarding by seniority skips them.
          </p>
        ) : null}
        {awardable ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <Button
              type="button"
              disabled={seniorityIds.length === 0}
              loading={pending}
              onClick={() => run({ offer_id: offerId, employee_ids: seniorityIds, method: "seniority" })}
            >
              Award by seniority ({seniorityIds.length})
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={manualIds.length === 0}
              loading={pending}
              onClick={() => run({ offer_id: offerId, employee_ids: manualIds, method: "manual" })}
            >
              Award selected ({manualIds.length})
            </Button>
            {others.length > 0 ? (
              <div className="flex flex-col gap-1.5 sm:ml-auto sm:w-72">
                <label htmlFor="ot-other" className="text-sm font-medium">
                  Or pick someone who did not bid
                </label>
                <Select id="ot-other" value={extra} onChange={(e) => setExtra(e.target.value)}>
                  <option value="">None</option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} (#{o.number}, {ROLE_LABEL[o.role]})
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">This offer can no longer be awarded.</p>
        )}
      </CardBody>
    </Card>
  );
}
