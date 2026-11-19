import type { SystemOutcome, TurnOutcome } from "../engine/types";

/**
 * Placeholder report lines for the Milestone 3 outcomes, one per kind. Each slice replaces its
 * own lines with full sentences: TODO(m3r1-weather-timer), TODO(m3r1-recruit-replenish),
 * TODO(m3r1-economy-builds), TODO(m3r1-sub-territories), TODO(m3r1-air-generals),
 * TODO(m3r1-d20-combat).
 */
const systemLines: Readonly<Record<SystemOutcome["kind"], string>> = {
  "air-support": "Aircraft supported a battle.",
  "build-completed": "A building project was completed.",
  "build-forfeited": "A building project changed hands.",
  "build-progressed": "A building project progressed.",
  "build-queued": "A building project was queued.",
  "build-refunded": "A building project was refunded.",
  fatigue: "A unit's fatigue changed.",
  frostbite: "A unit lost men to frostbite.",
  "general-died": "A general was killed.",
  "general-sacked": "A general was dismissed.",
  grounded: "An aircraft could not fly.",
  income: "Income was collected.",
  interception: "Fighters intercepted a raid.",
  "path-surrender": "Cut-off units surrendered.",
  raid: "Aircraft raided a province.",
  "rail-damaged": "Rail lines were damaged.",
  rallied: "A general rallied his army.",
  recon: "Aircraft flew a reconnaissance mission.",
  "replacement-arrived": "A new general took command.",
  "replacement-due": "A new general is on his way.",
  "replenish-applied": "A unit was replenished.",
  "replenish-cancelled": "A replenishment was cancelled.",
  "time-ran-out": "A player's time ran out.",
  "training-completed": "A new unit finished training.",
  "training-paused": "Training was paused.",
  "training-refunded": "Training was refunded.",
  "training-started": "A new unit began training.",
  "weather-rolled": "The weather changed.",
  withdrew: "Units withdrew."
};

export function isSystemOutcome(outcome: TurnOutcome): outcome is SystemOutcome {
  return outcome.kind in systemLines;
}

export function describeSystemOutcome(outcome: SystemOutcome): string {
  return systemLines[outcome.kind];
}
