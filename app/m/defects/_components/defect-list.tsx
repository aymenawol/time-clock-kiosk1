"use client";

import { Camera, CheckCircle2, ClipboardCheck, PauseCircle, Wrench } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { VehicleStatusPill } from "@/components/domain/status";
import { SHOP_STATUSES } from "@/components/field/rules";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Checkbox, Field, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import type { VehicleStatus } from "@/lib/supabase/types";
import { addDefectPhoto, deferDefect, resolveDefect, startWork } from "../actions";

export interface QueueDefect {
  id: string;
  category: string;
  item: string;
  description: string | null;
  severity: string;
  status: string;
  createdAt: string;
  ago: string;
  fromInspection: boolean;
  note: string | null;
  assignedToMe: boolean;
  assignee: string | null;
  reporter: string | null;
  vehicle: { id: string; number: string; status: VehicleStatus } | null;
  /** Other open critical or major defects on the same vehicle. */
  blocking: number;
  photos: { path: string; url: string | null }[];
}

const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  major: { label: "Major", tone: "warning" },
  minor: { label: "Minor", tone: "neutral" },
};
const STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "info" },
  in_progress: { label: "In progress", tone: "primary" },
  deferred: { label: "Deferred", tone: "neutral" },
};

type Filter = "all" | "mine" | "critical";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const MAX_BYTES = 10 * 1024 * 1024;

export function DefectList({ defects, organizationId }: { defects: QueueDefect[]; organizationId: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [closing, setClosing] = useState<{ defect: QueueDefect; mode: "resolve" | "defer" } | null>(null);

  const counts = {
    all: defects.length,
    mine: defects.filter((d) => d.assignedToMe).length,
    critical: defects.filter((d) => d.severity === "critical").length,
  };
  const shown = defects.filter((d) =>
    filter === "mine" ? d.assignedToMe : filter === "critical" ? d.severity === "critical" : true,
  );

  if (!defects.length) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardCheck}
          title="No open defects"
          description="Defects from inspections and reports show up here as soon as they are filed."
        />
      </Card>
    );
  }

  return (
    <>
      <div role="tablist" aria-label="Filter defects" className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-surface-2 p-1">
        {(["all", "mine", "critical"] as const).map((f) => (
          <button
            key={f}
            role="tab"
            type="button"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-10 rounded text-sm font-medium transition-colors",
              filter === f ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {f === "all" ? "All" : f === "mine" ? "Mine" : "Critical"} <span className="tabular text-muted">{counts[f]}</span>
          </button>
        ))}
      </div>

      {shown.length ? (
        <ul className="flex flex-col gap-3">
          {shown.map((d) => (
            <li key={d.id}>
              <DefectCard defect={d} organizationId={organizationId} onClose={(mode) => setClosing({ defect: d, mode })} />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState title={filter === "mine" ? "Nothing assigned to you" : "No critical defects"} />
        </Card>
      )}

      <Dialog open={closing !== null} onOpenChange={(o) => !o && setClosing(null)}>
        {closing ? (
          <CloseDialog key={closing.defect.id + closing.mode} {...closing} onDone={() => setClosing(null)} />
        ) : null}
      </Dialog>
    </>
  );
}

function DefectCard({
  defect: d,
  organizationId,
  onClose,
}: {
  defect: QueueDefect;
  organizationId: string;
  onClose: (mode: "resolve" | "defer") => void;
}) {
  const [runStart, starting] = useAction(startWork, { success: "Assigned to you" });
  const [runPhoto] = useAction(addDefectPhoto, { success: "Photo added" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sev = SEVERITY[d.severity] ?? SEVERITY.minor;
  const st = STATUS[d.status] ?? STATUS.open;
  const working = d.status === "in_progress" && d.assignedToMe;

  async function upload(file: File) {
    const ext = EXT[file.type] ?? file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) {
      toast.error("Use a JPEG, PNG, WebP or HEIC photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That photo is over 10 MB. Take a smaller one.");
      return;
    }
    setUploading(true);
    try {
      const path = `${organizationId}/${d.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await createClient()
        .storage.from("defect-photos")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) {
        toast.error("The photo could not be uploaded. Check your connection and try again.");
        return;
      }
      await runPhoto({ id: d.id, path });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Card className={cn("overflow-hidden", d.severity === "critical" && "border-danger/50")}>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={sev.tone} dot>
            {sev.label}
          </Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
          {d.fromInspection ? <Badge tone="neutral">From inspection</Badge> : null}
        </div>
        <p className="mt-2 text-lg font-semibold leading-snug text-fg">{d.item}</p>
        <p className="text-sm text-muted">{d.category}</p>
        {d.vehicle ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-medium text-fg">Vehicle {d.vehicle.number}</span>
            <VehicleStatusPill status={d.vehicle.status} />
          </div>
        ) : null}
        {d.description ? <p className="mt-2 whitespace-pre-line text-sm text-fg">{d.description}</p> : null}
        {d.status === "deferred" && d.note ? (
          <p className="mt-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-muted">
            <span className="font-medium text-fg">Deferred:</span> {d.note}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted">
          Reported {d.ago}
          {d.reporter ? ` by ${d.reporter}` : ""}
          {d.assignee ? ` · ${d.assignedToMe ? "assigned to you" : `assigned to ${d.assignee}`}` : ""}
        </p>

        {d.photos.length ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Photos">
            {d.photos.map((p, i) =>
              p.url ? (
                <li key={p.path}>
                  <a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-control)] border border-border">
                    {/* Signed storage URLs; next/image would need the bucket host configured. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={`Photo ${i + 1} of ${d.item}`} className="size-20 object-cover" loading="lazy" />
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border bg-surface-2/50 p-3">
        {working ? (
          <Button size="lg" variant="success" onClick={() => onClose("resolve")}>
            <CheckCircle2 /> Resolve
          </Button>
        ) : (
          <Button size="lg" loading={starting} onClick={() => void runStart({ id: d.id })}>
            <Wrench /> {d.status === "in_progress" ? "Take over" : "Start work"}
          </Button>
        )}
        <Button size="lg" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
          <Camera /> Add photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {!working ? (
          <Button size="lg" variant="ghost" onClick={() => onClose("resolve")}>
            <CheckCircle2 /> Resolve
          </Button>
        ) : null}
        {d.status !== "deferred" && d.severity !== "critical" ? (
          <Button size="lg" variant="ghost" onClick={() => onClose("defer")} className={cn(working && "col-span-2")}>
            <PauseCircle /> Defer
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function CloseDialog({
  defect: d,
  mode,
  onDone,
}: {
  defect: QueueDefect;
  mode: "resolve" | "defer";
  onDone: () => void;
}) {
  const vehicleOut = d.vehicle ? SHOP_STATUSES.includes(d.vehicle.status) : false;
  const canRelease = vehicleOut && d.blocking === 0;
  const [note, setNote] = useState("");
  const [release, setRelease] = useState(canRelease);
  const opts = {
    onSuccess: (data: { kept: string | null }) => {
      if (data.kept) toast.warning(data.kept);
      onDone();
    },
  };
  const [runResolve, resolving, resolveErrors] = useAction(resolveDefect, { success: "Defect resolved", ...opts });
  const [runDefer, deferring, deferErrors] = useAction(deferDefect, { success: "Defect deferred", ...opts });
  const errors = mode === "resolve" ? resolveErrors : deferErrors;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input = { id: d.id, note, releaseVehicle: canRelease && release };
    void (mode === "resolve" ? runResolve(input) : runDefer(input));
  }

  return (
    <DialogContent
      title={mode === "resolve" ? "Resolve defect" : "Defer defect"}
      description={`${d.item}${d.vehicle ? ` · Vehicle ${d.vehicle.number}` : ""}`}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label={mode === "resolve" ? "What did you fix?" : "Why is it deferred?"}
          htmlFor="close-note"
          hint={mode === "defer" ? "For example, waiting for a part. The vehicle can keep running." : undefined}
          error={errors.note?.[0]}
        >
          <Textarea
            id="close-note"
            required
            minLength={3}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </Field>
        {d.vehicle && vehicleOut ? (
          canRelease ? (
            <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border px-3 py-3">
              <Checkbox className="mt-0.5 size-5" checked={release} onChange={(e) => setRelease(e.target.checked)} />
              <span className="text-sm">
                <span className="font-medium text-fg">Set vehicle {d.vehicle.number} back to ready</span>
                <span className="block text-muted">No other critical or major defects are open on it.</span>
              </span>
            </label>
          ) : (
            <p className="rounded-[var(--radius-control)] bg-warning-soft px-3 py-2 text-sm text-warning">
              Vehicle {d.vehicle.number} stays out of service: {d.blocking} other critical or major defect
              {d.blocking === 1 ? " is" : "s are"} still open.
            </p>
          )
        ) : null}
        <Button
          type="submit"
          size="xl"
          variant={mode === "resolve" ? "success" : "primary"}
          className="w-full"
          loading={resolving || deferring}
          disabled={note.trim().length < 3}
        >
          {mode === "resolve" ? "Mark resolved" : "Defer defect"}
        </Button>
      </form>
    </DialogContent>
  );
}
