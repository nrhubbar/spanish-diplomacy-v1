import type { JSX } from "react";
import { battleResults, type GameState, type Scenario } from "../engine/types";
import { isBattle, resultKeyOf } from "../presentation/grades";
import { medallionMarkup } from "../assets/outcomes/outcomeArt";
import { kindsOnBoard } from "../presentation/mapLayers";
import { type OutcomeKey, outcomeKeys } from "../presentation/outcomes";
import { outcomeText } from "../presentation/outcomeText";
import type { MapView } from "./view";
import { WorksBadge } from "./WorksBadge";
import { EconomyIcon } from "../components/economy/EconomyIcon";
import { glyphs } from "../presentation/glyphs";
import { SiteIcon } from "../components/SiteIcons";
import { defaultLayers, type LayerId } from "./layers/layerChoice";
import { roadKinds } from "./layers/roads";

/** V9, U13: legend entries come from what the map is actually showing, layers included. */
export function legendEntries(scenario: Scenario, game: GameState, view: MapView, layers: readonly LayerId[] = defaultLayers): readonly string[] {
  const controls = Object.values(game.control);
  const routeKinds = new Set(view.outcomes.map((outcome) => outcome.kind));
  const results = new Set(view.outcomes.flatMap((outcome) => (isBattle(outcome) ? [resultKeyOf(scenario, outcome)] : [])));
  const units = Object.values(game.units);
  const kinds = kindsOnBoard(scenario, game);
  const lines = layers.includes("order-lines");
  const roads = layers.includes("roads") ? roadKinds(scenario) : undefined;
  return [
    ...(controls.some((control) => control.kind === "contested") ? ["contested"] : []),
    ...(scenario.connections.some((connection) => connection.kind === "sea") ? ["sea"] : []),
    ...(view.destinationIds.length > 0 ? [view.destinationEstimates === undefined ? "destination" : "destination-odds"] : []),
    ...(lines && view.plannedOrders.length > 0 ? ["planned"] : []),
    ...(lines && (routeKinds.has("successful-move") || routeKinds.has("reinforcement-arrived")) ? ["moved"] : []),
    ...(lines && routeKinds.has("bounced-move") ? ["bounced"] : []),
    ...(lines && routeKinds.has("disbanded-move") ? ["disbanded"] : []),
    ...(layers.includes("battles") ? battleResults.filter((result) => results.has(result)) : []),
    ...(units.some((unit) => unit.morale.demoralized) ? ["demoralized"] : []),
    ...(Object.values(game.fortification).some((works) => works.level > 0) ? ["dug-in"] : []),
    // m11, X6, X8, U2, U5: rail, aircraft and generals, where the map shows them.
    ...(layers.includes("rail") && Object.values(game.subTerritories).some((site) => site.rail > 0) ? ["rail"] : []),
    // U8: the Roads layer's kinds, where the scenario has them.
    ...(roads?.main === true ? ["main-road"] : []),
    ...(roads?.track === true ? ["track"] : []),
    ...(roads?.pass === true ? ["pass"] : []),
    ...(kinds.has("air") ? ["aircraft"] : []),
    ...(kinds.has("general") ? ["general"] : [])
  ];
}

const labels: Readonly<Record<string, string>> = {
  bounced: "Bounced move",
  contested: "Contested",
  "destination-odds": "Possible destination: approximate odds and chance to take it",
  destination: "Possible destination",
  disbanded: "Units lost or surrendered",
  moved: "Completed move",
  planned: "Planned move",
  sea: "Sea crossing",
  demoralized: "Demoralized: half values, cannot attack",
  "dug-in": "Dug in: one pip per level of works",
  rail: "Stations and the rail network; lit where the selected units can ride",
  "main-road": "Main road",
  track: "Track (minor road)",
  pass: "Mountain pass: hover for its name",
  aircraft: "Aircraft at their airfield (BOMB, FTR, RCN)",
  general: "General with his units"
};

/** Battle results and statuses draw H's medallion, with a neutral ring: they are not one faction's. */
const legendRing = "#5b4d40";

function outcomeEntry(entry: string): OutcomeKey | undefined {
  return outcomeKeys.find((key) => key === entry);
}

function Swatch({ entry }: { readonly entry: string }): JSX.Element {
  const key = outcomeEntry(entry);
  if (key === "dug-in") return <span className="legend-icon"><WorksBadge level={2} max={3} /></span>;
  if (entry === "rail") return <span aria-hidden="true" className="legend-icon"><SiteIcon kind="rail" /></span>;
  if (entry === "aircraft") return <span aria-hidden="true" className="legend-icon"><EconomyIcon name="plane" /></span>;
  if (entry === "pass") return <span aria-hidden="true" className="legend-icon legend-pass"><svg viewBox="-7 -7 14 14"><circle className="road-pass-disc" r={6} /><path className="road-pass-chevron" d="M-3.5 2 L0 -2 L3.5 2" /></svg></span>;
  if (entry === "general") return <span aria-hidden="true" className="legend-icon legend-glyph">{glyphs.star}</span>;
  return key === undefined
    ? <span aria-hidden="true" className={`legend-swatch legend-${entry}`} />
    : <span aria-hidden="true" className="legend-icon legend-medallion" dangerouslySetInnerHTML={{ __html: medallionMarkup(key, legendRing) }} />;
}

interface MapLegendProps {
  readonly game: GameState;
  /** U13: the layers shown, so the legend names only what is drawn. */
  readonly layers?: readonly LayerId[];
  readonly scenario: Scenario;
  readonly view: MapView;
}

export function MapLegend({ game, layers = defaultLayers, scenario, view }: MapLegendProps): JSX.Element {
  const present = new Set(Object.values(game.control).flatMap((control) => (control.kind === "controlled" ? [control.factionId] : control.factionIds)));
  const hasArmies = Object.keys(game.units).length > 0;
  return (
    <details className="map-legend" data-map-control="">
      <summary>Legend</summary>
      <ul>
        {scenario.factions.filter((faction) => present.has(faction.id)).map((faction) => (
          <li key={faction.id}>
            <span aria-hidden="true" className="legend-swatch" style={{ background: faction.color }} />
            {faction.name}
          </li>
        ))}
        {hasArmies ? (
          <li>
            <span aria-hidden="true" className="legend-counter">4-6</span>
            Unit: attack-defence, men as a bar
          </li>
        ) : null}
        {legendEntries(scenario, game, view, layers).map((entry) => {
          const key = outcomeEntry(entry);
          return (
            <li key={entry}>
              <Swatch entry={entry} />
              {labels[entry] ?? (key === undefined ? entry : `Battle: ${outcomeText[key].title}`)}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
