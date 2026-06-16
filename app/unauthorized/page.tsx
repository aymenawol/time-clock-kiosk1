import Link from "next/link"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{ backgroundColor: "#2563EB" }}
        >
          <span className="text-foreground text-3xl font-bold">!</span>
        </div>
        <h1 className="text-foreground text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground text-sm mb-8">
          You don&apos;t have permission to view this page. Contact your
          administrator if you believe this is an error.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-3 px-6 rounded-xl font-semibold text-foreground text-center transition-opacity"
            style={{ backgroundColor: "#2563EB" }}
          >
            Back to Kiosk
          </Link>
          <Link
            href="/login"
            className="w-full py-3 px-6 rounded-xl font-semibold text-foreground text-center bg-muted hover:bg-gray-700 transition-colors"
          >
            Sign In with Different Account
          </Link>
        </div>
      </div>
    </div>
  )
}
