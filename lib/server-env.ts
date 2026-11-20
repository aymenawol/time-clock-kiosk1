import "server-only";
import { z } from "zod";

const schema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  // Signs short-lived kiosk sessions. Falls back to a key derived from the
  // Supabase secret so a missing variable never weakens the kiosk.
  KIOSK_SESSION_SECRET: z.string().min(32).optional(),
  // Comma-separated emails of the software operators who may use /platform. Empty = nobody.
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function serverEnv() {
  if (!cached) {
    cached = schema.parse({
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
      KIOSK_SESSION_SECRET: process.env.KIOSK_SESSION_SECRET || undefined,
      PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS || undefined,
    });
  }
  return cached;
}
