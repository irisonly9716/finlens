import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Setup follows node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md.
// Pure domain logic runs in the default "node" environment; a component test
// opts into the DOM with a `// @vitest-environment jsdom` comment at the top.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
