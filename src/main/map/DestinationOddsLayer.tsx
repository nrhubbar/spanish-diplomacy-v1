import type { JSX } from "react";
import type { TerritoryId } from "../engine/types";
import { type DestinationEstimate, oddsSummary } from "../presentation/odds";
import type { MapPoint } from "../scenarios/loader";
import { intersects, type ScreenRect } from "./placement";

interface DestinationOddsLayerProps {
  /** Counter rectangles on screen, which the plaques try not to cover. */
  readonly counters: readonly ScreenRect[];
  readonly estimates: ReadonlyMap<TerritoryId, DestinationEstimate>;
  /** Screen position of each territory's name label, where the odds sit just above. */
  readonly labelAt: (territoryId: TerritoryId) => MapPoint;
}

/** Plaque height and an over-estimate of its glyph width at 12 px bold, in screen pixels. */
const plaqueHeight = 21;
const glyphWidth = 6.8;

/**
 * Where each plaque goes: above the territory's name, else below it, else beside it, taking
 * the first spot that covers no counter and no other plaque. Deterministic, in scenario order.
 */
export function placeOddsPlaques(
  entries: readonly { readonly at: MapPoint; readonly territoryId: TerritoryId; readonly text: string }[],
  counters: readonly ScreenRect[]
): ReadonlyMap<TerritoryId, ScreenRect> {
  const placed = new Map<TerritoryId, ScreenRect>();
  for (const { at, territoryId, text } of entries) {
    const width = text.length * glyphWidth + 18;
    const candidates: readonly ScreenRect[] = [
      { height: plaqueHeight, width, x: at.x - width / 2, y: at.y - 15 - plaqueHeight },
      { height: plaqueHeight, width, x: at.x - width / 2, y: at.y + 6 },
      { height: plaqueHeight, width, x: at.x + width / 2 + 8, y: at.y - 13 },
      { height: plaqueHeight, width, x: at.x - (width * 3) / 2 - 8, y: at.y - 13 }
    ];
    const free = (rect: ScreenRect) => ![...counters, ...placed.values()].some((other) => intersects(rect, other));
    const [first] = candidates;
    const chosen = candidates.find(free) ?? first;
    if (chosen !== undefined) placed.set(territoryId, chosen);
  }
  return placed;
}

/**
 * C15: odds on the highlighted destinations, as plaques by each territory's name, marked
 * approximate (A2). They are
 * decorative and let clicks through to the map; the Orders pane lists the same odds for
 * keyboard and screen-reader players.
 */
export function DestinationOddsLayer({ counters, estimates, labelAt }: DestinationOddsLayerProps): JSX.Element {
  const entries = [...estimates].map(([territoryId, estimate]) => ({ at: labelAt(territoryId), summary: oddsSummary(estimate), territoryId }));
  const spots = placeOddsPlaques(entries.map(({ at, summary, territoryId }) => ({ at, territoryId, text: summary.chip })), counters);
  return (
    <div aria-hidden="true" className="odds-layer">
      {entries.map(({ summary, territoryId }) => {
        const spot = spots.get(territoryId);
        return spot === undefined ? null : (
          <span className="odds-chip" data-territory-id={territoryId} data-tone={summary.tone} key={territoryId} style={{ left: spot.x, minWidth: spot.width, top: spot.y }}>
            {summary.chip}
          </span>
        );
      })}
    </div>
  );
}
