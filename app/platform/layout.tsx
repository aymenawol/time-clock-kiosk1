import type { Metadata } from "next";
import { Wordmark } from "@/components/shell/brand";
import { signOut } from "@/components/shell/actions";
import { Button } from "@/components/ui/button";
import { requirePlatformOperator } from "@/lib/auth/platform";

export const metadata: Metadata = { title: "Platform" };
export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const operator = await requirePlatformOperator();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="text-sm text-muted">Platform</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">{operator.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
