import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    // Every PIN check is a real scrypt hash, and the TPI tests (the settlement property runs, the PIN
    // lock schedule, persistence) make hundreds of them. They take 1-7 s each on a busy machine, so
    // Vitest's 5 s default made them fail with "Test timed out" on slower or loaded computers.
    testTimeout: 30_000,
  },
});
