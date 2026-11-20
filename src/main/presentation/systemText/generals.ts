import type { GeneralId, GeneralsTurnOutcome, Scenario } from "../../engine/types";
import { factionLabel, type ReportLines, territoryLabel } from "./lines";

/** U5, D7: the generals outcomes as report sentences. All are public: generals show on the board. */

function general(scenario: Scenario, id: GeneralId): string {
  return scenario.index.generals.get(id)?.name ?? id;
}

export const generalsLines: ReportLines<GeneralsTurnOutcome> = {
  "general-died": (outcome, { scenario }) =>
    `${general(scenario, outcome.generalId)} was killed when his army was broken in ${territoryLabel(scenario, outcome.territoryId)}.`,
  "general-sacked": (outcome, { scenario }) =>
    `${factionLabel(scenario, outcome.order.factionId)} relieved ${general(scenario, outcome.generalId)} of command.`,
  "replacement-due": (outcome, { scenario }) =>
    `${general(scenario, outcome.generalId)} has been called to command for ${factionLabel(scenario, outcome.factionId)} and arrives on turn ${String(outcome.arrivesOnTurn)}.`,
  "general-moved": (outcome, { scenario }) => {
    const name = scenario.index.units.get(outcome.order.unitId)?.name ?? general(scenario, outcome.order.unitId.replace(/^general-/u, "") as GeneralId);
    const to = territoryLabel(scenario, outcome.order.to);
    return outcome.arrived ? `${name} went with his army to ${to}.` : `${name} stayed behind: his army did not reach ${to}.`;
  },
  "replacement-arrived": (outcome, { scenario }) =>
    `${general(scenario, outcome.generalId)} took command in ${territoryLabel(scenario, outcome.territoryId)}.`
};
