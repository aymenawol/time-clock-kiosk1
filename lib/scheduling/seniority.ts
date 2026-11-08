/**
 * Seniority order used by shift bids and overtime awards:
 * seniority number ascending (missing numbers last), then hire date ascending
 * (missing dates last), then id so the order is always stable.
 */
export interface SeniorityKey {
  id: string;
  seniorityNumber: number | null;
  /** yyyy-MM-dd */
  hireDate: string | null;
}

export function compareSeniority(a: SeniorityKey, b: SeniorityKey): number {
  const sa = a.seniorityNumber;
  const sb = b.seniorityNumber;
  if (sa !== sb) {
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  }
  const ha = a.hireDate;
  const hb = b.hireDate;
  if (ha !== hb) {
    if (ha === null) return 1;
    if (hb === null) return -1;
    return ha < hb ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function bySeniority<T extends SeniorityKey>(items: readonly T[]): T[] {
  return [...items].sort(compareSeniority);
}
