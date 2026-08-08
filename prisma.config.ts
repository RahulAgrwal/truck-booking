import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer auto-loads .env files, and our local credentials live in
// Next.js's .env.local — load it explicitly for the CLI (migrate / seed / studio).
// In Cloud Build the vars are already in the environment, so this is a no-op there.
loadEnv({ path: ".env.local", override: false, quiet: true });

export default defineConfig({
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
});
