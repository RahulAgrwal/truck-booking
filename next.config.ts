import type { NextConfig } from "next";

// DEV_AUTH_BYPASS mocks a signed-in session without Firebase (TechnicalDocument.md §4.4).
//
// This is a WARNING, not a build failure: `next build` sets NODE_ENV=production even
// for the local production build that every step's Definition of Done requires, and a
// developer with DEV_AUTH_BYPASS=true in .env.local is doing nothing wrong.
//
// The enforcement that matters is at RUNTIME, in src/lib/session.ts, which refuses to
// mock a session when NODE_ENV === "production". A build flag can be forgotten; that
// check cannot be bypassed. The deployed image never sees this value anyway —
// .env.local is excluded by .dockerignore and Cloud Run never sets it.
if (process.env.DEV_AUTH_BYPASS === "true" && process.env.NODE_ENV === "production") {
  console.warn(
    "\n[TruckingGO] WARNING: DEV_AUTH_BYPASS=true during a production build." +
      "\n  Fine for local verification. If this is a deploy, unset it — the runtime" +
      "\n  guard in src/lib/session.ts will refuse to mock sessions regardless.\n",
  );
}

const nextConfig: NextConfig = {
  // Required for the slim Cloud Run image (TechnicalDocument.md §9.1).
  output: "standalone",
};

export default nextConfig;
