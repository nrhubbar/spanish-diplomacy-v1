import type { JSX } from "react";
import type { GameState, Scenario } from "../engine/types";
import type { MapView } from "./view";

/** V9: legend entries come from what the map is actually showing. */
export function legendEntries(scenario: Scenario, game: GameState, view: MapView): readonly string[] {
  const controls = Object.values(game.control);
  const routeKinds = new Set(view.outcomes.map((outcome) => outcome.kind));
  return [
    ...(controls.some((control) => control.kind === "contested") ? ["contested"] : []),
    ...(scenario.connections.some((connection) => connection.kind === "sea") ? ["sea"] : []),
    ...(view.destinationIds.length > 0 ? ["destination"] : []),
    ...(view.plannedOrders.length > 0 ? ["planned"] : []),
    ...(routeKinds.has("successful-move") ? ["moved"] : []),
    ...(routeKinds.has("bounced-move") ? ["bounced"] : []),
    ...(routeKinds.has("disbanded-move") ? ["disbanded"] : [])
  ];
}

const labels: Readonly<Record<string, string>> = {
  bounced: "Bounced move",
  contested: "Contested",
  destination: "Possible destination",
  disbanded: "Army lost",
  moved: "Completed move",
  planned: "Planned move",
  sea: "Sea crossing"
};

export function MapLegend({ game, scenario, view }: { readonly game: GameState; readonly scenario: Scenario; readonly view: MapView }): JSX.Element {
  const present = new Set(Object.values(game.control).flatMap((control) => (control.kind === "controlled" ? [control.factionId] : control.factionIds)));
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
        {legendEntries(scenario, game, view).map((entry) => (
          <li key={entry}>
            <span aria-hidden="true" className={`legend-swatch legend-${entry}`} />
            {labels[entry]}
          </li>
        ))}
      </ul>
    </details>
  );
}
