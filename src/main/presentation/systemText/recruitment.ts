import { requireUnitDefinition } from "../../engine/lookup";
import type { RecruitmentTurnOutcome, Scenario, TerritoryId, UnitTypeId } from "../../engine/types";
import { resourcesLabel, turnsLabel } from "../recruitment";

/** Short report lines for the recruitment outcomes, when no scenario is at hand. */
export const recruitmentLines: Readonly<Record<RecruitmentTurnOutcome["kind"], string>> = {
  "replenish-applied": "A unit was replenished.",
  "replenish-cancelled": "A replenishment was cancelled and refunded.",
  "training-completed": "A new unit finished training.",
  "training-paused": "Training was paused while the territory is contested.",
  "training-refunded": "A Recruit order was refunded.",
  "training-started": "A new unit began training."
};

const recruitmentKinds = new Set<string>(Object.keys(recruitmentLines));

export function isRecruitmentOutcome(outcome: { readonly kind: string }): outcome is RecruitmentTurnOutcome {
  return recruitmentKinds.has(outcome.kind);
}

/** R2-R7, C8: full report sentences, naming units, territories and amounts. */
export function describeRecruitmentOutcome(scenario: Scenario, outcome: RecruitmentTurnOutcome): string {
  const place = (id: TerritoryId): string => scenario.index.territories.get(id)?.name ?? id;
  const typeName = (id: UnitTypeId): string => scenario.index.unitTypes.get(id)?.name ?? id;
  switch (outcome.kind) {
    case "training-started":
      return `${requireUnitDefinition(scenario, outcome.unitId).name} began training in ${place(outcome.order.territoryId)} for ${resourcesLabel(scenario, outcome.paid)}; ready in ${turnsLabel(outcome.turnsLeft)}.`;
    case "training-completed":
      return `${requireUnitDefinition(scenario, outcome.unitId).name} finished training in ${place(outcome.territoryId)}. It can move next turn.`;
    case "training-paused":
      return `${requireUnitDefinition(scenario, outcome.unitId).name} stopped training while ${place(outcome.territoryId)} is contested.`;
    case "training-refunded":
      return `A ${typeName(outcome.typeId)} in ${place(outcome.territoryId)} was not raised. ${outcome.reason}`;
    case "replenish-applied":
      return `${requireUnitDefinition(scenario, outcome.order.unitId).name} took in ${String(outcome.men)} men${outcome.recovered ? " and recovered its morale" : ""}.`;
    case "replenish-cancelled":
      return `${requireUnitDefinition(scenario, outcome.order.unitId).name} was not replenished: ${outcome.reason} ${resourcesLabel(scenario, outcome.refund)} refunded.`;
  }
}
