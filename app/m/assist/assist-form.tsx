"use client";

import { AlertTriangle, Check, Send } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { createAssist } from "./actions";

export interface AirlineOption {
  id: string;
  name: string;
  code: string | null;
  contact: string | null;
  location: string | null;
}

export function AssistForm({
  airlines,
  busNumber,
  openCount,
  escalationMinutes,
}: {
  airlines: AirlineOption[];
  busNumber: string | null;
  openCount: number;
  escalationMinutes: number;
}) {
  const listId = useId();
  const [passenger, setPassenger] = useState("");
  const [query, setQuery] = useState("");
  const [airlineId, setAirlineId] = useState("");
  const [open, setOpen] = useState(false);
  const [flight, setFlight] = useState("");

  const [run, pending, errors] = useAction(createAssist, {
    success: "Request sent to dispatch",
    onSuccess: () => {
      setPassenger("");
      setQuery("");
      setAirlineId("");
      setFlight("");
    },
  });

  const selected = airlines.find((a) => a.id === airlineId) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airlines.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.code ?? "").toLowerCase().includes(q));
  }, [airlines, query]);
  const ready = passenger.trim() && airlineId && flight.trim();

  function pick(a: AirlineOption) {
    setAirlineId(a.id);
    setQuery(a.name);
    setOpen(false);
  }

  return (
    <Card>
      <CardHeader title="New request" />
      <CardBody>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void run({ passengerName: passenger, airlineId, flightNumber: flight });
          }}
        >
          {openCount > 0 ? (
            <p
              role="status"
              className="flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              You already have {openCount} open request{openCount === 1 ? "" : "s"} today.
            </p>
          ) : null}

          <Field label="Bus number">
            <div className="flex h-12 items-center rounded-[var(--radius-control)] border border-border bg-surface-2 px-3 text-fg">
              {busNumber ?? "N/A"}
            </div>
          </Field>

          <Field label="Passenger name" htmlFor="as-passenger" error={errors.passengerName?.[0]}>
            <Input
              id="as-passenger"
              className="h-12 text-base"
              placeholder="Full name"
              autoComplete="off"
              required
              maxLength={120}
              value={passenger}
              onChange={(e) => setPassenger(e.target.value)}
            />
          </Field>

          <Field
            label="Airline"
            htmlFor="as-airline"
            error={errors.airlineId?.[0]}
            hint={
              selected
                ? [selected.location, selected.contact ? `Contact: ${selected.contact}` : null].filter(Boolean).join(" · ") || undefined
                : undefined
            }
          >
            <div className="relative">
              <Input
                id="as-airline"
                className="h-12 text-base"
                placeholder="Search airline"
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                value={query}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setAirlineId("");
                  setOpen(true);
                }}
              />
              {selected ? (
                <Check className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-success" aria-hidden />
              ) : null}
              {open && !selected ? (
                <ul
                  id={listId}
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-[var(--radius-control)] border border-border bg-surface shadow-[var(--shadow-pop)]"
                >
                  {matches.length ? (
                    matches.map((a) => (
                      <li key={a.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pick(a)}
                          className={cn(
                            "flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left text-sm text-fg hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none",
                          )}
                        >
                          <span>{a.name}</span>
                          <span className="text-xs text-muted">{a.location ?? a.code}</span>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-3 text-sm text-muted">
                      {airlines.length ? "No airlines match" : "No airlines set up yet. Ask an admin."}
                    </li>
                  )}
                </ul>
              ) : null}
            </div>
          </Field>

          <Field label="Flight number" htmlFor="as-flight" error={errors.flightNumber?.[0]}>
            <Input
              id="as-flight"
              className="h-12 text-base uppercase"
              placeholder="e.g. WN 1234"
              autoComplete="off"
              required
              maxLength={12}
              value={flight}
              onChange={(e) => setFlight(e.target.value)}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Button type="submit" size="xl" className="w-full" loading={pending} disabled={!ready}>
              <Send /> Submit 10-51 request
            </Button>
            <p className="text-center text-xs text-muted">
              If dispatch has not answered in {escalationMinutes} minute{escalationMinutes === 1 ? "" : "s"}, you will be told to
              call them.
            </p>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
