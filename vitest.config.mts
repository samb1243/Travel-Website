import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  // Lets server modules load outside Next.js (it only guards against client imports).
  "server-only": path.resolve(import.meta.dirname, "test/integration/empty-module.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Fast, pure tests next to the code: npm test
        resolve: { alias },
        test: { name: "unit", include: ["src/**/*.test.ts"] },
      },
      {
        // Real server actions against a throwaway database: npm run test:integration
        resolve: { alias },
        test: {
          name: "integration",
          include: ["test/integration/**/*.int.test.ts"],
          globalSetup: ["test/integration/global-setup.ts"],
          setupFiles: ["test/integration/setup.ts"],
          fileParallelism: false, // one database, one file at a time
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
