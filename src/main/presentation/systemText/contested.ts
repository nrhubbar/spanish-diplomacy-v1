import type { PathSurrenderOutcome, RailDamagedOutcome, WithdrewOutcome } from "../../engine/types";

/** Placeholder report lines for the contested outcomes. TODO(m3r1-sub-territories): full sentences; owner: m3r1-sub-territories. */
export const contestedLines: Readonly<Record<(WithdrewOutcome | PathSurrenderOutcome | RailDamagedOutcome)["kind"], string>> = {
  "path-surrender": "Cut-off units surrendered.",
  "rail-damaged": "Rail lines were damaged.",
  withdrew: "Units withdrew."
};
