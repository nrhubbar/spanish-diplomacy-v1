import type { FatigueOutcome, MoraleTurnOutcome } from "../../engine/types";

/** Report lines for the morale outcomes. Owners: m3r1-d20-combat (fatigue) and m3r1-air-generals (rally). */
export const moraleLines: Readonly<Record<MoraleTurnOutcome["kind"], string>> = {
  fatigue: "A unit's fatigue changed.",
  rallied: "A general rallied his army."
};

/** C6: one unit's fatigue, in a sentence; `unit` is its name. */
export function fatigueSentence(outcome: FatigueOutcome, unit: string): string {
  if (outcome.fatigue === 0) return `${unit} rested and is no longer fatigued.`;
  if (outcome.demoralized) return `${unit} attacked until exhausted (fatigue ${String(outcome.fatigue)}) and is demoralized.`;
  return `${unit} is tiring from the attack (fatigue ${String(outcome.fatigue)}).`;
}
