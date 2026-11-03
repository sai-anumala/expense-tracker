import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Deterministic local time for date maths (India has no DST). Set before workers start so they inherit it;
// test/setup.ts sets it again inside each worker.
process.env.TZ = "Asia/Kolkata";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `import "server-only"` throws outside a React Server Components build; stub it for unit tests.
      "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    env: { TZ: "Asia/Kolkata" },
  },
});
