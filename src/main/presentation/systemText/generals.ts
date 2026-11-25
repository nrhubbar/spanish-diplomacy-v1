import { requireGeneral } from "../../engine/lookup";
import type { GeneralId, GeneralsTurnOutcome, Scenario } from "../../engine/types";
import { factionLabel, type ReportLines, territoryLabel } from "./lines";

/** U5, D7: the generals outcomes as report sentences. All are public: generals show on the board. */

function general(scenario: Scenario, id: GeneralId): string {
  return requireGeneral(scenario, id).name;
}

export const generalsLines: ReportLines<GeneralsTurnOutcome> = {
  "general-died": (outcome, { scenario }) =>
    `${general(scenario, outcome.generalId)} was killed when his army was broken in ${territoryLabel(scenario, outcome.territoryId)}.`,
  "general-sacked": (outcome, { scenario }) =>
    `${factionLabel(scenario, outcome.order.factionId)} relieved ${general(scenario, outcome.generalId)} of command.`,
  "replacement-due": (outcome, { scenario }) =>
    `${general(scenario, outcome.generalId)} has been called to command for ${factionLabel(scenario, outcome.factionId)} and arrives on turn ${String(outcome.arrivesOnTurn)}.`,
  "replacement-arrived": (outcome, { scenario }) =>
    `${general(scenario, outcome.generalId)} took command in ${territoryLabel(scenario, outcome.territoryId)}.`
};
