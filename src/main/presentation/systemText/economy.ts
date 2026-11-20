import { currentLevel } from "../../engine/economy/catalogue";
import type { BuildProject, EconomyTurnOutcome, SubTerritoryId } from "../../engine/types";
import { amountText, projectBaseName, signedAmountText } from "../economy";
import { factionLabel, type ReportLineContext, type ReportLines, subTerritoryLabel } from "./lines";

/**
 * $1-$8, U3: the economy outcomes as report sentences, naming the project, the sub-territory and
 * the amounts. Income, queued, progressing and refunded builds are private (CT-46); a forfeit
 * reaches both holders, and only the previous holder reads what it paid.
 */

/** "a Factory", or "Farms to level 2" once the level is known from the board. */
function finished(context: ReportLineContext, project: BuildProject, subTerritoryId: SubTerritoryId): string {
  const name = projectBaseName(context.scenario, project);
  if (project.kind === "building") return `a ${name}`;
  const site = context.state?.subTerritories[subTerritoryId];
  return site === undefined ? `${name} by a level` : `${name} to level ${String(currentLevel(site, project))}`;
}

export const economyLines: ReportLines<EconomyTurnOutcome> = {
  "build-queued": (outcome, { scenario }) => {
    const where = subTerritoryLabel(scenario, outcome.order.subTerritoryId);
    const when = outcome.position === 0 ? "work starts this turn" : `${String(outcome.position)} ahead of it in the queue`;
    return `${factionLabel(scenario, outcome.order.factionId)} paid ${amountText(scenario, outcome.paid, " and ")} for ${projectBaseName(scenario, outcome.order.project)} at ${where}; ${when}.`;
  },
  "build-progressed": (outcome, { scenario }) =>
    `${projectBaseName(scenario, outcome.project)} at ${subTerritoryLabel(scenario, outcome.subTerritoryId)}: ${String(outcome.progress)} of ${String(outcome.turns)} turns done.`,
  "build-completed": (outcome, context) =>
    `${factionLabel(context.scenario, outcome.factionId)} ${outcome.project.kind === "building" ? "built" : "raised"} ${finished(context, outcome.project, outcome.subTerritoryId)} at ${subTerritoryLabel(context.scenario, outcome.subTerritoryId)}.`,
  "build-forfeited": (outcome, { scenario, viewer }) => {
    const lost = viewer === outcome.previousHolder ? `; the ${amountText(scenario, outcome.lost, " and ")} paid for it is lost` : "";
    return `${projectBaseName(scenario, outcome.project)} at ${subTerritoryLabel(scenario, outcome.subTerritoryId)} passed, unfinished, from ${factionLabel(scenario, outcome.previousHolder)} to ${factionLabel(scenario, outcome.newHolder)}${lost}.`;
  },
  "build-refunded": (outcome, { scenario }) => {
    // $5: "captured" is the queue hand-over's code; other reasons are the order's refusal, in words.
    const reason = outcome.reason === "captured" ? "The sub-territory changed hands before work began." : outcome.reason;
    const refund = amountText(scenario, outcome.refund, " and ");
    return `${projectBaseName(scenario, outcome.project)} at ${subTerritoryLabel(scenario, outcome.subTerritoryId)} was not built. ${reason}${refund === "nothing" ? "" : ` ${refund} refunded.`}`;
  },
  income: (outcome, { scenario }) => {
    const cut = amountText(scenario, outcome.cut, " and ");
    const raids = cut === "nothing" ? "" : `, after raids cut ${cut}`;
    return `${factionLabel(scenario, outcome.factionId)}'s income from territories held whole: ${signedAmountText(scenario, outcome.paid)}${raids}.`;
  }
};
