import { z } from "zod";

const SEQUENCES = "0123456789012345678909876543210987654321";

/** Reject PINs that are trivially guessable. Returns an error message or null. */
export function weakPinReason(pin: string, employeeNumber?: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "PIN must be 4 to 8 digits.";
  if (/^(\d)\1+$/.test(pin)) return "PIN cannot be one digit repeated.";
  if (SEQUENCES.includes(pin)) return "PIN cannot be a simple sequence.";
  if (employeeNumber && pin === employeeNumber) return "PIN cannot be the employee number.";
  if (/^(19|20)\d{2}$/.test(pin)) return "PIN cannot look like a year.";
  return null;
}

export const pinSchema = z
  .string()
  .regex(/^\d{4,8}$/, "PIN must be 4 to 8 digits")
  .refine((p) => weakPinReason(p) === null, { message: "Choose a less guessable PIN" });
