import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The oracle checks minute by minute; E4 alone walks ten years.
    testTimeout: 30_000,
  },
});
