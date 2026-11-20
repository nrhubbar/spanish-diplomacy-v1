import type { FatigueOutcome, MoraleTurnOutcome } from "../../engine/types";
import { plural, type ReportLines, territoryLabel, unitLabel } from "./lines";

/** C4-C7, U5: the morale outcomes as report sentences. Owners: m3r1-d20-combat (fatigue) and m3r1-air-generals (rally). Both are public. */

/** C6: one unit's fatigue, in a sentence; `unit` is its name. */
export function fatigueSentence(outcome: FatigueOutcome, unit: string): string {
  if (outcome.fatigue === 0) return `${unit} rested and is no longer fatigued.`;
  if (outcome.demoralized) return `${unit} attacked until exhausted (fatigue ${String(outcome.fatigue)}) and is demoralized.`;
  return `${unit} is tiring from the attack (fatigue ${String(outcome.fatigue)}).`;
}

export const moraleLines: ReportLines<MoraleTurnOutcome> = {
  fatigue: (outcome, { scenario }) => fatigueSentence(outcome, unitLabel(scenario, outcome.unitId)),
  rallied: (outcome, { scenario }) => {
    const count = outcome.unitIds.length;
    const general = scenario.index.generals.get(outcome.generalId)?.name ?? outcome.generalId;
    return `${general} rallied ${String(count)} demoralized ${plural(count, "unit", "units")} in ${territoryLabel(scenario, outcome.territoryId)}.`;
  }
};
