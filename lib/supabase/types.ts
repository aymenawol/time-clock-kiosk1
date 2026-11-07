import type { Database } from "./database.types";

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type AppRole = Enums<"app_role">;
export type VehicleStatus = Enums<"vehicle_status">;
export type BreakKind = Enums<"break_kind">;
export type BreakStatus = Enums<"break_status">;
export type Employee = Tables<"employees">;
export type Organization = Tables<"organizations">;
export type Shift = Tables<"shifts">;
export type Break = Tables<"breaks">;
export type Vehicle = Tables<"vehicles">;
