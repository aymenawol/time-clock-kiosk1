import Link from "next/link";
import { Wordmark } from "@/components/shell/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <Wordmark className="justify-center text-xl" />
        <h1 className="mt-8 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">The page you asked for does not exist or you do not have access to it.</p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Go to your home page
        </Link>
      </div>
    </div>
  );
}
