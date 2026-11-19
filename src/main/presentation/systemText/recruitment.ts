import type { RecruitmentTurnOutcome } from "../../engine/types";

/** Placeholder report lines for the recruitment outcomes. TODO(m3r1-recruit-replenish): full sentences; owner: m3r1-recruit-replenish. */
export const recruitmentLines: Readonly<Record<RecruitmentTurnOutcome["kind"], string>> = {
  "replenish-applied": "A unit was replenished.",
  "replenish-cancelled": "A replenishment was cancelled.",
  "training-completed": "A new unit finished training.",
  "training-paused": "Training was paused.",
  "training-refunded": "Training was refunded.",
  "training-started": "A new unit began training."
};
