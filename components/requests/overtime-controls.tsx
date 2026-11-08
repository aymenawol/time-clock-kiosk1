"use client";

import { useState } from "react";
import { bidOnOffer, respondOffDay, withdrawOfferBid } from "@/app/m/overtime/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";

export function OfferBidButton({ offerId, bid }: { offerId: string; bid: boolean }) {
  const [place, placing] = useAction(bidOnOffer, { success: "Your bid is in" });
  const [withdraw, withdrawing] = useAction(withdrawOfferBid, { success: "Bid withdrawn" });
  return bid ? (
    <Button variant="secondary" size="lg" className="w-full" loading={withdrawing} onClick={() => void withdraw({ offerId })}>
      Withdraw my bid
    </Button>
  ) : (
    <Button size="lg" className="w-full" loading={placing} onClick={() => void place({ offerId })}>
      Bid for this overtime
    </Button>
  );
}

export function OffDayResponse({ id }: { id: string }) {
  const [response, setResponse] = useState<"accepted" | "declined" | "partial">("accepted");
  const [from, setFrom] = useState("");
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [run, pending, errors] = useAction(respondOffDay, { success: "Response sent" });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({
          id,
          response,
          availableFrom: response === "partial" ? from || undefined : undefined,
          availableHours: response === "partial" && hours ? Number(hours) : undefined,
          note: note || undefined,
        });
      }}
    >
      <Field label="Your answer" htmlFor={`r-${id}`}>
        <Select id={`r-${id}`} className="h-12" value={response} onChange={(e) => setResponse(e.target.value as typeof response)}>
          <option value="accepted">I can work</option>
          <option value="partial">I can work part of the day</option>
          <option value="declined">I cannot work</option>
        </Select>
      </Field>
      {response === "partial" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Available from" htmlFor={`f-${id}`} error={errors.availableFrom?.[0]}>
            <Input id={`f-${id}`} type="time" className="h-12 text-base" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Hours" htmlFor={`h-${id}`} error={errors.availableHours?.[0]}>
            <Input id={`h-${id}`} type="number" inputMode="decimal" step="0.25" min="0.25" max="16" className="h-12 text-base" value={hours} onChange={(e) => setHours(e.target.value)} />
          </Field>
        </div>
      ) : null}
      <Field label="Note (optional)" htmlFor={`n-${id}`}>
        <Input id={`n-${id}`} className="h-12 text-base" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send answer
      </Button>
    </form>
  );
}
