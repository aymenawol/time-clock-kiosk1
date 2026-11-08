import { ROLE_LABEL, ROLES } from "@/lib/auth/permissions";

export const OFFER_ROLES = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));
