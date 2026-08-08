import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      /*
        `server-only` throws on import unless the bundler picks its
        "react-server" export condition, which vitest does not. Modules like
        src/lib/maps.ts import it as a guard against ever being pulled into a
        client bundle — a guard worth keeping — so point vitest at the package's
        own empty build rather than dropping the import from the source.
      */
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
