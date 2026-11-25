import { requireUnitDefinition, requireUnitType } from "../lookup";
import type { Phase, TurnDraft } from "../phases/draft";
import type { DisbandOrder, GameState, Order, RecruitmentRefusal, RecruitmentTurnOutcome, Scenario, UnitState, ValidationResult } from "../types";

/** D1: Disband sends one of a faction's own units home: nothing comes back, and the men are not casualties. */

/** D1: static checks of one Disband order: the faction's own unit, of a type that takes the order (not generals). Contested ground does not matter. */
export function validateDisbandOrder(scenario: Scenario, state: GameState, order: DisbandOrder): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, refusal: { code: "unknown-unit" } };
  if (unit.factionId !== order.factionId) return { ok: false, refusal: { code: "unit-of-another-faction" } };
  const problem = disbandProblem(scenario, state, unit);
  return problem === undefined ? { ok: true } : { ok: false, refusal: problem };
}

/** Why this unit cannot disband, or undefined when it can. */
export function disbandProblem(scenario: Scenario, state: Pick<GameState, "raised">, unit: Pick<UnitState, "id">): RecruitmentRefusal | undefined {
  const type = requireUnitType(scenario, (state.raised[unit.id] ?? requireUnitDefinition(scenario, unit.id)).type);
  return type.orders.includes("disband") ? undefined : { code: "type-cannot-disband", unitTypeId: type.id };
}

/** The Disband orders that passed validation at reveal. */
export function validDisbands(draft: TurnDraft): readonly DisbandOrder[] {
  const rejected = new Set<Order>(draft.orders.rejected.map((outcome) => outcome.order));
  return draft.input.submissions.flatMap((submission) => submission.orders.filter((order): order is DisbandOrder => order.kind === "disband" && !rejected.has(order)));
}

/**
 * Section 2 step 10, before training advances: units with a Disband order leave the map. They
 * stood and fought like any unit without an order until now; one already lost has nothing left
 * to disband.
 */
export const disbandUnits: Phase = (draft) => {
  const leaving = validDisbands(draft).flatMap((order) => {
    const unit = draft.armies[order.unitId];
    return unit === undefined ? [] : [{ order, unit }];
  });
  if (leaving.length === 0) return draft;
  const gone = new Set(leaving.map(({ unit }) => unit.id));
  const events = leaving.map(({ order, unit }): RecruitmentTurnOutcome => ({ kind: "unit-disbanded", order, territoryId: unit.territoryId, unitId: unit.id }));
  return { ...draft, armies: Object.fromEntries(Object.entries(draft.armies).filter(([id]) => !gone.has(id as UnitState["id"]))), events: [...draft.events, ...events] };
};
