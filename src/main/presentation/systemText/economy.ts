import type { EconomyTurnOutcome } from "../../engine/types";

/**
 * Report lines for the economy outcomes ($1-$8), one per kind. The join in `systemText.ts`
 * passes only the kind, so these name no place or amount; the Build tab and the header chips
 * show the details. Owner: m3r1-economy-builds.
 */
export const economyLines: Readonly<Record<EconomyTurnOutcome["kind"], string>> = {
  "build-completed": "Construction finished: a building stands or a level rose.",
  "build-forfeited": "A captured sub-territory's work in progress passed to its new holder; the payment was lost.",
  "build-progressed": "Construction went on for another turn.",
  "build-queued": "New construction was paid for and queued.",
  "build-refunded": "Construction that had not started was refunded.",
  income: "Income arrived from territories held whole."
};
