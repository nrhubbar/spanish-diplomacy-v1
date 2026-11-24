import { glyphs } from "./glyphs";

/**
 * Every number the player sees that may have a fraction is printed here (N5): to the nearest
 * tenth, halves away from zero, and a whole number without a decimal. The engine keeps its
 * thousandths; only the print is rounded.
 */

/** The least amount that prints as a tenth of its own. */
const least = 0.05;

/** "7", "1.5", "14.3" for 14.25, "<0.1" for anything smaller than a tenth can show, with a true minus below zero. */
export function tenths(value: number): string {
  const size = Math.abs(value);
  // Six decimals clear the float noise before the half is judged: 0.15 x 10 is a half, not a little under.
  const text = size > 0 && size < least ? "<0.1" : String(Math.round(Number((size * 10).toFixed(6))) / 10);
  return value < 0 ? `${glyphs.minus}${text}` : text;
}

/** A change with its sign, using a true minus: "+14", "−1.5", "+0". */
export function signedTenths(value: number): string {
  return value < 0 ? tenths(value) : `+${tenths(value)}`;
}
