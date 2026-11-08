"use client";

import { Check, Radio } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { fmtTime } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";
import { setRadioStatus } from "./actions";

export type RadioCode = Pick<Tables<"radio_codes">, "id" | "code" | "label" | "is_alert">;

export function RadioPanel({
  codes,
  current,
  currentAt,
  timeZone,
  clock24h,
}: {
  codes: RadioCode[];
  current: string | null;
  currentAt: string | null;
  timeZone: string;
  clock24h: boolean;
}) {
  const [sending, setSending] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const disarm = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [run] = useAction(setRadioStatus, { success: (d) => `Sent ${d.code} ${d.label}` });

  useEffect(() => () => {
    if (disarm.current) clearTimeout(disarm.current);
  }, []);

  if (!codes.length) return null;
  const currentCode = codes.find((c) => c.code === current);

  async function press(c: RadioCode) {
    // Alert codes notify dispatch loudly, so they take a second tap.
    if (c.is_alert && armed !== c.code) {
      setArmed(c.code);
      if (disarm.current) clearTimeout(disarm.current);
      disarm.current = setTimeout(() => setArmed(null), 4000);
      return;
    }
    setArmed(null);
    setSending(c.code);
    await run({ code: c.code });
    setSending(null);
  }

  return (
    <Card>
      <CardHeader
        title="Radio status"
        description={
          current ? (
            <span className="inline-flex items-center gap-1.5">
              <Radio className="size-3.5" aria-hidden />
              <span className="font-mono font-semibold text-fg">{current}</span>
              {currentCode ? currentCode.label : null}
              {currentAt ? <span>· since {fmtTime(currentAt, timeZone, clock24h)}</span> : null}
            </span>
          ) : (
            "No status sent yet this shift"
          )
        }
      />
      <div className="grid grid-cols-2 gap-2 p-4 min-[400px]:grid-cols-3">
        {codes.map((c) => {
          const isCurrent = c.code === current;
          const isArmed = armed === c.code;
          return (
            <button
              key={c.id}
              type="button"
              disabled={sending !== null}
              aria-pressed={isCurrent}
              aria-label={isArmed ? `Tap again to send ${c.code} ${c.label}` : `${c.code} ${c.label}`}
              onClick={() => void press(c)}
              className={cn(
                "relative flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] border px-2 py-2 text-center transition-colors disabled:opacity-60",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                c.is_alert
                  ? isArmed
                    ? "border-danger bg-danger text-white"
                    : "border-danger/40 bg-danger-soft text-danger hover:border-danger"
                  : isCurrent
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-fg hover:bg-surface-2",
              )}
            >
              {isCurrent ? <Check className="absolute right-1.5 top-1.5 size-3.5" aria-hidden /> : null}
              <span className="font-mono text-lg font-semibold tabular">
                {sending === c.code ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : c.code}
              </span>
              <span className="text-xs font-medium leading-tight">{isArmed ? "Tap again to send" : c.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
