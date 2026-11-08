import { Package } from "lucide-react";
import type { Metadata } from "next";
import { FilterField, FilterForm } from "@/components/records/filter-form";
import { LogLostItemButton, LostItemButton, LOST_STATUS, LostStatusPill, type LostItemView } from "@/components/records/lost-item-dialogs";
import { likeTerm, param, type SearchParams } from "@/components/records/params";
import { loadPeople } from "@/components/records/people";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireAuth } from "@/lib/auth/session";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Lost and found" };

export default async function LostFoundPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireAuth("lostFound");
  const sp = await searchParams;
  const { supabase, org, settings } = auth;
  const tz = org.timezone;
  const status = param(sp, "status");
  const q = likeTerm(param(sp, "q"));

  let query = supabase
    .from("lost_items")
    .select("*")
    .eq("organization_id", org.id)
    .order("found_at", { ascending: false })
    .limit(200);
  if (status in LOST_STATUS) query = query.eq("status", status);
  else if (status !== "all") query = query.in("status", ["found", "collected", "at_dispatch"]);
  if (q) query = query.or(`reference.ilike.%${q}%,description.ilike.%${q}%`);

  const [itemsRes, locationsRes, vehiclesRes, people] = await Promise.all([
    query,
    supabase.from("locations").select("id, name").eq("organization_id", org.id).eq("active", true).order("name"),
    supabase.from("vehicles").select("id, number").eq("organization_id", org.id).neq("status", "retired").order("number"),
    loadPeople(auth),
  ]);
  const items = itemsRes.data ?? [];
  const locations = locationsRes.data ?? [];
  const vehicles = vehiclesRes.data ?? [];
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const vehicleNumber = new Map(vehicles.map((v) => [v.id, v.number]));

  const ids = items.map((i) => i.id);
  const [eventsRes, signed] = await Promise.all([
    ids.length
      ? supabase
          .from("lost_item_events")
          .select("*")
          .eq("organization_id", org.id)
          .in("item_id", ids)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    (async () => {
      const paths = [...new Set(items.flatMap((i) => i.photo_paths))];
      const map = new Map<string, string>();
      if (paths.length) {
        const { data } = await supabase.storage.from("lost-found").createSignedUrls(paths, 3600);
        for (const s of data ?? []) if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
      }
      return map;
    })(),
  ]);
  const eventsByItem = new Map<string, NonNullable<typeof eventsRes.data>>();
  for (const e of eventsRes.data ?? []) eventsByItem.set(e.item_id, [...(eventsByItem.get(e.item_id) ?? []), e]);

  const label = (s: string) => LOST_STATUS[s]?.label ?? s;

  return (
    <>
      <PageHeader
        title="Lost and found"
        description={`${items.length} item${items.length === 1 ? "" : "s"}`}
        actions={<LogLostItemButton locations={locations} vehicles={vehicles} />}
      />
      <FilterForm clearHref="/lost-found">
        <FilterField label="Search" className="flex-1">
          <Input name="q" defaultValue={param(sp, "q")} placeholder="Reference or description" />
        </FilterField>
        <FilterField label="Status">
          <Select name="status" defaultValue={status}>
            <option value="">Still held</option>
            <option value="all">All</option>
            {Object.entries(LOST_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterForm>

      <Card>
        {items.length === 0 ? (
          <EmptyState icon={Package} title="No items" description="Nothing matches. Log an item when one is found." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Reference</TH>
                <TH>Item</TH>
                <TH>Category</TH>
                <TH>Found</TH>
                <TH>Where</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {items.map((i) => {
                const foundWhere = [
                  i.found_location_id ? locationName.get(i.found_location_id) : null,
                  i.found_vehicle_id ? `Vehicle ${vehicleNumber.get(i.found_vehicle_id) ?? "-"}` : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                const view: LostItemView = {
                  id: i.id,
                  reference: i.reference,
                  description: i.description,
                  category: i.category,
                  contents: i.contents,
                  status: i.status,
                  foundAt: fmtDateTime(i.found_at, tz, settings.clock24h),
                  foundWhere: foundWhere || "-",
                  foundBy: people.name(i.found_by),
                  custodyBy: people.name(i.custody_by),
                  claimant: i.claimant_name
                    ? [i.claimant_name, i.claimant_contact, i.claimant_id_last4 ? `ID ending ${i.claimant_id_last4}` : null].filter(Boolean).join(", ")
                    : null,
                  disposalReason: i.disposal_reason,
                  photos: i.photo_paths.map((p) => signed.get(p)).filter((u): u is string => Boolean(u)),
                  events: (eventsByItem.get(i.id) ?? []).map((e) => ({
                    id: e.id,
                    label: e.from_status ? `${label(e.from_status)} to ${label(e.to_status)}` : label(e.to_status),
                    actor: people.name(e.actor_id),
                    at: fmtDateTime(e.created_at, tz, settings.clock24h),
                  })),
                };
                return (
                  <TR key={i.id}>
                    <TD className="font-mono text-xs font-semibold">{i.reference}</TD>
                    <TD className="max-w-xs truncate">{i.description}</TD>
                    <TD>
                      <Badge className="capitalize">{i.category}</Badge>
                    </TD>
                    <TD className="whitespace-nowrap">{view.foundAt}</TD>
                    <TD>{view.foundWhere}</TD>
                    <TD>
                      <LostStatusPill status={i.status} />
                    </TD>
                    <TD className="text-right">
                      <LostItemButton item={view} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
