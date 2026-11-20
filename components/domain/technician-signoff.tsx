"use client";

import { PenLine } from "lucide-react";
import { useState } from "react";
import { signInspection } from "@/app/m/inspection/actions";
import { SignaturePad, type SignatureStroke } from "@/components/domain/signature-pad";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";

/** Technician's Comments and Signature. Shown until someone signs, then the sheet shows them read-only. */
export function TechnicianSignoff({ inspectionId }: { inspectionId: string }) {
  const [comments, setComments] = useState("");
  const [signature, setSignature] = useState<SignatureStroke[]>([]);
  const [run, pending] = useAction(signInspection, { success: "Inspection signed" });

  return (
    <form
      className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-border bg-surface-2/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ inspectionId, comments, signature });
      }}
    >
      <Field label="Technician's comments" htmlFor="tech-comments" hint="Optional. What you checked or repaired.">
        <Textarea id="tech-comments" maxLength={2000} value={comments} onChange={(e) => setComments(e.target.value)} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium text-fg">Technician&apos;s signature</p>
        <SignaturePad value={signature} onChange={setSignature} label="Technician signature pad" />
      </div>
      <Button type="submit" size="lg" loading={pending} disabled={!signature.length}>
        <PenLine /> Sign inspection
      </Button>
    </form>
  );
}
