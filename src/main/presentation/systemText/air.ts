import type { AirTurnOutcome } from "../../engine/types";

/** Placeholder report lines for the air outcomes. TODO(m3r1-air-generals): full sentences; owner: m3r1-air-generals. */
export const airLines: Readonly<Record<AirTurnOutcome["kind"], string>> = {
  "air-support": "Aircraft supported a battle.",
  grounded: "An aircraft could not fly.",
  interception: "Fighters intercepted a raid.",
  raid: "Aircraft raided a province.",
  recon: "Aircraft flew a reconnaissance mission."
};
