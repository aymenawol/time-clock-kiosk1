import "server-only";
import type { AuthContext } from "@/lib/auth/session";
import type { AppRole } from "@/lib/supabase/types";

export interface PersonLite {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  role: AppRole;
  status: string;
}

/** All employees in the active organization (RLS decides what the caller may see). */
export async function loadPeople(auth: AuthContext) {
  const { data } = await auth.supabase
    .from("employees")
    .select("id, first_name, last_name, employee_number, role, status")
    .eq("organization_id", auth.org.id)
    .order("last_name");
  const list = (data ?? []) as PersonLite[];
  const byId = new Map(list.map((p) => [p.id, p]));
  const name = (id: string | null | undefined) => {
    const p = id ? byId.get(id) : null;
    return p ? `${p.first_name} ${p.last_name}` : "-";
  };
  return { list, byId, name };
}
