import type { GameState, Refusal, ResourceId, Resources, Scenario, UnitId, UnitState } from "../engine/types";
import { andList } from "./queues";
import { replenishDetail } from "./recruitment";
import { replenishSkipText } from "./refusals";
import { requireResource } from "../engine/lookup";
import { unitName } from "./text";

/** U12: why a Replenish order leaves a unit out: the rules, its price (the resources short), or next turn's upkeep (D1). */
export type ReplenishSkipReason =
  | { readonly code: "refused"; readonly refusal: Refusal }
  | { readonly code: "unpaid"; readonly resourceIds: readonly ResourceId[] }
  | { readonly code: "upkeep" };

/** U12: a selected unit the Replenish order leaves out, and why. */
export interface ReplenishSkip {
  readonly reason: ReplenishSkipReason;
  readonly unitId: UnitId;
}

/** U12: what Replenish does for the selection: the units it refills, those it skips and why, and the price. */
export interface ReplenishPlan {
  readonly cost: Resources;
  readonly ready: readonly UnitState[];
  readonly selected: number;
  readonly skipped: readonly ReplenishSkip[];
}

/** Why a unit is skipped, in a few words for a list: "at full strength", "not enough Funds and Manpower". */
function skipReason(scenario: Scenario, reason: ReplenishSkipReason): string {
  switch (reason.code) {
    case "refused":
      return replenishSkipText(scenario, reason.refusal);
    case "unpaid":
      return `not enough ${reason.resourceIds.length === 0 ? "Funds or Manpower" : reason.resourceIds.map((id) => requireResource(scenario, id).name).join(" and ")}`;
    case "upkeep":
      return "upkeep leaves too little next turn";
  }
}

/** U12: "Skips Madrid Assault and Civil Guards (at full strength) and General Miaja (General units cannot replenish)." */
export function skippedText(scenario: Scenario, skipped: readonly ReplenishSkip[]): string {
  const byReason = new Map<string, string[]>();
  for (const skip of skipped) {
    const reason = skipReason(scenario, skip.reason);
    byReason.set(reason, [...byReason.get(reason) ?? [], unitName(scenario, skip.unitId)]);
  }
  const parts = [...byReason].map(([reason, names]) => `${andList(names)} (${reason})`);
  return parts.length === 0 ? "" : `Skips ${andList(parts)}.`;
}

/** U12: the selection bar's line for Replenish: what it brings and costs, and which units it skips. */
export function replenishSelectionDetail(scenario: Scenario, state: GameState, plan: ReplenishPlan): string {
  if (plan.ready.length === 0) return `No selected unit can replenish. ${skippedText(scenario, plan.skipped)}`;
  const detail = replenishDetail(scenario, state, plan.ready);
  return plan.skipped.length === 0 ? detail : `Refills ${String(plan.ready.length)} of the ${String(plan.selected)} selected units: ${detail}. ${skippedText(scenario, plan.skipped)}`;
}
