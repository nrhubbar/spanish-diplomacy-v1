import type { JSX, ReactNode } from "react";
import type { RouteChip } from "../../presentation/movement";
import { MoveIcon } from "./MoveIcon";

/** X5: the chips on a destination row: `leading` (the weather chip), then terrain, fatigue, rail or sea, moves left. */
export function RouteChips({ chips, leading }: { readonly chips: readonly RouteChip[]; readonly leading?: ReactNode }): JSX.Element {
  return (
    <span className="route-chips">
      {leading}
      {chips.map((chip) => (
        <span className="route-chip" data-kind={chip.kind} data-warn={chip.warn ? "true" : undefined} key={`${chip.kind}-${chip.text}`}>
          <MoveIcon kind={chip.kind} />
          {chip.text}
        </span>
      ))}
    </span>
  );
}
