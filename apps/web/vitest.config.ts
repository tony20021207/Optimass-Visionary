import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps "jsx": "preserve" for Next; tests need JSX compiled.
  oxc: { jsx: { runtime: "automatic" } },
  test: { environment: "jsdom", include: ["**/*.test.{ts,tsx}"], exclude: ["node_modules/**", ".next/**"] },
});
