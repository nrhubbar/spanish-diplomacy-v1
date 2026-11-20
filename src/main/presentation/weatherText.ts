import { raisedDefinition } from "../engine/recruitment/rules";
import type { FrostbiteOutcome, Scenario, TimeRanOutOutcome } from "../engine/types";
import { factionName, territoryName } from "./text";

/** T6: "Republican Government's time ran out: 3 units held." */
export function describeTimeRanOut(scenario: Scenario, outcome: TimeRanOutOutcome): string {
  const count = outcome.heldUnitCount;
  const held = count === 0 ? "every unit had an order" : `${String(count)} ${count === 1 ? "unit" : "units"} held`;
  return `${factionName(scenario, outcome.factionId)}'s time ran out: ${held}.`;
}

/** T4: "Durruti Column lost 125 men to frostbite in Arag\u00f3n." */
export function describeFrostbite(scenario: Scenario, outcome: FrostbiteOutcome): string {
  // Recruited units (R6) are named from their ids, as scenario units are.
  const name = scenario.index.units.get(outcome.unitId)?.name ?? raisedDefinition(scenario, outcome.unitId)?.name ?? "A unit";
  const where = territoryName(scenario, outcome.territoryId);
  return outcome.destroyed === true
    ? `${name} lost ${String(outcome.men)} men to frostbite in ${where} and broke up.`
    : `${name} lost ${String(outcome.men)} men to frostbite in ${where}.`;
}
