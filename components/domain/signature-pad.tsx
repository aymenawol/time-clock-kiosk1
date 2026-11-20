"use client";

import { Eraser } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Handwritten signature, stored as vector strokes normalised to 0..1:
 *   [{ points: [[x, y], ...] }]
 * The pad and the viewer share one 4:1 box so a stored signature renders the
 * same at any size.
 */
import type { SignatureStroke } from "@/lib/signature";

export type { SignatureStroke };

export const MAX_SIGNATURE_STROKES = 60;
const ASPECT = 4;

function pathD(points: [number, number][]) {
  const pts = points.length === 1 ? [points[0], [points[0][0] + 0.002, points[0][1] + 0.002] as [number, number]] : points;
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${(x * ASPECT).toFixed(4)} ${y.toFixed(4)}`).join(" ");
}

function Strokes({ strokes }: { strokes: SignatureStroke[] }) {
  return (
    <>
      {strokes.map((s, i) => (
        <path
          key={i}
          d={pathD(s.points)}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 2 }}
        />
      ))}
    </>
  );
}

/** Drawing pad. Calls onChange with the full stroke list after every stroke. */
export function SignaturePad({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: SignatureStroke[];
  onChange: (strokes: SignatureStroke[]) => void;
  /** Accessible name, for example "Operator signature". */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [drawing, setDrawing] = useState<SignatureStroke | null>(null);
  const [full, setFull] = useState(false);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  };

  function finish() {
    if (drawing && drawing.points.length) onChange([...value, drawing]);
    setDrawing(null);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <svg
        ref={ref}
        viewBox={`0 0 ${ASPECT} 1`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}. Draw with a finger or mouse.`}
        data-testid="signature-pad"
        className={cn(
          "block w-full select-none rounded-[var(--radius-control)] border border-dashed border-border-strong bg-surface text-fg",
          disabled ? "opacity-60" : "cursor-crosshair",
        )}
        style={{ aspectRatio: String(ASPECT), touchAction: "none" }}
        onPointerDown={(e) => {
          if (disabled) return;
          if (value.length >= MAX_SIGNATURE_STROKES) {
            setFull(true);
            return;
          }
          setFull(false);
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setDrawing({ points: [point(e)] });
        }}
        onPointerMove={(e) => {
          if (!drawing) return;
          const p = point(e);
          const last = drawing.points[drawing.points.length - 1];
          // Skip near-duplicate points to keep the stored signature small.
          if (Math.abs(p[0] - last[0]) * ASPECT + Math.abs(p[1] - last[1]) < 0.004) return;
          if (drawing.points.length >= 1400) return;
          setDrawing({ points: [...drawing.points, p] });
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        <line x1="0.1" x2={ASPECT - 0.1} y1="0.78" y2="0.78" stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <Strokes strokes={drawing ? [...value, drawing] : value} />
      </svg>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={disabled || (!value.length && !drawing)} onClick={() => onChange([])}>
          <Eraser /> Clear
        </Button>
        <p className="text-xs text-muted" aria-live="polite">
          {full ? "That is the most strokes allowed. Clear and sign again." : value.length ? "Signed." : "Sign above the line."}
        </p>
      </div>
    </div>
  );
}

/** Read-only rendering of a stored signature. */
export function SignatureView({
  value,
  label,
  className,
}: {
  value: SignatureStroke[] | null | undefined;
  label: string;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${ASPECT} 1`}
      preserveAspectRatio="none"
      role="img"
      aria-label={value?.length ? label : `${label}: not signed`}
      className={cn("block w-full text-fg", className)}
      style={{ aspectRatio: String(ASPECT) }}
    >
      <Strokes strokes={value ?? []} />
    </svg>
  );
}

/** Parse stored JSON into strokes, dropping anything malformed. */
