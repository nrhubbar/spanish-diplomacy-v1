import type { HeldBackCause, MoveLeg, MovementTurnOutcome, Scenario, TerritoryId } from "../../engine/types";
import { glyphs } from "../glyphs";
import { subTerritoryName } from "../movement";
import { factionLabel, listNames, plural, type ReportLines, territoryLabel, unitsLabel } from "./lines";

/** M1-M5: the movement outcomes as report sentences. All are public: armies show on the board. */

/** M3-M5: "Madrid \u2192 Valencia (rail) \u2192 Arag\u00f3n". */
function routeText(scenario: Scenario, from: TerritoryId, legs: readonly MoveLeg[]): string {
  return [territoryLabel(scenario, from), ...legs.map((leg) => (leg.kind === "land" ? territoryLabel(scenario, leg.to) : `${territoryLabel(scenario, leg.to)} (${leg.kind})`))].join(` ${glyphs.arrow} `);
}

function heldBackText(scenario: Scenario, cause: HeldBackCause, to: TerritoryId): string {
  switch (cause.reason) {
    case "allowance":
      return `the route to ${territoryLabel(scenario, to)} is longer than it can move this turn`;
    case "rail-full": {
      const { boarding, left, places } = cause.rail;
      const station = subTerritoryName(scenario, boarding);
      return left === 0
        ? `the trains at ${station} had no places left this turn`
        : `the trains at ${station} had only ${String(left)} ${plural(left, "place", "places")} left this turn, and ${String(places)} units were to board`;
    }
    case "port-landings":
      return `the port at ${territoryLabel(scenario, to)} had no room left this turn`;
    case "amphibious-lane":
      return `the sea lane to ${territoryLabel(scenario, to)} already carried a landing this turn`;
    case "cannot-fight":
      return `with no unit that can fight, it cannot enter ${territoryLabel(scenario, to)} on its own`;
  }
}

export const movementLines: ReportLines<MovementTurnOutcome> = {
  "move-held-back": (outcome, { scenario }) =>
    `${factionLabel(scenario, outcome.factionId)}: ${unitsLabel(scenario, outcome.unitIds)} stayed in ${territoryLabel(scenario, outcome.from)}; ${heldBackText(scenario, outcome, outcome.to)}.`,
  "move-intercepted": (outcome, { scenario }) => {
    const enemies = listNames(outcome.byFactionIds.map((id) => factionLabel(scenario, id)));
    const they = plural(outcome.unitIds.length, "it", "they");
    return `${factionLabel(scenario, outcome.factionId)}: ${unitsLabel(scenario, outcome.unitIds)} stopped in ${territoryLabel(scenario, outcome.stoppedAt)} on the way to ${territoryLabel(scenario, outcome.to)}, as ${enemies} entered it; ${they} will defend it.`;
  },
  "move-transit": (outcome, { scenario }) =>
    `${factionLabel(scenario, outcome.factionId)}: ${unitsLabel(scenario, outcome.unitIds)} travelled ${routeText(scenario, outcome.from, outcome.legs)}.`
};
