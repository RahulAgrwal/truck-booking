"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setUserRole } from "@/lib/actions/user";

type Role = "SHIPPER" | "CARRIER";

const ROLES = [
  {
    value: "SHIPPER",
    icon: "factory",
    title: "I have material to ship.",
    body: "Create auctions and receive bids from verified trucks.",
  },
  {
    value: "CARRIER",
    icon: "directions_bus",
    title: "I am a Truck Owner.",
    body: "Find loads, place bids, and keep your trucks moving.",
  },
] as const satisfies ReadonlyArray<{ value: Role; icon: string; title: string; body: string }>;

export function RoleCards() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleContinue() {
    if (!selected) return;
    setError(null);

    startTransition(async () => {
      const result = await setUserRole({ role: selected });
      if (result.ok) {
        router.replace(result.data.next);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {/*
        The Stitch markup used peer-checked radios. Selection here drives the
        Server Action too, so it is React state — but each card stays a real
        <label> + radio so screen readers and keyboards get a proper radiogroup.
      */}
      <div role="radiogroup" aria-label="Choose your role" className="flex flex-col gap-stack-md flex-1">
        {ROLES.map((role) => {
          const isSelected = selected === role.value;
          return (
            <label
              key={role.value}
              className="relative block cursor-pointer"
              data-selected={isSelected}
            >
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={isSelected}
                onChange={() => setSelected(role.value)}
                className="sr-only"
              />
              <div
                className={[
                  "p-stack-md rounded-xl bg-surface-container-lowest transition-all duration-200",
                  "flex flex-col relative overflow-hidden active:scale-[0.98]",
                  isSelected
                    ? "border-2 border-primary shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
                    : "border border-outline-variant shadow-sm",
                ].join(" ")}
              >
                <div
                  className={[
                    "absolute top-4 right-4 w-6 h-6 rounded-full bg-primary",
                    "flex items-center justify-center shadow-sm transition-opacity",
                    isSelected ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <span
                    className="material-symbols-outlined text-on-primary text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                </div>

                <div
                  className={[
                    "flex items-start gap-stack-md transition-opacity",
                    isSelected ? "opacity-100" : "opacity-80",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      isSelected ? "bg-primary-fixed" : "bg-surface-container-high",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "material-symbols-outlined text-2xl transition-colors",
                        isSelected ? "text-primary" : "text-secondary",
                      ].join(" ")}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      {role.icon}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-unit">
                      {role.title}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">{role.body}</p>
                  </div>
                </div>
              </div>
            </label>
          );
        })}

        {error ? (
          <p role="alert" className="font-label-bold text-label-bold text-error text-center">
            {error}
          </p>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 w-full z-50 bg-surface pb-safe border-t border-outline-variant shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <div className="p-margin-mobile">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || pending}
            aria-busy={pending}
            className="w-full h-14 bg-primary text-on-primary font-headline-md text-headline-md rounded-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
          >
            {pending ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </>
  );
}
