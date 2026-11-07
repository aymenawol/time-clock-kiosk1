import { Wordmark } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { signOut } from "@/components/shell/actions";

export default function NoAccessPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Wordmark className="text-xl" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">No active access</h1>
        <p className="mt-2 text-sm text-muted">
          You are signed in, but you are not an active member of any organization. Ask your admin to add you or
          re-activate your account.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
