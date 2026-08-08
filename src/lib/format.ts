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
