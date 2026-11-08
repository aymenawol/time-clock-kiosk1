import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { SettingsNav } from "./_components/settings-nav";

export const metadata = { title: "Settings" };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth("settings");
  return (
    <>
      <PageHeader title="Settings" description="Organization rules, devices and the lists drivers choose from." />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-4 lg:w-52 lg:shrink-0">
          <SettingsNav />
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
