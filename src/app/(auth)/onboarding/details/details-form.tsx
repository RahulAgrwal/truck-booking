"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { updateContactDetails } from "@/lib/actions/user";
import { TRUCK_TYPES, type TruckType } from "@/lib/schemas";

/**
 * The contact-details form — onboarding step 2, and later the edit screen.
 *
 * One component for both because the fields, the validation and the action are
 * identical; only the copy and where you land afterwards differ. A second copy
 * would drift the moment a field is added.
 *
 * Shape from Mobbin — Zip "Personal Details" and DoorDash Dasher "Profile":
 * a flat stack of labelled inputs and one sticky full-width save. No sections,
 * no accordions; there are five fields at most.
 *
 * **Why the details are collected at all:** they are the payload of the contact
 * exchange. When a bid is accepted, this is what the other party sees — so a
 * blank truck number is not a cosmetic gap, it is a driver nobody can identify
 * at the gate.
 */

export type DetailsFormMode = "onboarding" | "edit";

export type DetailsFormValues = {
  phone: string;
  address: string;
  companyName: string;
  truckNumber: string;
  truckType: TruckType | "";
};

const EMPTY: DetailsFormValues = {
  phone: "",
  address: "",
  companyName: "",
  truckNumber: "",
  truckType: "",
};

export function DetailsForm({
  role,
  mode,
  initial,
}: {
  role: "SHIPPER" | "CARRIER";
  mode: DetailsFormMode;
  /** Prefill for the edit screen. Onboarding passes nothing. */
  initial?: Partial<DetailsFormValues> | null;
}) {
  const router = useRouter();
  const [values, setValues] = useState<DetailsFormValues>({ ...EMPTY, ...initial });
  const [fieldError, setFieldError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof DetailsFormValues>(key: K, value: DetailsFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Clear the message the moment the offending field is touched — leaving it
    // under a field the user is actively fixing reads as "still wrong".
    setFieldError((current) => (current?.field === key ? null : current));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldError(null);

    startTransition(async () => {
      /*
        The payload is discriminated on `role`, so each branch sends only its
        own fields. The server checks this against the *session* role anyway —
        the client picks the shape, never the identity (CLAUDE.md §3.2).
      */
      const payload =
        role === "SHIPPER"
          ? {
              role: "SHIPPER" as const,
              phone: values.phone,
              address: values.address,
              companyName: values.companyName,
            }
          : {
              role: "CARRIER" as const,
              phone: values.phone,
              address: values.address,
              truckNumber: values.truckNumber,
              truckType: values.truckType,
            };

      const result = await updateContactDetails(payload);

      if (result.ok) {
        router.replace(mode === "onboarding" ? result.data.next : "/profile");
        router.refresh();
      } else {
        setFieldError({ field: result.field, message: result.error });
      }
    });
  }

  /** The message belongs to one field, or to the form as a whole. */
  const errorFor = (field: keyof DetailsFormValues) =>
    fieldError?.field === field ? fieldError.message : undefined;
  const formError = fieldError && !fieldError.field ? fieldError.message : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-stack-lg">
      {role === "SHIPPER" ? (
        <Input
          label="Company name"
          name="companyName"
          value={values.companyName}
          onChange={(event) => set("companyName", event.target.value)}
          error={errorFor("companyName")}
          hint="Carriers see this when they win your load."
          autoComplete="organization"
          enterKeyHint="next"
          required
        />
      ) : null}

      <Input
        label="Mobile number"
        name="phone"
        value={values.phone}
        onChange={(event) => set("phone", event.target.value)}
        error={errorFor("phone")}
        hint="Shared only after a bid is accepted."
        prefix="+91"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        enterKeyHint="next"
        // Long enough to survive a paste of "+91 98765 43210" — the schema
        // normalises whatever arrives, but a maxLength that silently truncates
        // a pasted number would hand the server a different, valid-looking one.
        maxLength={16}
        placeholder="98765 43210"
        required
      />

      {role === "CARRIER" ? (
        <>
          <Input
            label="Truck number"
            name="truckNumber"
            value={values.truckNumber}
            onChange={(event) => set("truckNumber", event.target.value.toUpperCase())}
            error={errorFor("truckNumber")}
            hint="As on the plate, e.g. MH 12 AB 1234."
            // Uppercase on the way in as well as on the way out: the server
            // normalises anyway, but a field that visibly fights the user's
            // caps lock looks broken.
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={16}
            placeholder="MH 12 AB 1234"
            required
          />

          <fieldset className="flex flex-col gap-stack-sm">
            <legend className="font-label-bold text-label-bold text-on-surface-variant">
              Truck type
            </legend>
            {/*
              Chips rather than a <select>: six options is a scan, not a
              search, and a native picker on iOS covers half the screen to
              show six rows. `ChipRow` keeps the scroll inside the row.
            */}
            <ChipRow>
              {TRUCK_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={type}
                  selected={values.truckType === type}
                  onSelect={() => set("truckType", type)}
                />
              ))}
            </ChipRow>
            {errorFor("truckType") ? (
              <p role="alert" className="font-label-bold text-label-bold text-error">
                {errorFor("truckType")}
              </p>
            ) : null}
          </fieldset>
        </>
      ) : null}

      <Textarea
        label={role === "SHIPPER" ? "Pickup address" : "Address"}
        name="address"
        value={values.address}
        onChange={(event) => set("address", event.target.value)}
        error={errorFor("address")}
        hint={
          role === "SHIPPER"
            ? "Where the truck should report. Shared only after a bid is accepted."
            : "Your base location. Shared only after a bid is accepted."
        }
        autoComplete="street-address"
        rows={3}
        maxLength={200}
        required
      />

      {formError ? (
        <p role="alert" className="font-label-bold text-label-bold text-error">
          {formError}
        </p>
      ) : null}

      {/*
        Sticky footer, same geometry as the role-selection step before it, so
        the Continue button does not move between the two screens. `pb-safe`
        keeps it clear of the home indicator; the form's own bottom padding
        (on the page) keeps the last field clear of this bar.
      */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-outline-variant bg-surface pb-safe shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
        <div className="p-margin-mobile">
          <Button type="submit" size="lg" fullWidth loading={pending}>
            {mode === "onboarding" ? "Continue" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
