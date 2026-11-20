import type { ContestedTurnOutcome } from "../../engine/types";

/**
 * Report lines for the contested outcomes (C1, P6, $8), owned by m3r1-sub-territories. The join
 * in `systemText.ts` takes one fixed line per kind; the sub-territory changes are listed in the
 * report's territory changes (`SubTerritoryChanges`).
 */
export const contestedLines: Readonly<Record<ContestedTurnOutcome["kind"], string>> = {
  "path-surrender": "Units cut off from their own ground surrendered: no path led out through their sub-territories.",
  "rail-damaged": "Rail was damaged where the fighting spread into a new territory.",
  withdrew: "Units withdrew from contested ground through their own sub-territories."
};
