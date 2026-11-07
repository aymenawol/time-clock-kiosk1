"use client";

import { AlertTriangle, ArrowLeft, Coffee, LogIn, LogOut, TimerReset, Utensils } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/brand";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime } from "@/lib/format";
import { punch, verifyPin, type KioskEmployeeState, type PunchOutcome } from "./actions";
import { Keypad } from "./keypad";

type Step = "number" | "pin" | "actions" | "done";

const ACTION_META = {
  clock_in: { label: "Clock in", icon: LogIn, variant: "success" as const },
  clock_out: { label: "Clock out", icon: LogOut, variant: "danger" as const },
  start_rest: { label: "Start rest break", icon: Coffee, variant: "secondary" as const },
  start_meal: { label: "Start meal break", icon: Utensils, variant: "secondary" as const },
  end_break: { label: "End break", icon: TimerReset, variant: "primary" as const },
};

function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

function useNow() {
  // Second-resolution clock; the server snapshot renders a placeholder.
  return useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / 1000), () => 0);
}

export function KioskClock({
  organizationName,
  deviceName,
  timeZone,
  clock24h,
  idleResetSeconds,
}: {
  organizationName: string;
  deviceName: string;
  timeZone: string;
  clock24h: boolean;
  idleResetSeconds: number;
}) {
  const nowSec = useNow();
  const [step, setStep] = useState<Step>("number");
  const [number, setNumber] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [employee, setEmployee] = useState<KioskEmployeeState | null>(null);
  const [outcome, setOutcome] = useState<PunchOutcome | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    setStep("number");
    setNumber("");
    setPin("");
    setError(null);
    setEmployee(null);
    setOutcome(null);
  }, []);

  // Return to the start screen when nobody touches the kiosk.
  const touch = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const seconds = step === "done" ? idleResetSeconds : step === "actions" ? 20 : 30;
    idleTimer.current = setTimeout(reset, seconds * 1000);
  }, [step, idleResetSeconds, reset]);

  useEffect(() => {
    if (step === "number" && !number) return;
    touch();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [step, number, pin, touch]);

  const submitPin = useCallback(
    async (p: string) => {
      setBusy(true);
      setError(null);
      const res = await verifyPin({ employeeNumber: number, pin: p });
      setBusy(false);
      setPin("");
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmployee(res.data);
      setStep("actions");
    },
    [number],
  );

  const onKey = useCallback(
    (key: string) => {
      setError(null);
      const setter = step === "number" ? setNumber : setPin;
      if (key === "back") setter((v) => v.slice(0, -1));
      else if (key === "clear") setter("");
      else if (/^\d$/.test(key)) setter((v) => (v.length >= 8 ? v : v + key));
    },
    [step],
  );

  const next = useCallback(() => {
    if (step === "number" && number.length >= 3) setStep("pin");
    else if (step === "pin" && pin.length >= 4) void submitPin(pin);
  }, [step, number, pin, submitPin]);

  // Physical keyboard support.
  useEffect(() => {
    if (step !== "number" && step !== "pin") return;
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) onKey(e.key);
      else if (e.key === "Backspace") onKey("back");
      else if (e.key === "Escape") reset();
      else if (e.key === "Enter") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, onKey, next, reset]);

  async function doAction(action: KioskEmployeeState["actions"][number]) {
    if (!employee) return;
    setBusy(true);
    const res = await punch({ token: employee.token, action });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      if (/took too long|PIN/.test(res.error)) reset();
      return;
    }
    setOutcome(res.data);
    setStep("done");
  }

  const now = nowSec ? new Date(nowSec * 1000) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center gap-3">
        <BrandMark className="size-8" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{organizationName}</p>
          <p className="truncate text-xs text-muted">{deviceName}</p>
        </div>
      </header>

      <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_minmax(0,440px)]">
        <section className="text-center lg:text-left" aria-live="off">
          <p className="font-mono text-6xl font-semibold tabular tracking-tight sm:text-8xl" suppressHydrationWarning>
            {now ? fmtTime(now, timeZone, clock24h) : "--:--"}
          </p>
          <p className="mt-2 text-xl text-muted sm:text-2xl" suppressHydrationWarning>
            {now ? fmtDate(now, timeZone, "EEEE, MMMM d") : ""}
          </p>
        </section>

        <section className="mx-auto w-full max-w-[440px]" aria-live="polite">
          {step === "number" || step === "pin" ? (
            <div>
              <h1 className="text-2xl font-semibold">{step === "number" ? "Enter your employee number" : "Enter your PIN"}</h1>
              <div
                className="mt-4 flex h-20 items-center justify-center rounded-[var(--radius-tile)] border-2 border-border bg-surface font-mono text-4xl tracking-[0.35em] tabular"
                aria-label={step === "number" ? `Employee number ${number}` : `PIN, ${pin.length} digits entered`}
              >
                {step === "number" ? number || <span className="text-muted/50">· · ·</span> : "●".repeat(pin.length) || <span className="text-muted/50">· · · ·</span>}
              </div>
              {error ? (
                <p role="alert" className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              ) : null}
              <div className="mt-5">
                <Keypad onKey={onKey} disabled={busy} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  variant="secondary"
                  size="xl"
                  onClick={() => (step === "pin" ? (setStep("number"), setPin("")) : reset())}
                  disabled={busy || (step === "number" && !number)}
                >
                  <ArrowLeft /> {step === "pin" ? "Back" : "Cancel"}
                </Button>
                <Button
                  size="xl"
                  onClick={next}
                  loading={busy}
                  disabled={step === "number" ? number.length < 3 : pin.length < 4}
                >
                  {step === "number" ? "Next" : "Enter"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === "actions" && employee ? (
            <div>
              <p className="text-sm uppercase tracking-wider text-muted">Hello</p>
              <h1 className="text-3xl font-semibold">{employee.name}</h1>
              <p className="mt-2 text-lg text-muted">
                {employee.onBreak
                  ? `On a ${employee.onBreak.kind} break since ${fmtTime(employee.onBreak.startedAt, timeZone, clock24h)}`
                  : employee.clockedIn
                    ? `Clocked in since ${fmtTime(employee.clockInAt, timeZone, clock24h)}`
                    : "You are not clocked in."}
              </p>
              {employee.clockedIn && !employee.onBreak && employee.nextBreaks[0] ? (
                <p className="mt-1 text-sm text-muted">
                  Next {employee.nextBreaks[0].kind} break: {fmtTime(employee.nextBreaks[0].windowStart, timeZone, clock24h)} to{" "}
                  {fmtTime(employee.nextBreaks[0].windowEnd, timeZone, clock24h)}
                  {employee.nextBreaks[0].status === "missed" ? " (window passed)" : ""}
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="mt-3 rounded-[var(--radius-control)] bg-danger-soft px-3 py-2 text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col gap-3">
                {employee.actions.map((a) => {
                  const meta = ACTION_META[a];
                  const Icon = meta.icon;
                  return (
                    <Button key={a} variant={meta.variant} size="xl" className="h-20 text-xl" onClick={() => doAction(a)} loading={busy}>
                      <Icon className="!size-6" /> {meta.label}
                    </Button>
                  );
                })}
                <Button variant="ghost" size="lg" onClick={reset} disabled={busy}>
                  Not you? Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {step === "done" && outcome ? (
            <div className="rounded-[var(--radius-tile)] border border-border bg-surface p-6">
              <h1 className="text-3xl font-semibold text-success">{outcome.title}</h1>
              <p className="mt-2 text-lg text-muted">{outcome.detail}</p>
              {outcome.warnings.length ? (
                <ul className="mt-4 flex flex-col gap-2">
                  {outcome.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2 rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-warning">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button size="xl" className={cn("mt-6 w-full")} onClick={reset}>
                Done
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
