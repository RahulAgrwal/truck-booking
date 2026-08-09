"use client";

import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { Input, type InputProps } from "@/components/ui/input";

/**
 * A password `Input` with a show/hide toggle
 * (docs/feature-email-password-auth.md §3.7).
 *
 * It lives here rather than in `components/ui/input.tsx` for two reasons: that
 * file is Lane B's (BuildPlan §3), and a toggle is not something every input
 * wants. Composition over a new prop on the shared primitive.
 *
 * **Why the toggle exists at all.** Typing a password blind on a phone, one
 * thumb, in a truck cab, is the single most common reason a sign-in fails twice
 * and the user gives up — and we ship no password reset (feature doc §0), so
 * "gives up" is expensive here.
 */
export function PasswordField({
  label,
  ...rest
}: Omit<InputProps, "type" | "suffix" | "prefix">) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...rest}
      label={label}
      type={visible ? "text" : "password"}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          /*
            A real 48×48 target, not a 20px glyph.

            `Input`'s wrapper is 48px tall with `px-stack-md`, so a naively sized
            icon leaves a dead strip above and below it — exactly the bug the A6
            device sweep found in every other form in the app. `h/w-touch-target-min`
            fills the row's full height, and `-mr-stack-md` pushes the button out
            into the wrapper's own right padding so it reaches the visual edge
            without widening the field.

            `tabIndex={-1}` keeps it out of the tab order: it is a convenience,
            and stopping between the password box and the submit button to skip
            past an eye icon is worse for a keyboard user than not having it.
          */
          tabIndex={-1}
          className="-mr-stack-md flex h-touch-target-min w-touch-target-min shrink-0 items-center justify-center text-on-surface-variant active:opacity-80"
        >
          {/* Decorative: the button's aria-label already says what this does. */}
          <Icon name={visible ? "visibility_off" : "visibility"} />
        </button>
      }
    />
  );
}
