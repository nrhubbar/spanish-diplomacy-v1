import type { FatigueOutcome, RalliedOutcome } from "../../engine/types";

/** Placeholder report lines for the morale outcomes. TODO(m3r1-d20-combat): full sentences; owner: m3r1-d20-combat (fatigue) and m3r1-air-generals (rally). */
export const moraleLines: Readonly<Record<(RalliedOutcome | FatigueOutcome)["kind"], string>> = {
  fatigue: "A unit's fatigue changed.",
  rallied: "A general rallied his army."
};
