import type { ContestedTurnOutcome } from "../../engine/types";
import { factionLabel, type ReportLines, subTerritoryLabel, territoryLabel, unitLabel } from "./lines";

/**
 * C1, P6, $8: the contested outcomes as report sentences, owned by m3r1-sub-territories. All are
 * public: they show on the board. The sub-territories that changed hands are listed in the
 * report's territory changes (`SubTerritoryChanges`).
 */
export const contestedLines: ReportLines<ContestedTurnOutcome> = {
  withdrew: ({ order }, { scenario }) =>
    `${factionLabel(scenario, order.factionId)}: ${unitLabel(scenario, order.unitId)} withdrew from ${territoryLabel(scenario, order.from)} to ${territoryLabel(scenario, order.to)} through its own sub-territories.`,
  "path-surrender": (outcome, { scenario }) =>
    `${factionLabel(scenario, outcome.factionId)}: ${unitLabel(scenario, outcome.unitId)} was cut off in ${territoryLabel(scenario, outcome.from)} and surrendered; no path led out through its own sub-territories.`,
  "rail-damaged": (outcome, { scenario }) =>
    `Fighting damaged the rail at ${subTerritoryLabel(scenario, outcome.subTerritoryId)}: level ${String(outcome.before)} to ${String(outcome.after)}.`
};
