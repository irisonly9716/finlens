import { z } from "zod";

/** Longest query we accept; anything longer is cut, not rejected. */
export const MAX_QUERY_LENGTH = 100;

const searchParamsSchema = z.object({
  q: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((q) => (Array.isArray(q) ? q[0] : q) ?? "")
    .transform((q) => q.trim().slice(0, MAX_QUERY_LENGTH)),
});

/**
 * Reads the `q` search param from `/search?q=...`. Repeated params use the first
 * value; anything unexpected becomes an empty query rather than an error.
 */
export function parseSearchQuery(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const parsed = searchParamsSchema.safeParse(searchParams);
  return parsed.success ? parsed.data.q : "";
}
