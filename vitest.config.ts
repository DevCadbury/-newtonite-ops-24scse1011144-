import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/globalSetup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    sequence: { concurrent: false },
    // Use forks pool with single fork to share module state across test files
    reporters: ["verbose"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
