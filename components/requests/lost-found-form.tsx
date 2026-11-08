"use client";

import { CheckCircle2, Camera } from "lucide-react";
import { useState } from "react";
import { reportLostItem } from "@/app/m/lost-found/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useAction } from "@/components/ui/use-action";
import { createClient } from "@/lib/supabase/client";
import { ErrorNote } from "./back-header";

const CATEGORIES = [
  { value: "bag", label: "Bag or luggage" },
  { value: "electronics", label: "Phone or electronics" },
  { value: "document", label: "Document or wallet" },
  { value: "clothing", label: "Clothing" },
  { value: "jewelry", label: "Jewelry" },
  { value: "other", label: "Something else" },
] as const;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 6;

function extensionOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName && fromName.length <= 5) return fromName;
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

export function LostFoundForm({
  organizationId,
  locations,
  vehicles,
}: {
  organizationId: string;
  locations: { id: string; name: string }[];
  vehicles: { id: string; number: string }[];
}) {
  const [category, setCategory] = useState("bag");
  const [description, setDescription] = useState("");
  const [contents, setContents] = useState("");
  const [locationId, setLocationId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [run, pending] = useAction(reportLostItem, { onSuccess: (d) => setReference(d.reference) });

  function pick(list: FileList | null) {
    setError(null);
    const next = [...files, ...Array.from(list ?? [])];
    const bad = next.find((f) => !f.type.startsWith("image/") || f.size > MAX_BYTES);
    if (bad) return setError(`${bad.name} must be an image under 10 MB.`);
    if (next.length > MAX_PHOTOS) return setError(`You can add up to ${MAX_PHOTOS} photos.`);
    setFiles(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (description.trim().length === 0) return setError("Describe the item first.");
    const itemId = crypto.randomUUID();
    const photoPaths: string[] = [];
    if (files.length > 0) {
      setUploading(true);
      const supabase = createClient();
      for (const file of files) {
        const path = `${organizationId}/${itemId}/${crypto.randomUUID()}.${extensionOf(file)}`;
        const { error: upErr } = await supabase.storage.from("lost-found").upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          setUploading(false);
          return setError(`Could not upload ${file.name}. Check your connection and try again.`);
        }
        photoPaths.push(path);
      }
      setUploading(false);
    }
    await run({
      itemId,
      description,
      category: category as (typeof CATEGORIES)[number]["value"],
      contents: contents || undefined,
      locationId: locationId || null,
      vehicleId: vehicleId || null,
      photoPaths,
    });
  }

  if (reference) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-success bg-success-soft p-6 text-center">
        <CheckCircle2 className="size-10 text-success" aria-hidden />
        <p className="font-semibold">Item reported</p>
        <p className="text-sm text-muted">Write this reference on the item tag.</p>
        <p className="text-3xl font-bold tracking-widest tabular">{reference}</p>
        <Button
          size="lg"
          className="mt-2 w-full"
          onClick={() => {
            setReference(null);
            setDescription("");
            setContents("");
            setFiles([]);
          }}
        >
          Report another item
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label="What is it?" htmlFor="lf-description" hint="Colour, brand, size.">
        <Input id="lf-description" className="h-12 text-base" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <Field label="Type" htmlFor="lf-category">
        <Select id="lf-category" className="h-12" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Where did you find it?" htmlFor="lf-location">
        <Select id="lf-location" className="h-12" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Not sure</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Which vehicle?" htmlFor="lf-vehicle">
        <Select id="lf-vehicle" className="h-12" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">Not on a vehicle</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              Bus {v.number}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Contents (optional)" htmlFor="lf-contents" hint="Anything visible inside that helps identify the owner.">
        <Textarea id="lf-contents" maxLength={2000} value={contents} onChange={(e) => setContents(e.target.value)} />
      </Field>
      <Field label="Photos (optional)" htmlFor="lf-photos" hint={`Up to ${MAX_PHOTOS} images, 10 MB each.`}>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-border-strong text-sm font-medium text-primary hover:bg-surface-2">
          <Camera className="size-4" aria-hidden /> Add photos
          <input
            id="lf-photos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => {
              pick(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </Field>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-xs">
              <span className="max-w-32 truncate">{f.name}</span>
              <button type="button" aria-label={`Remove ${f.name}`} className="size-6 rounded-full hover:bg-border" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button type="submit" size="xl" className="w-full" loading={pending || uploading}>
        {uploading ? "Uploading photos" : "Report item"}
      </Button>
    </form>
  );
}
