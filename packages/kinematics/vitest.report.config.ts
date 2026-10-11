import { defineConfig } from "vitest/config";

// `pnpm pulldown:report`: prints the synthetic pulldown feature table. Not part of `pnpm test`.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.report.ts"], silent: false },
});
