import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // CLAUDE.md already tells agents to read node_modules/next/dist/docs, so don't let
  // `next dev` generate an AGENTS.md with the same rule.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
