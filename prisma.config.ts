import type { PrismaConfig } from "prisma/config";

/**
 * Prisma 7 no longer auto-loads .env files, and our local credentials live in
 * Next.js's `.env.local` — so the CLI (migrate / seed / studio) loads it here.
 *
 * **Optional on purpose.** `dotenv` is a devDependency, and Cloud Build runs
 * every step with `cwd=/workspace` — the repo source, with no `node_modules`.
 * A top-level `import { config } from "dotenv"` therefore killed the entire
 * config load there:
 *
 *     Failed to load config file "/workspace/prisma.config.ts" …
 *     Error: Cannot find module 'dotenv'
 *
 * The original comment already had the right idea — "in Cloud Build the vars
 * are already in the environment, so this is a no-op there" — the import just
 * had to stop being mandatory for that to be true. A missing dotenv now means
 * "the platform supplies the environment", which is exactly what it means.
 */
function loadLocalEnv(): void {
  try {
    if (typeof require !== "function") return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not be a static import; see above.
    const dotenv = require("dotenv") as {
      config: (options: { path: string; override: boolean; quiet: boolean }) => unknown;
    };
    dotenv.config({ path: ".env.local", override: false, quiet: true });
  } catch {
    // Not installed (CI, or the deploy image): env comes from the platform.
  }
}

loadLocalEnv();

/*
  `satisfies PrismaConfig` with a **type-only** import, rather than calling
  `defineConfig`. Same type checking, but the import is erased at compile time,
  so this file needs nothing resolvable at runtime.

  That is what makes it load in Cloud Build. Steps run with `cwd=/workspace` —
  the repo source, with no `node_modules` — so `import { defineConfig } from
  "prisma/config"` failed exactly like the dotenv import did:

      Failed to load config file "/workspace/prisma.config.ts" …
      Error: Cannot find module 'prisma/config'

  Verified by loading this file with no `node_modules` present at all.
  Keep both imports non-runtime, or the deploy breaks again.
*/
export default {
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI only — the running app never reads this file; it connects through the
    // pg adapter with the pooled DATABASE_URL (src/lib/prisma.ts).
    // Prefer the unpooled URL here: migrations issue DDL, which a pooler
    // cannot run reliably.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
} satisfies PrismaConfig;
