import type { GeneralDiedOutcome, GeneralSackedOutcome, ReplacementArrivedOutcome, ReplacementDueOutcome } from "../../engine/types";

/** Placeholder report lines for the generals outcomes. TODO(m3r1-air-generals): full sentences; owner: m3r1-air-generals. */
export const generalsLines: Readonly<Record<(GeneralDiedOutcome | GeneralSackedOutcome | ReplacementDueOutcome | ReplacementArrivedOutcome)["kind"], string>> = {
  "general-died": "A general was killed.",
  "general-sacked": "A general was dismissed.",
  "replacement-arrived": "A new general took command.",
  "replacement-due": "A new general is on his way."
};
