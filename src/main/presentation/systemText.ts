import type { SystemOutcome, TurnOutcome } from "../engine/types";
import { airLines } from "./systemText/air";
import { contestedLines } from "./systemText/contested";
import { economyLines } from "./systemText/economy";
import { generalsLines } from "./systemText/generals";
import { moraleLines } from "./systemText/morale";
import { recruitmentLines } from "./systemText/recruitment";
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
  ...recruitmentLines,
  ...weatherLines
} satisfies Readonly<Record<SystemOutcome["kind"], string>>;

export function isSystemOutcome(outcome: TurnOutcome): outcome is SystemOutcome {
  return outcome.kind in systemLines;
}

export function describeSystemOutcome(outcome: SystemOutcome): string {
  return systemLines[outcome.kind];
}
