import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm w-full">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 bg-danger-surface border border-danger-border">
          <ShieldAlert className="w-8 h-8 text-danger" />
        </div>
        <h1 className="text-foreground text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-sm mb-8">
          You don&apos;t have permission to view this page. Contact your
          administrator if you believe this is an error.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/">Back to Kiosk</Link>
          </Button>
          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href="/login">Sign In with Different Account</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
