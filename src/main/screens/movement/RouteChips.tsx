import type { JSX } from "react";
import type { RouteChip } from "../../presentation/movement";
import { MoveIcon } from "./MoveIcon";

/** X5: the chips on a destination row (weather, terrain, fatigue, rail or sea, moves left). */
export function RouteChips({ chips }: { readonly chips: readonly RouteChip[] }): JSX.Element | null {
  if (chips.length === 0) return null;
  return (
    <span className="route-chips">
      {chips.map((chip) => (
        <span className="route-chip" data-kind={chip.kind} data-warn={chip.warn ? "true" : undefined} key={`${chip.kind}-${chip.text}`}>
          <MoveIcon kind={chip.kind} />
          {chip.text}
        </span>
      ))}
    </span>
  );
}
