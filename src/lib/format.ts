/**
 * Shared formatters. Pure functions — no DB, no React, safe to unit test.
 *
 * Currency is INR (TechnicalDocument.md decision D5). Weight is stored in
 * kilograms per the PRD schema but entered and displayed in tonnes (D4).
 */

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** 450000 → "₹4,50,000" (Indian digit grouping, no paise). */
export function formatINR(amount: number): string {
  return INR.format(amount);
}

/** The UI collects tonnes; the schema stores kilograms. */
export function tonsToKg(tons: number): number {
  return tons * 1000;
}

export function kgToTons(kg: number): number {
  return kg / 1000;
}

/** 5000 → "5 Tons", 500 → "0.5 Tons", 1000 → "1 Ton". */
export function formatWeight(kg: number): string {
  const tons = kgToTons(kg);
  const rounded = Math.round(tons * 100) / 100;
  return `${rounded} ${rounded === 1 ? "Ton" : "Tons"}`;
}

export type Remaining = {
  /** Whole milliseconds left; 0 once the deadline has passed. */
  ms: number;
  expired: boolean;
  /** "02h 14m" above an hour, "45m 12s" below it, "00m 09s" in the last minute. */
  label: string;
  /** True inside the last 30 minutes — the UI switches the timer to `error`. */
  urgent: boolean;
};

const URGENT_THRESHOLD_MS = 30 * 60 * 1000;

/**
 * Time left until `endTime`, computed against an absolute instant.
 *
 * Always derive from the absolute target rather than decrementing a counter:
 * RSC payloads are cached and browsers throttle background timers, so a
 * decremented value drifts while a recomputed one self-corrects.
 */
export function formatRemaining(endTime: Date | string, now: Date | number = Date.now()): Remaining {
  const end = typeof endTime === "string" ? new Date(endTime).getTime() : endTime.getTime();
  const from = typeof now === "number" ? now : now.getTime();
  const ms = Math.max(0, end - from);

  if (ms === 0) {
    return { ms: 0, expired: true, label: "Expired", urgent: true };
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");
  const label = hours > 0 ? `${pad(hours)}h ${pad(minutes)}m` : `${pad(minutes)}m ${pad(seconds)}s`;

  return { ms, expired: false, label, urgent: ms <= URGENT_THRESHOLD_MS };
}

/* ------------------------------------------------------------------ *
 * Contact details — phone and truck number.
 *
 * Every one of these is pure and client-safe. The *values* they format are
 * sensitive and only ever reach a screen through `src/lib/contact.ts`, which
 * gates them behind the Rule 1 visibility check
 * (docs/feature-contact-ratings.md §2); these functions know nothing about
 * that and must never be the thing deciding who sees what.
 * ------------------------------------------------------------------ */

/**
 * Anything a human typed → 10 bare digits, which is what the database stores.
 *
 * Accepts "+91 98765 43210", "098765-43210", "9876543210". Storing one
 * canonical form is what makes a phone number comparable and a `tel:` link
 * constructible; keeping the user's punctuation would mean neither.
 *
 * Returns the digits it managed to extract even when that is not a valid
 * number — validation is `ContactDetailsSchema`'s job, not this function's.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** "9876543210" → "+91 98765 43210". Anything else is returned as given. */
export function formatPhone(phone: string): string {
  const digits = normalizePhone(phone);
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** `href` for a tap-to-call link. Always E.164, never the display form. */
export function telHref(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.length === 10 ? `tel:+91${digits}` : `tel:${digits}`;
}

/** "mh 12-ab 1234" → "MH12AB1234", the stored form. */
export function normalizeTruckNumber(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const TRUCK_NUMBER_PARTS = /^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/;

/** "MH12AB1234" → "MH 12 AB 1234". Unparseable input comes back normalised. */
export function formatTruckNumber(value: string): string {
  const normalized = normalizeTruckNumber(value);
  const parts = TRUCK_NUMBER_PARTS.exec(normalized);
  if (!parts) return normalized;
  return parts.slice(1).filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ *
 * Ratings.
 *
 * These two live here, not in `reviews.ts`, purely so they are importable
 * from a client component — `reviews.ts` is `server-only` because it also
 * holds the Prisma reads. `reviews.ts` re-exports both, so the contract in
 * docs/feature-contact-ratings.md §4 holds from either import path.
 *
 * Ratings are PUBLIC reputation and are deliberately not gated by Rule 1
 * (§2, Rule 2). Conflating the two is the one way this feature leaks.
 * ------------------------------------------------------------------ */

/**
 * The exact average, or `null` at zero reviews.
 *
 * `null` rather than `0` on purpose: a fabricated 0.0 renders as five empty
 * stars, which reads as "rated badly" when the truth is "not rated yet".
 * "No ratings yet" is a first-class state everywhere it appears.
 */
export function ratingAverage(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return sum / count;
}

/** "4.8 (12)", or "No ratings yet". */
export function formatRating(sum: number, count: number): string {
  const average = ratingAverage(sum, count);
  if (average === null) return "No ratings yet";
  return `${average.toFixed(1)} (${count})`;
}

/** "5 mins ago" — used on bid cards. */
export function formatRelativeTime(date: Date | string, now: Date | number = Date.now()): string {
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const from = typeof now === "number" ? now : now.getTime();
  const seconds = Math.floor((from - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
