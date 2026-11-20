import type { RecruitmentTurnOutcome, Resources, Scenario } from "../../engine/types";
import { replenishPriceLabel, resourcesLabel, turnsLabel } from "../recruitment";
import { capitalLabel, type ReportLines, territoryLabel, typeLabel, unitLabel } from "./lines";

/** " 6 Funds refunded." after a reason, or nothing when nothing comes back. */
function refunded(scenario: Scenario, amount: Resources): string {
  const label = resourcesLabel(scenario, amount);
  return label === "nothing" ? "" : ` ${label} refunded.`;
}

/**
 * R2-R7, C8: the recruitment outcomes as report sentences, naming the unit, where it trains and
 * what it cost. Every kind but `training-completed` is private (CT-46), so it reaches only its
 * own faction or a viewer whose recon reveals the territory.
 */
export const recruitmentLines: ReportLines<RecruitmentTurnOutcome> = {
  "training-started": (outcome, { scenario }) =>
    `${unitLabel(scenario, outcome.unitId)} began training at ${capitalLabel(scenario, outcome.order.territoryId)} for ${resourcesLabel(scenario, outcome.paid)}; ready in ${turnsLabel(outcome.turnsLeft)}.`,
  "training-completed": (outcome, { scenario }) =>
    `${unitLabel(scenario, outcome.unitId)} finished training at ${capitalLabel(scenario, outcome.territoryId)}. It can move next turn.`,
  "training-paused": (outcome, { scenario }) =>
    `${unitLabel(scenario, outcome.unitId)} stopped training at ${capitalLabel(scenario, outcome.territoryId)} while ${territoryLabel(scenario, outcome.territoryId)} is contested.`,
  "training-refunded": (outcome, { scenario }) =>
    `A ${typeLabel(scenario, outcome.typeId)} at ${capitalLabel(scenario, outcome.territoryId)} was not raised. ${outcome.reason}${refunded(scenario, outcome.refund)}`,
  "replenish-applied": (outcome, { scenario }) =>
    `${unitLabel(scenario, outcome.order.unitId)} took in ${String(outcome.men)} men for ${replenishPriceLabel(scenario, outcome.paid)}${outcome.recovered ? " and recovered its morale" : ""}.`,
  "replenish-cancelled": (outcome, { scenario }) =>
    `${unitLabel(scenario, outcome.order.unitId)} was not replenished: ${outcome.reason}${refunded(scenario, outcome.refund)}`
};
