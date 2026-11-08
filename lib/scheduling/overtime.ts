import { bySeniority, type SeniorityKey } from "./seniority";

export interface OtBidder extends SeniorityKey {
  /** Minutes already worked in the workweek that contains the offer. */
  currentWeekMinutes: number;
}

export type RankedOtBidder<T extends OtBidder = OtBidder> = T & {
  /** 1-based seniority position among the bidders. */
  rank: number;
  /** Week minutes if this bidder also works the offer. */
  projectedWeekMinutes: number;
  exceedsWeeklyLimit: boolean;
};

/**
 * Order overtime bidders by seniority and flag anyone the offer would push
 * past the weekly hours limit (fatigue setting). Flagged bidders keep their
 * place; the office decides whether to skip them.
 */
export function rankOtBidders<T extends OtBidder>(
  bidders: readonly T[],
  offerMinutes: number,
  maxWeeklyMinutes: number,
): RankedOtBidder<T>[] {
  return bySeniority(bidders).map((b, i) => {
    const projected = Math.max(0, b.currentWeekMinutes) + Math.max(0, offerMinutes);
    return { ...b, rank: i + 1, projectedWeekMinutes: projected, exceedsWeeklyLimit: projected > maxWeeklyMinutes };
  });
}

/** The most senior `slots` bidders who stay within the weekly limit. */
export function topBySeniority<T extends OtBidder>(ranked: readonly RankedOtBidder<T>[], slots: number): RankedOtBidder<T>[] {
  return ranked.filter((b) => !b.exceedsWeeklyLimit).slice(0, Math.max(0, slots));
}
