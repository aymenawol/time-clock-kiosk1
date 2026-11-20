/** Signature strokes, normalised 0..1. Shared by the client pad and server-rendered sheets. */
export interface SignatureStroke {
  points: [number, number][];
}

export function parseSignature(raw: unknown): SignatureStroke[] {
  if (!Array.isArray(raw)) return [];
  const out: SignatureStroke[] = [];
  for (const s of raw) {
    const pts = (s as { points?: unknown } | null)?.points;
    if (!Array.isArray(pts)) continue;
    const points = pts.filter(
      (p): p is [number, number] => Array.isArray(p) && typeof p[0] === "number" && typeof p[1] === "number",
    );
    if (points.length) out.push({ points });
  }
  return out;
}
