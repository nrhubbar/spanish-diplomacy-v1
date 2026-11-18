import type { CSSProperties } from "react";

/** Typed CSS custom properties (`--name`) merged into a React style object. */
export function cssVariables(variables: Readonly<Record<`--${string}`, string | number>>, base: CSSProperties = {}): CSSProperties {
  return { ...base, ...variables };
}
