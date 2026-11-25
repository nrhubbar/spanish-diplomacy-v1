import { type JSX, memo } from "react";
import { requireFaction } from "../../engine/lookup";
import { hasSubTerritories } from "../../presentation/holdings";
import type { FactionId, GameState, Scenario, SubTerritoryId, TerritoryId } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import type { MapPackage } from "../../scenarios/loader";
import type { MapLayerProps } from "./slots";
import { type SubTerritoryPaths, useSubTerritoryPaths } from "./subTerritoryGeometry";

/**
 * X2 (Q-UX-02): sub-territories on the map. Provinces are drawn only in contested territories,
 * each washed in its holder's colour under faint diagonal lines; from the operational zoom their
 * names and every territory's capital star appear. Two layers: the wash sits under the vector
 * layer (borders, rivers, cities and names stay on top) and the labels above it. Zoomed in, every
 * sub-territory is hit-testable from the wash, so a click on the selected territory can focus the
 * pane on one (X3, `subTerritoryAt`). Past 250% zoom, with the Sub-territories layer on, every
 * sub-territory's border and name show (note 4, `showsSubTerritoryBorders`).
 */

/** The sub-territory layers' props: the shared ones, and whether every border and name shows. */
interface SubTerritoryLayerProps extends MapLayerProps {
  readonly borders?: boolean;
}

interface Partition {
  readonly contested: ReadonlySet<TerritoryId>;
  readonly map: MapPackage;
  readonly svgPath: string;
}

function partitionOf({ game, scenarioPackage }: MapLayerProps): Partition | undefined {
  const { map, scenario } = scenarioPackage;
  if (map.subTerritories === undefined || !hasSubTerritories(scenario)) return undefined;
  const contested = new Set(scenario.territories.filter((territory) => game.control[territory.id]?.kind === "contested").map((territory) => territory.id));
  return { contested, map, svgPath: map.subTerritories.svgPath };
}

/** The map-to-screen transform as an SVG attribute: the camera is a uniform scale plus a shift. */
function screenTransform(toScreen: MapLayerProps["toScreen"]): { readonly scale: number; readonly transform: string } {
  const origin = toScreen({ x: 0, y: 0 });
  const scale = toScreen({ x: 1, y: 0 }).x - origin.x;
  return { scale, transform: `translate(${String(origin.x)} ${String(origin.y)}) scale(${String(scale)})` };
}

interface WashProps {
  readonly borders: boolean;
  readonly contested: ReadonlySet<TerritoryId>;
  readonly game: GameState;
  readonly hitTestAll: boolean;
  readonly paths: SubTerritoryPaths;
  readonly scenario: Scenario;
}

/** The provinces themselves, in map units; re-rendered when holders change, not on pan or zoom. */
const WashPaths = memo(function WashPaths({ borders, contested, game, hitTestAll, paths, scenario }: WashProps): JSX.Element {
  const color = (id: FactionId | undefined): string => (id === undefined ? "#d8c59d" : requireFaction(scenario, id).color);
  return (
    <>
      {scenario.subTerritories.map((sub) => {
        const d = paths.get(sub.id);
        const shown = contested.has(sub.territoryId);
        if (d === undefined || (!shown && !hitTestAll)) return null;
        return shown ? (
          <g data-holder={game.subTerritories[sub.id]?.holder} data-sub-territory-id={sub.id} key={sub.id}>
            <path className="sub-territory-fill" d={d} fill={color(game.subTerritories[sub.id]?.holder)} fillRule="evenodd" />
            <path className="sub-territory-hatch" d={d} fill="url(#sub-territory-hatch)" fillRule="evenodd" />
          </g>
        ) : <path className={borders ? "sub-territory-hit sub-territory-border" : "sub-territory-hit"} d={d} data-sub-territory-id={sub.id} fillRule="evenodd" key={sub.id} />;
      })}
    </>
  );
});

/** Under the vector layer: holder washes and diagonal lines in contested territories. */
export function SubTerritoryWash(props: SubTerritoryLayerProps): JSX.Element | null {
  const partition = partitionOf(props);
  const zoomed = props.level !== "overview";
  const needed = partition !== undefined && (partition.contested.size > 0 || zoomed);
  const paths = useSubTerritoryPaths(needed ? partition.svgPath : undefined);
  if (!needed || paths === undefined) return null;
  const { scale, transform } = screenTransform(props.toScreen);
  return (
    <svg aria-hidden="true" className="map-layer sub-territory-wash">
      <defs>
        <pattern height={7} id="sub-territory-hatch" patternTransform={`scale(${String(1 / scale)}) rotate(45)`} patternUnits="userSpaceOnUse" width={7}>
          <line x1={0} x2={0} y1={0} y2={7} />
        </pattern>
      </defs>
      <g transform={transform}>
        <WashPaths borders={props.borders ?? false} contested={partition.contested} game={props.game} hitTestAll={zoomed} paths={paths} scenario={props.scenarioPackage.scenario} />
      </g>
    </svg>
  );
}

/** Above the vector layer: names and capital stars on zoom, and the focused sub-territory's outline. */
export function SubTerritoryLayer(props: SubTerritoryLayerProps): JSX.Element | null {
  const partition = partitionOf(props);
  const focused = props.view.focusedSubTerritoryId;
  const zoomed = props.level !== "overview";
  const paths = useSubTerritoryPaths(partition !== undefined && focused !== undefined ? partition.svgPath : undefined);
  if (partition === undefined || (!zoomed && focused === undefined)) return null;
  const { scenario } = props.scenarioPackage;
  const entries = partition.map.subTerritories?.entries;
  const focusedPath = focused === undefined ? undefined : paths?.get(focused);
  const focusedTerritory = focused === undefined ? undefined : scenario.index.subTerritories.get(focused)?.territoryId;
  const named = (territoryId: TerritoryId): boolean => props.borders === true || partition.contested.has(territoryId) || territoryId === focusedTerritory;
  const { transform } = screenTransform(props.toScreen);
  return (
    <svg aria-hidden="true" className="map-layer sub-territory-labels">
      {focusedPath === undefined ? null : (
        <g transform={transform}>
          <path className="sub-territory-focus-outline" d={focusedPath} fillRule="evenodd" />
        </g>
      )}
      {!zoomed || entries === undefined ? null : scenario.subTerritories.map((sub) => {
        const entry = entries.get(sub.id);
        if (entry === undefined) return null;
        const capital = scenario.index.territories.get(sub.territoryId)?.capitalSubTerritoryId === sub.id;
        const label = props.toScreen(entry.label);
        const star = props.toScreen(entry.capital);
        const hasCity = sub.cityIds.length > 0;
        return (
          <g data-sub-territory-label={sub.id} key={sub.id}>
            {named(sub.territoryId) && !(capital && hasCity) ? <text className="sub-territory-name" x={label.x} y={label.y}>{sub.name}</text> : null}
            {capital ? <text className="sub-territory-star" x={star.x} y={star.y - (hasCity ? 7 : 0)}>{glyphs.star}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * X3: the sub-territory under a screen point, from the wash's hit paths (zoomed in only). The
 * wash sits under the vector layer, so it is found by point rather than by event target.
 */
export function subTerritoryAt(x: number, y: number): SubTerritoryId | undefined {
  if (typeof document.elementsFromPoint !== "function") return undefined;
  for (const element of document.elementsFromPoint(x, y)) {
    const id = element.closest("[data-sub-territory-id]")?.getAttribute("data-sub-territory-id");
    if (id !== null && id !== undefined) return id as SubTerritoryId;
  }
  return undefined;
}
