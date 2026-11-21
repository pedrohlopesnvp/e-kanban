import { defineConfig } from "vitest/config";
import path from "path";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  test: {
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
