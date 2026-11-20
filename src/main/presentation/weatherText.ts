import type { FrostbiteOutcome, Scenario, TimeRanOutOutcome } from "../engine/types";
import { factionName, territoryName } from "./text";

/** T6: "Republican Government's time ran out: 3 units held." */
export function describeTimeRanOut(scenario: Scenario, outcome: TimeRanOutOutcome): string {
  const count = outcome.heldUnitCount;
  const held = count === 0 ? "every unit had an order" : `${String(count)} ${count === 1 ? "unit" : "units"} held`;
  return `${factionName(scenario, outcome.factionId)}'s time ran out: ${held}.`;
}

/** T4: "Durruti Column lost 125 men to frostbite in Aragón." */
export function describeFrostbite(scenario: Scenario, outcome: FrostbiteOutcome): string {
  const name = scenario.index.units.get(outcome.unitId)?.name ?? "A unit";
  return `${name} lost ${String(outcome.men)} men to frostbite in ${territoryName(scenario, outcome.territoryId)}.`;
}
