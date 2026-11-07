import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import type { ShellUser } from "./user-menu";

export function toShellUser(auth: AuthContext): ShellUser {
  return {
    employeeId: auth.employee.id,
    name: fullName(auth.employee),
    role: auth.employee.role,
    organizationId: auth.org.id,
    organizationName: auth.org.name,
    organizations: auth.memberships.map((m) => ({ id: m.organization_id, name: m.organization.name, role: m.role })),
  };
}
