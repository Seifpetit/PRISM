import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["components/**/*.test.{ts,tsx}", "styles/**/*.test.ts"],
    setupFiles: ["./test/frontend-setup.ts"],
    restoreMocks: true,
  },
});
