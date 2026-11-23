import type { JSX } from "react";

/** Shown when the SEC ticker file cannot be loaded; a notice, not an error page. */
export function SecUnavailable(): JSX.Element {
  return (
    <p role="status">
      SEC company data is temporarily unavailable. Please try again in a few minutes.
    </p>
  );
}
