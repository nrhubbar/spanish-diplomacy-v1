import type { JSX } from "react";
import { WeatherIcon } from "../components/weather/WeatherIcon";
import type { TerritoryId, WeatherId } from "../engine/types";
import { glyphs } from "../presentation/glyphs";
import { type DestinationEstimate, oddsSummary } from "../presentation/odds";
import type { MapPoint } from "../scenarios/loader";
import { SiteIcon } from "../components/SiteIcons";
import { intersects, type ScreenRect, type ScreenSize } from "./placement";

interface DestinationOddsLayerProps {
  /** Counter rectangles on screen, which the plaques try not to cover. */
  readonly counters: readonly ScreenRect[];
  readonly estimates: ReadonlyMap<TerritoryId, DestinationEstimate>;
  /** Screen position of each territory's name label, where the odds sit just above. */
  readonly labelAt: (territoryId: TerritoryId) => MapPoint;
  /** X5: the route's tag before the odds, "By rail \u00b7 Reinforce", where a destination has one. */
  readonly tags?: ReadonlyMap<TerritoryId, string> | undefined;
  /** T3: each destination's weather this turn, shown as a symbol on its plaque. */
  readonly weatherAt?: (territoryId: TerritoryId) => WeatherId | undefined;
  /** M8: the uncovered map, which every plaque stays inside. */
  readonly viewport?: ScreenSize | undefined;
  /** M8: the phone layout, where a route's tag shrinks to its symbol ("Rail, then march" to a rail icon). */
  readonly compact?: boolean;
}

/** Plaques keep this far from the map's edges. */
const edgeMargin = 6;

/** M8, phone: a route tag's symbol; tags without one (a march) are dropped. */
function tagIcon(tag: string): "rail" | "port" | undefined {
  if (/rail/iu.test(tag)) return "rail";
  if (/sea|amphibious/iu.test(tag)) return "port";
  return undefined;
}

/** Plaque height and an over-estimate of its glyph width at 12 px bold, in screen pixels. */
const plaqueHeight = 21;
const glyphWidth = 6.8;
/** T3: the weather symbol and its gap, in characters' worth of width. */
const weatherGlyphs = "xxx";

/**
 * Where each plaque goes: above the territory's name, else below it, else beside it, taking
 * the first spot that covers no counter and no other plaque. Deterministic, in scenario order.
 */
export function placeOddsPlaques(
  entries: readonly { readonly at: MapPoint; readonly territoryId: TerritoryId; readonly text: string }[],
  counters: readonly ScreenRect[],
  viewport?: ScreenSize
): ReadonlyMap<TerritoryId, ScreenRect> {
  // M8: inside the uncovered map where a spot allows, then pulled in from the edges.
  const inside = (rect: ScreenRect) => viewport === undefined
    || (rect.x >= edgeMargin && rect.y >= edgeMargin && rect.x + rect.width <= viewport.width - edgeMargin && rect.y + rect.height <= viewport.height - edgeMargin);
  const clamp = (rect: ScreenRect): ScreenRect => viewport === undefined ? rect : {
    ...rect,
    x: Math.max(edgeMargin, Math.min(rect.x, viewport.width - edgeMargin - rect.width)),
    y: Math.max(edgeMargin, Math.min(rect.y, viewport.height - edgeMargin - rect.height))
  };
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
    const chosen = candidates.find((rect) => free(rect) && inside(rect)) ?? candidates.map(clamp).find(free) ?? first;
    if (chosen !== undefined) placed.set(territoryId, clamp(chosen));
  }
  return placed;
}

/**
 * C15: odds on the highlighted destinations, as plaques by each territory's name, marked
 * approximate (A2). They are
 * decorative and let clicks through to the map; the Orders pane lists the same odds for
 * keyboard and screen-reader players.
 */
export function DestinationOddsLayer({ compact = false, counters, estimates, labelAt, tags, viewport, weatherAt }: DestinationOddsLayerProps): JSX.Element {
  const entries = [...estimates].map(([territoryId, estimate]) => {
    const summary = oddsSummary(estimate);
    const tag = tags?.get(territoryId);
    const icon = compact && tag !== undefined ? tagIcon(tag) : undefined;
    const chip = tag === undefined || compact ? summary.chip : `${tag} ${glyphs.dot} ${summary.chip}`;
    return { at: labelAt(territoryId), icon, summary: { ...summary, chip }, territoryId, weatherId: weatherAt?.(territoryId) };
  });
  const spots = placeOddsPlaques(entries.map(({ at, icon, summary, territoryId, weatherId }) => ({
    at,
    territoryId,
    text: `${icon === undefined ? "" : weatherGlyphs}${summary.chip}${weatherId === undefined ? "" : weatherGlyphs}`
  })), counters, viewport);
  return (
    <div aria-hidden="true" className="odds-layer">
      {entries.map(({ icon, summary, territoryId, weatherId }) => {
        const spot = spots.get(territoryId);
        return spot === undefined ? null : (
          <span className="odds-chip" data-territory-id={territoryId} data-tone={summary.tone} key={territoryId} style={{ left: spot.x, minWidth: spot.width, top: spot.y }}>
            {icon === undefined ? null : <SiteIcon kind={icon} />}
            {summary.chip}
            {weatherId === undefined ? null : <WeatherIcon weatherId={weatherId} />}
          </span>
        );
      })}
    </div>
  );
}
