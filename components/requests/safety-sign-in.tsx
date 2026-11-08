"use client";

import { signInToMeeting } from "@/app/m/safety/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/ui/use-action";

export function SafetySignIn({ meetingId }: { meetingId: string }) {
  const [run, pending] = useAction(signInToMeeting, {
    success: (d) => (d.status === "present" ? "Signed in, you are on time" : "Signed in, marked late"),
  });
  return (
    <Button size="xl" className="w-full" loading={pending} onClick={() => void run({ meetingId })}>
      Sign in
    </Button>
  );
}
