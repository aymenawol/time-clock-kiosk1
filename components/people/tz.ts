import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

/** An instant as a `datetime-local` input value in the organization time zone. */
export function isoToInput(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return format(new TZDate(new Date(iso), timeZone), "yyyy-MM-dd'T'HH:mm");
}

/** A `datetime-local` value typed in the organization time zone, as a UTC ISO string. */
export function inputToIso(value: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, 0, timeZone).getTime()).toISOString();
}

/** Read every field of a submitted form as strings (checkboxes become "true"/"false"). */
export function formValues(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.name) continue;
    if (el instanceof HTMLInputElement && el.type === "checkbox") out[el.name] = el.checked ? "true" : "false";
    else out[el.name] = el.value;
  }
  return out;
}
