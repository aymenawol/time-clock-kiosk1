import { bySeniority, type SeniorityKey } from "./seniority";

export interface BidLineCapacity {
  id: string;
  capacity: number;
}

export type BidEmployee = SeniorityKey;

export interface BidAward {
  employee_id: string;
  line_id: string;
  /** 1-based position of the line in the employee's choices; null for auto fills. */
  choice_rank: number | null;
  method: "seniority" | "auto";
}

export interface AwardBidsInput {
  lines: BidLineCapacity[];
  employees: BidEmployee[];
  /** Employee id -> line ids in order of preference. */
  preferences: Map<string, string[]>;
  /** Fill capacity left after submitters with non-submitters, in seniority order. */
  fillNonSubmitters: boolean;
}

export interface AwardBidsResult {
  awards: BidAward[];
  /** Submitters whose choices were all full. They are never moved to a line they did not pick. */
  unassigned: string[];
  /** Non-submitters left without a line (all of them when fill is off). */
  notSubmitted: string[];
  /** Line id -> seats still open after awarding. */
  remaining: Map<string, number>;
}

/**
 * Seniority bid award. Every submitter, most senior first, gets their highest
 * ranked line that still has a seat. A submitter whose choices are all full is
 * left unassigned for a manual decision. Optionally, the seats that are left
 * then go to employees who did not submit, most senior first, line by line in
 * the order the lines are given.
 */
export function awardBids(input: AwardBidsInput): AwardBidsResult {
  const remaining = new Map<string, number>();
  for (const line of input.lines) remaining.set(line.id, Math.max(0, Math.floor(line.capacity)));

  const ordered = bySeniority(input.employees);
  const awards: BidAward[] = [];
  const unassigned: string[] = [];
  const nonSubmitters: BidEmployee[] = [];

  for (const emp of ordered) {
    const choices = input.preferences.get(emp.id);
    if (!choices || choices.length === 0) {
      nonSubmitters.push(emp);
      continue;
    }
    let awarded = false;
    const seen = new Set<string>();
    for (let i = 0; i < choices.length; i++) {
      const lineId = choices[i];
      if (seen.has(lineId)) continue;
      seen.add(lineId);
      const left = remaining.get(lineId);
      if (left === undefined || left <= 0) continue;
      remaining.set(lineId, left - 1);
      awards.push({ employee_id: emp.id, line_id: lineId, choice_rank: i + 1, method: "seniority" });
      awarded = true;
      break;
    }
    if (!awarded) unassigned.push(emp.id);
  }

  const notSubmitted: string[] = [];
  for (const emp of nonSubmitters) {
    const open = input.fillNonSubmitters ? input.lines.find((l) => (remaining.get(l.id) ?? 0) > 0) : undefined;
    if (!open) {
      notSubmitted.push(emp.id);
      continue;
    }
    remaining.set(open.id, (remaining.get(open.id) ?? 0) - 1);
    awards.push({ employee_id: emp.id, line_id: open.id, choice_rank: null, method: "auto" });
  }

  return { awards, unassigned, notSubmitted, remaining };
}
