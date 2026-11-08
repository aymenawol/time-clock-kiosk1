import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests against the real Supabase project (needs .env.local).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/rls/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
