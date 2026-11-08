import { ActionError } from "@/lib/actions";

/** Narrow a possibly-null single() result, with a user-facing message. */
export function must<T>(value: T, message = "That record was not found."): NonNullable<T> {
  if (value === null || value === undefined) throw new ActionError(message);
  return value as NonNullable<T>;
}
