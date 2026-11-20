/** Shared by the /platform form (client) and the create action (server). No secrets here. */
export const US_TIME_ZONES: { value: string; label: string }[] = [
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Mountain, no DST (Phoenix)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
];

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;

/** Suggest a slug from a company name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 49)
    .replace(/-+$/g, "");
}
