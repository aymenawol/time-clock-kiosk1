import { Info } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { SectionForm } from "../_components/section-form";
import { SECTION_BY_SLUG } from "../_lib/sections";

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const auth = await requireAuth("settings");
  const { section } = await params;
  const def = SECTION_BY_SLUG.get(section);
  if (!def) notFound();
  const current = (auth.settings as unknown as Record<string, Record<string, unknown>>)[def.slug] ?? {};

  return (
    <Card>
      <CardHeader title={def.title} description={def.description} />
      <CardBody className="flex flex-col gap-4">
        {def.note ? (
          <p className="flex gap-2 rounded-[var(--radius-control)] bg-info-soft p-3 text-sm text-info">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {def.note}
          </p>
        ) : null}
        <SectionForm key={JSON.stringify(current)} section={def.slug} fields={def.fields} initial={current} />
      </CardBody>
    </Card>
  );
}
