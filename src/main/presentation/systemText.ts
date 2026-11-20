import type { SystemOutcome, TurnOutcome } from "../engine/types";
import { airLines } from "./systemText/air";
import { contestedLines } from "./systemText/contested";
import { economyLines } from "./systemText/economy";
import { generalsLines } from "./systemText/generals";
import type { ReportLineContext, ReportLines } from "./systemText/lines";
import { moraleLines } from "./systemText/morale";
import { movementLines } from "./systemText/movement";
import { recruitmentLines } from "./systemText/recruitment";
import { weatherLines } from "./systemText/weather";

export type { ReportLineContext } from "./systemText/lines";

/**
 * Report lines for the Milestone 3 outcomes, one file per area under `systemText/` to mirror
 * `engine/types/outcomes/`, so each slice edits only its own file. Each area gives one function
 * per kind, which receives the whole typed outcome and the report's context (`systemText/lines.ts`).
 * The join fails to compile when a kind has no line.
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
} satisfies ReportLines<SystemOutcome>;

export function isSystemOutcome(outcome: TurnOutcome): outcome is SystemOutcome {
  return outcome.kind in systemLines;
}

/** One report sentence for a Milestone 3 outcome, with names and amounts. */
export function describeSystemOutcome(outcome: SystemOutcome, context: ReportLineContext): string {
  // Each line is typed for its own kind; the lookup by `outcome.kind` keeps them matched.
  const line = systemLines[outcome.kind] as (owned: SystemOutcome, at: ReportLineContext) => string;
  return line(outcome, context);
}
