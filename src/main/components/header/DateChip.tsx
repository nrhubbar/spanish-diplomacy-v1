import type { JSX } from "react";
import type { HeaderSlotProps } from "./slots";

/**
 * Header slot for the date (T1). It renders nothing on purpose: the approved header (Q-UX-13)
 * carries the date in the kicker, "Turn 7 \u00b7 Late October 1936 \u00b7 Planning", through
 * `turnLabel`, and the weather pill lives in the territory pane (T3). Kept as the slot's home.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the slot's data, read once its slice lands
export function DateChip(_props: HeaderSlotProps): JSX.Element | null {
  return null;
}
