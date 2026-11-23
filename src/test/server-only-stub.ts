// Vitest stand-in for `import "server-only"`. Next.js implements that import at
// the compiler level (no npm package installed), so tests alias it to this empty
// module. See vitest.config.mts.
export {};
