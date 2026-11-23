import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Setup follows node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md.
// Pure domain logic runs in the default "node" environment; a component test
// opts into the DOM with a `// @vitest-environment jsdom` comment at the top.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    // Next.js handles `import "server-only"` in its compiler; Vitest does not, so
    // point it at an empty module (the npm package is intentionally not installed).
    alias: {
      "server-only": fileURLToPath(
        new URL("./src/test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
