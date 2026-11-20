import type { Scenario, SystemOutcome, TurnOutcome } from "../engine/types";
import { airLines, describeAirOutcome, isAirOutcome } from "./systemText/air";
import { contestedLines } from "./systemText/contested";
import { economyLines } from "./systemText/economy";
import { describeGeneralsOutcome, describeRally, generalsLines, isGeneralsOutcome } from "./systemText/generals";
import { moraleLines } from "./systemText/morale";
import { movementLines } from "./systemText/movement";
import { describeRecruitmentOutcome, isRecruitmentOutcome, recruitmentLines } from "./systemText/recruitment";
import { weatherLines } from "./systemText/weather";

/**
 * Report lines for the Milestone 3 outcomes, one file per area under `systemText/` to mirror
 * `engine/types/outcomes/`, so each slice edits only its own file. The join fails to compile
 * when a kind has no line.
 */
const systemLines = {
  ...airLines,
  ...contestedLines,
  ...economyLines,
  ...generalsLines,
  ...moraleLines,
  ...movementLines,
  ...recruitmentLines,
  ...weatherLines
} satisfies Readonly<Record<SystemOutcome["kind"], string>>;

export function isSystemOutcome(outcome: TurnOutcome): outcome is SystemOutcome {
  return outcome.kind in systemLines;
}

export function describeSystemOutcome(outcome: SystemOutcome, scenario?: Scenario): string {
  // Areas with full sentences take the scenario (m3r1-air-generals: air and generals).
  if (scenario !== undefined && isAirOutcome(outcome)) return describeAirOutcome(scenario, outcome);
  if (scenario !== undefined && isGeneralsOutcome(outcome)) return describeGeneralsOutcome(scenario, outcome);
  if (scenario !== undefined && outcome.kind === "rallied") return describeRally(scenario, outcome);
  // Areas with full sentences take the scenario (m3r1-recruit-replenish: recruitment).
  if (scenario !== undefined && isRecruitmentOutcome(outcome)) return describeRecruitmentOutcome(scenario, outcome);
  return systemLines[outcome.kind];
}
