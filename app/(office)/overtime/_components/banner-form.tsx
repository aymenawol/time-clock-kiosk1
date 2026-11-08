"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { saveBanner } from "../actions";

export function BannerForm({ message, active }: { message: string; active: boolean }) {
  const [msg, setMsg] = React.useState(message);
  const [on, setOn] = React.useState(active);
  const [run, pending, errors] = useAction(saveBanner, { success: "Banner saved" });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ message: msg, active: on });
      }}
    >
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox checked={on} onChange={(e) => setOn(e.target.checked)} />
        Active
        <span className={on ? "text-xs font-normal text-success" : "text-xs font-normal text-muted"}>
          {on ? "Visible to drivers" : "Hidden"}
        </span>
      </label>
      <Field label="Message" htmlFor="banner-message" error={errors.message?.[0]}>
        <Textarea id="banner-message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} maxLength={500} />
      </Field>
      <div>
        <Button type="submit" size="sm" loading={pending}>
          Save banner
        </Button>
      </div>
    </form>
  );
}
