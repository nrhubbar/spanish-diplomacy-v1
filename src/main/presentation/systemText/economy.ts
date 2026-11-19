import type { BuildCompletedOutcome, BuildForfeitedOutcome, BuildProgressedOutcome, BuildQueuedOutcome, BuildRefundedOutcome, IncomeOutcome } from "../../engine/types";

/** Placeholder report lines for the economy outcomes. TODO(m3r1-economy-builds): full sentences; owner: m3r1-economy-builds. */
export const economyLines: Readonly<Record<(BuildQueuedOutcome | BuildProgressedOutcome | BuildCompletedOutcome | BuildForfeitedOutcome | BuildRefundedOutcome | IncomeOutcome)["kind"], string>> = {
  "build-completed": "A building project was completed.",
  "build-forfeited": "A building project changed hands.",
  "build-progressed": "A building project progressed.",
  "build-queued": "A building project was queued.",
  "build-refunded": "A building project was refunded.",
  income: "Income was collected."
};
