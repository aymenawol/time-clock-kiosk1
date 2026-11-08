import { describe, expect, it } from "vitest";
import { rankOtBidders, topBySeniority } from "@/lib/scheduling/overtime";

const b = (id: string, seniorityNumber: number | null, currentWeekMinutes: number, hireDate: string | null = null) => ({
  id,
  seniorityNumber,
  hireDate,
  currentWeekMinutes,
  name: id.toUpperCase(),
});

describe("rankOtBidders", () => {
  it("orders bidders by seniority and keeps extra fields", () => {
    const ranked = rankOtBidders([b("c", 3, 0), b("a", 1, 0), b("n", null, 0, "2010-01-01"), b("b", 2, 0)], 480, 3600);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 3],
      ["n", 4],
    ]);
    expect(ranked[0].name).toBe("A");
  });

  it("flags bidders the offer would push past the weekly limit", () => {
    const ranked = rankOtBidders([b("a", 1, 3300), b("b", 2, 3120), b("c", 3, 0)], 480, 3600);
    expect(ranked.map((r) => r.projectedWeekMinutes)).toEqual([3780, 3600, 480]);
    expect(ranked.map((r) => r.exceedsWeeklyLimit)).toEqual([true, false, false]);
  });

  it("picks the most senior bidders within the limit for the open slots", () => {
    const ranked = rankOtBidders([b("a", 1, 3500), b("b", 2, 0), b("c", 3, 0), b("d", 4, 0)], 240, 3600);
    expect(topBySeniority(ranked, 2).map((r) => r.id)).toEqual(["b", "c"]);
    expect(topBySeniority(ranked, 0)).toEqual([]);
  });
});
