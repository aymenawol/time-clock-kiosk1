import { describe, expect, it } from "vitest";
import { awardBids, type BidEmployee } from "@/lib/scheduling/bids";
import { bySeniority } from "@/lib/scheduling/seniority";

const emp = (id: string, seniorityNumber: number | null, hireDate: string | null = null): BidEmployee => ({
  id,
  seniorityNumber,
  hireDate,
});

describe("seniority order", () => {
  it("sorts by seniority number, then hire date, then id, with missing values last", () => {
    const sorted = bySeniority([
      emp("e", null, null),
      emp("d", null, "2020-01-01"),
      emp("c", 2, "2019-01-01"),
      emp("b", 2, "2018-01-01"),
      emp("a", 1, null),
      emp("f", null, "2020-01-01"),
      emp("g", 2, null),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["a", "b", "c", "g", "d", "f", "e"]);
  });
});

describe("awardBids", () => {
  const lines = [
    { id: "L1", capacity: 1 },
    { id: "L2", capacity: 2 },
    { id: "L3", capacity: 1 },
  ];

  it("gives each submitter their highest ranked line with a seat, most senior first", () => {
    const result = awardBids({
      lines,
      employees: [emp("junior", 3), emp("senior", 1), emp("middle", 2)],
      preferences: new Map([
        ["junior", ["L1", "L2"]],
        ["senior", ["L1", "L3"]],
        ["middle", ["L1", "L2"]],
      ]),
      fillNonSubmitters: false,
    });
    expect(result.awards).toEqual([
      { employee_id: "senior", line_id: "L1", choice_rank: 1, method: "seniority" },
      { employee_id: "middle", line_id: "L2", choice_rank: 2, method: "seniority" },
      { employee_id: "junior", line_id: "L2", choice_rank: 2, method: "seniority" },
    ]);
    expect(result.unassigned).toEqual([]);
    expect(result.remaining.get("L2")).toBe(0);
    expect(result.remaining.get("L3")).toBe(1);
  });

  it("leaves a submitter unassigned when all their choices are full, even if other lines are open", () => {
    const result = awardBids({
      lines,
      employees: [emp("a", 1), emp("b", 2)],
      preferences: new Map([
        ["a", ["L1"]],
        ["b", ["L1"]],
      ]),
      fillNonSubmitters: true,
    });
    expect(result.awards).toEqual([{ employee_id: "a", line_id: "L1", choice_rank: 1, method: "seniority" }]);
    expect(result.unassigned).toEqual(["b"]);
  });

  it("does not fill non-submitters unless asked", () => {
    const result = awardBids({
      lines,
      employees: [emp("a", 1), emp("quiet", 2)],
      preferences: new Map([["a", ["L3"]]]),
      fillNonSubmitters: false,
    });
    expect(result.awards).toHaveLength(1);
    expect(result.notSubmitted).toEqual(["quiet"]);
  });

  it("fills remaining seats with non-submitters in seniority order, after every submitter", () => {
    const result = awardBids({
      lines: [
        { id: "L1", capacity: 1 },
        { id: "L2", capacity: 1 },
      ],
      employees: [emp("q2", 2), emp("q1", 1), emp("sub", 5), emp("q3", 3)],
      preferences: new Map([["sub", ["L1"]]]),
      fillNonSubmitters: true,
    });
    expect(result.awards).toEqual([
      { employee_id: "sub", line_id: "L1", choice_rank: 1, method: "seniority" },
      { employee_id: "q1", line_id: "L2", choice_rank: null, method: "auto" },
    ]);
    expect(result.notSubmitted).toEqual(["q2", "q3"]);
  });

  it("ignores choices for lines that are not in the cycle and duplicate choices", () => {
    const result = awardBids({
      lines: [{ id: "L1", capacity: 1 }],
      employees: [emp("a", 1)],
      preferences: new Map([["a", ["gone", "gone", "L1"]]]),
      fillNonSubmitters: false,
    });
    expect(result.awards).toEqual([{ employee_id: "a", line_id: "L1", choice_rank: 3, method: "seniority" }]);
  });

  it("treats an empty preference list as not submitted", () => {
    const result = awardBids({
      lines: [{ id: "L1", capacity: 1 }],
      employees: [emp("a", 1)],
      preferences: new Map([["a", []]]),
      fillNonSubmitters: true,
    });
    expect(result.awards).toEqual([{ employee_id: "a", line_id: "L1", choice_rank: null, method: "auto" }]);
    expect(result.unassigned).toEqual([]);
  });

  it("never awards more seats than a line's capacity", () => {
    const employees = Array.from({ length: 10 }, (_, i) => emp(`e${i}`, i + 1));
    const result = awardBids({
      lines: [{ id: "L1", capacity: 3 }],
      employees,
      preferences: new Map(employees.map((e) => [e.id, ["L1"]])),
      fillNonSubmitters: true,
    });
    expect(result.awards.map((a) => a.employee_id)).toEqual(["e0", "e1", "e2"]);
    expect(result.unassigned).toHaveLength(7);
  });
});
