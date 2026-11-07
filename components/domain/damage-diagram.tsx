"use client";

import { Eraser, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Vehicle damage diagram. Stored in inspections.damage as:
 *   [{ view: "front" | "rear" | "left" | "right", points: [[x, y], ...] }]
 * with x and y normalised to 0..1 inside the view, so it renders at any size.
 */
export type DamageView = "front" | "rear" | "left" | "right";
export interface DamageStroke {
  view: DamageView;
  points: [number, number][];
}

const VIEWS: { id: DamageView; label: string; aspect: number }[] = [
  { id: "left", label: "Driver side", aspect: 3 },
  { id: "right", label: "Curb side", aspect: 3 },
  { id: "front", label: "Front", aspect: 1.2 },
  { id: "rear", label: "Rear", aspect: 1.2 },
];

function Outline({ view }: { view: DamageView }) {
  if (view === "left" || view === "right") {
    return (
      <g fill="none" stroke="currentColor" strokeWidth="0.006" className="text-border-strong">
        <rect x="0.03" y="0.12" width="0.94" height="0.66" rx="0.04" />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={0.1 + i * 0.115} y="0.2" width="0.09" height="0.22" rx="0.01" />
        ))}
        <circle cx="0.2" cy="0.8" r="0.09" />
        <circle cx="0.8" cy="0.8" r="0.09" />
      </g>
    );
  }
  return (
    <g fill="none" stroke="currentColor" strokeWidth="0.008" className="text-border-strong">
      <rect x="0.12" y="0.08" width="0.76" height="0.78" rx="0.06" />
      <rect x="0.2" y="0.15" width="0.6" height="0.3" rx="0.03" />
      <circle cx="0.27" cy="0.66" r="0.05" />
      <circle cx="0.73" cy="0.66" r="0.05" />
      <rect x="0.18" y="0.86" width="0.12" height="0.08" />
      <rect x="0.7" y="0.86" width="0.12" height="0.08" />
    </g>
  );
}

function path(points: [number, number][]) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(4)} ${y.toFixed(4)}`).join(" ");
}

export function DamageDiagram({
  value,
  onChange,
  readOnly,
  className,
}: {
  value: DamageStroke[];
  onChange?: (strokes: DamageStroke[]) => void;
  readOnly?: boolean;
  className?: string;
}) {
  const [drawing, setDrawing] = useState<DamageStroke | null>(null);
  const svgRefs = useRef<Partial<Record<DamageView, SVGSVGElement | null>>>({});
  const editable = !readOnly && Boolean(onChange);

  const point = (view: DamageView, e: React.PointerEvent): [number, number] | null => {
    const svg = svgRefs.current[view];
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {VIEWS.map((v) => {
          const strokes = value.filter((s) => s.view === v.id);
          return (
            <figure key={v.id} className="rounded-[var(--radius-control)] border border-border bg-surface-2 p-2">
              <figcaption className="mb-1 text-xs font-medium text-muted">{v.label}</figcaption>
              <svg
                ref={(el) => {
                  svgRefs.current[v.id] = el;
                }}
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className={cn("w-full touch-none select-none bg-surface", editable && "cursor-crosshair")}
                style={{ aspectRatio: String(v.aspect) }}
                role={editable ? "img" : undefined}
                aria-label={`${v.label} damage diagram${strokes.length ? `, ${strokes.length} marks` : ""}`}
                onPointerDown={(e) => {
                  if (!editable) return;
                  const p = point(v.id, e);
                  if (!p) return;
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  setDrawing({ view: v.id, points: [p] });
                }}
                onPointerMove={(e) => {
                  if (!drawing || drawing.view !== v.id) return;
                  const p = point(v.id, e);
                  if (p) setDrawing({ ...drawing, points: [...drawing.points, p] });
                }}
                onPointerUp={() => {
                  if (drawing && onChange) onChange([...value, drawing]);
                  setDrawing(null);
                }}
              >
                <Outline view={v.id} />
                {[...strokes, ...(drawing?.view === v.id ? [drawing] : [])].map((s, i) => (
                  <path
                    key={i}
                    d={path(s.points.length === 1 ? [s.points[0], [s.points[0][0] + 0.004, s.points[0][1] + 0.004]] : s.points)}
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth="0.012"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    style={{ strokeWidth: 3 }}
                  />
                ))}
              </svg>
            </figure>
          );
        })}
      </div>
      {editable ? (
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={!value.length} onClick={() => onChange?.(value.slice(0, -1))}>
            <Undo2 /> Undo
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!value.length} onClick={() => onChange?.([])}>
            <Eraser /> Clear
          </Button>
          <p className="self-center text-xs text-muted">Draw on the vehicle where you see damage.</p>
        </div>
      ) : null}
    </div>
  );
}
