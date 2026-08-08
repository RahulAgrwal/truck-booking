"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { signOut } from "@/lib/actions/user";

/**
 * Sign out, behind a bottom-sheet confirm (§7.6).
 *
 * Signing out is not destructive, but it is disruptive and one tap from the
 * bottom nav — and on a phone the confirm sheet costs a tap while an
 * accidental sign-out costs a whole Google round trip. So it confirms.
 *
 * `signOut` is Lane A's (`src/lib/actions/user.ts`): it revokes the Firebase
 * refresh tokens, clears the cookie, and redirects to `/login`. Because it
 * redirects, this never gets a result back — there is no success state to
 * render, and no `finally` that could run.
 */
export function SignOutButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="secondary"
        size="lg"
        fullWidth
        icon={<Icon name="logout" />}
        onClick={() => setConfirming(true)}
      >
        Sign out
      </Button>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Sign out?"
        description="You'll need to sign in with Google again to get back in."
        footer={
          <div className="flex flex-col gap-stack-sm pb-stack-sm">
            <Button
              variant="destructive"
              size="lg"
              fullWidth
              loading={pending}
              onClick={() => startTransition(async () => { await signOut(); })}
            >
              Yes, sign out
            </Button>
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Stay signed in
            </Button>
          </div>
        }
      />
    </>
  );
}
