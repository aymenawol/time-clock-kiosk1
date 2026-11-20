"use client";

import { Eraser, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Vehicle damage diagram, like the paper form: Left Side, Right Side, Rear End
 * and Front End line drawings of a 40-ft transit bus. A tap marks damage with
 * an X. Stored in inspections.damage as strokes:
 *   [{ view: "front" | "rear" | "left" | "right", points: [[x, y], ...] }]
 * with x and y normalised to 0..1 inside the view. An X is two short strokes.
 */
export type DamageView = "front" | "rear" | "left" | "right";
export interface DamageStroke {
  view: DamageView;
  points: [number, number][];
}

const SIDE = { w: 300, h: 100 };
const END = { w: 120, h: 100 };

const VIEWS: { id: DamageView; label: string; box: { w: number; h: number } }[] = [
  { id: "left", label: "Left Side", box: SIDE },
  { id: "right", label: "Right Side", box: SIDE },
  { id: "rear", label: "Rear End", box: END },
  { id: "front", label: "Front End", box: END },
];

/** Side view facing right: front on the right. The left side is the mirror image. */
function SideBus({ doors }: { doors: boolean }) {
  const windows: number[] = [];
  for (let x = 18; x <= 100; x += 26) windows.push(x);
  const all: number[] = [];
  for (let x = 18; x <= 212; x += 26) all.push(x);
  const front: number[] = [];
  for (let x = 160; x <= 190; x += 26) front.push(x);
  return (
    <g transform={doors ? undefined : "translate(300 0) scale(-1 1)"}>
      {/* body */}
      <path d="M6 74 L6 18 Q6 12 12 12 L258 12 Q280 12 288 34 L294 62 Q295 74 284 74 Z" />
      {/* roof line, destination sign and windshield pillar */}
      <rect x="236" y="15" width="30" height="7" rx="1" />
      <path d="M262 24 L270 24 L284 56 L262 56 Z" />
      {/* window row */}
      {(doors ? windows : all).map((x) => (
        <rect key={x} x={x} y="24" width="22" height="24" rx="2" />
      ))}
      {doors ? (
        <>
          {/* exit door and front door */}
          <rect x="118" y="24" width="32" height="46" rx="2" />
          <line x1="134" y1="24" x2="134" y2="70" />
          {front.map((x) => (
            <rect key={x} x={x} y="24" width="22" height="24" rx="2" />
          ))}
          <rect x="216" y="24" width="38" height="46" rx="2" />
          <line x1="235" y1="24" x2="235" y2="70" />
        </>
      ) : null}
      {/* wheels and wheel wells */}
      <path d="M44 74 A20 20 0 0 1 84 74" />
      <path d="M206 74 A20 20 0 0 1 246 74" />
      <circle cx="64" cy="76" r="14" />
      <circle cx="64" cy="76" r="5" />
      <circle cx="226" cy="76" r="14" />
      <circle cx="226" cy="76" r="5" />
      {/* bumpers and ground line */}
      <line x1="2" y1="62" x2="6" y2="62" />
      <line x1="294" y1="66" x2="298" y2="66" />
    </g>
  );
}

function FrontBus() {
  return (
    <g>
      <rect x="22" y="8" width="76" height="76" rx="9" />
      <rect x="32" y="11" width="56" height="8" rx="1" />
      <rect x="28" y="22" width="64" height="32" rx="3" />
      <line x1="60" y1="22" x2="60" y2="54" />
      <circle cx="33" cy="66" r="4.5" />
      <circle cx="87" cy="66" r="4.5" />
      <rect x="47" y="60" width="26" height="12" rx="2" />
      <line x1="47" y1="66" x2="73" y2="66" />
      <rect x="22" y="78" width="76" height="6" rx="2" />
      <rect x="14" y="68" width="8" height="22" rx="1.5" />
      <rect x="98" y="68" width="8" height="22" rx="1.5" />
      <rect x="10" y="26" width="8" height="18" rx="1.5" />
      <rect x="102" y="26" width="8" height="18" rx="1.5" />
    </g>
  );
}

function RearBus() {
  return (
    <g>
      <rect x="22" y="8" width="76" height="76" rx="6" />
      <rect x="34" y="14" width="52" height="26" rx="3" />
      <line x1="60" y1="14" x2="60" y2="40" />
      <rect x="30" y="46" width="60" height="28" rx="2" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="34" x2="86" y1={51 + i * 5} y2={51 + i * 5} />
      ))}
      <rect x="24" y="50" width="4" height="14" rx="1" />
      <rect x="92" y="50" width="4" height="14" rx="1" />
      <rect x="22" y="78" width="76" height="6" rx="2" />
      <rect x="12" y="68" width="10" height="22" rx="1.5" />
      <rect x="98" y="68" width="10" height="22" rx="1.5" />
    </g>
  );
}

function Outline({ view }: { view: DamageView }) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
      vectorEffect="non-scaling-stroke"
      className="text-fg"
      style={{ strokeWidth: 1.25 }}
    >
      {view === "left" ? <SideBus doors={false} /> : null}
      {view === "right" ? <SideBus doors /> : null}
      {view === "front" ? <FrontBus /> : null}
      {view === "rear" ? <RearBus /> : null}
    </g>
  );
}

/** Two short strokes crossing at (x, y). Sized in pixels, so it looks square at any aspect. */
function crossAt(view: DamageView, x: number, y: number, aspect: number): DamageStroke[] {
  const dx = 0.025;
  const dy = Math.min(0.1, dx * aspect);
  const cl = (n: number) => Math.min(1, Math.max(0, n));
  return [
    { view, points: [[cl(x - dx), cl(y - dy)], [cl(x + dx), cl(y + dy)]] },
    { view, points: [[cl(x - dx), cl(y + dy)], [cl(x + dx), cl(y - dy)]] },
  ];
}

/** How many marks the strokes represent (an X is two strokes). */
export function damageMarkCount(strokes: DamageStroke[]): number {
  const twoPoint = strokes.filter((s) => s.points.length === 2).length;
  return strokes.length - twoPoint + Math.ceil(twoPoint / 2);
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
  const editable = !readOnly && Boolean(onChange);

  function undo() {
    const n = value.length;
    const pair = n >= 2 && value[n - 1].points.length === 2 && value[n - 2].points.length === 2;
    onChange?.(value.slice(0, n - (pair ? 2 : 1)));
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[3fr_3fr_1.2fr_1.2fr]">
        {VIEWS.map((v) => {
          const strokes = value.filter((s) => s.view === v.id);
          const marks = damageMarkCount(strokes);
          return (
            <figure key={v.id} className={cn("min-w-0 rounded-[var(--radius-control)] border border-border bg-surface p-2", v.box === SIDE && "col-span-2 sm:col-span-1")}>
              <figcaption className="mb-1 text-center text-xs font-semibold tracking-wide text-fg">{v.label}</figcaption>
              <svg
                viewBox={`0 0 ${v.box.w} ${v.box.h}`}
                className={cn("block w-full select-none", editable && "cursor-crosshair")}
                style={{ aspectRatio: `${v.box.w} / ${v.box.h}`, touchAction: "pan-y" }}
                role="img"
                aria-label={`${v.label} diagram${editable ? ". Tap where there is damage to mark an X" : ""}${marks ? `, ${marks} mark${marks === 1 ? "" : "s"}` : ""}`}
                onClick={(e) => {
                  if (!editable) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - r.left) / r.width;
                  const y = (e.clientY - r.top) / r.height;
                  onChange?.([...value, ...crossAt(v.id, x, y, v.box.w / v.box.h)]);
                }}
              >
                <Outline view={v.id} />
                {strokes.map((s, i) => (
                  <path
                    key={i}
                    d={(s.points.length === 1 ? [s.points[0], [s.points[0][0] + 0.004, s.points[0][1] + 0.004]] : s.points)
                      .map(([x, y], j) => `${j ? "L" : "M"}${(x * v.box.w).toFixed(2)} ${(y * v.box.h).toFixed(2)}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--danger)"
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
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={!value.length} onClick={undo}>
            <Undo2 /> Undo
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={!value.length} onClick={() => onChange?.([])}>
            <Eraser /> Clear
          </Button>
          <p className="text-xs text-muted">Tap the bus where you see damage to mark an X.</p>
        </div>
      ) : null}
    </div>
  );
}
