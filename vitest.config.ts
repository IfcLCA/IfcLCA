import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Repository tests share one database; run files one after another.
    fileParallelism: false,
    globalSetup: ["src/test/global-setup.ts"],
  },
});
