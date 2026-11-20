import { plannedSpend } from "../../engine/economy/catalogue";
import { priceReplenishments, recruitSiteProblem, recruitSlots, replenishProblem, typeLock } from "../../engine/recruitment/rules";
import { addResources, canAfford, subtractResources, treasuryOf } from "../../engine/resources";
import type { FactionId, GameState, Order, RecruitOrder, ReplenishOrder, Resources, Scenario, TerritoryId, UnitState, UnitTypeId } from "../../engine/types";
import type { Draft } from "../session";
import { type PlanningSession, availableUnitIds, feedback, selectedUnits, selecting, withDraft } from "./selection";

/**
 * X4, R2-R5: the draft's Recruit basket and Replenish orders. The engine answers every rule
 * question (`engine/recruitment/rules.ts`); these functions keep the draft consistent: a unit
 * has at most one order, and a territory's basket never exceeds its D7 number of orders.
 */

/** Every order the draft submits at End Turn: moves, then Recruit, Replenish and Build orders. */
export function draftOrders(draft: Draft): readonly Order[] {
  return [...draft.orders, ...(draft.replenishments ?? []), ...(draft.recruits ?? []), ...(draft.builds ?? [])];
}

/** The draft's Recruit orders for one type at one territory. */
export function recruitQuantity(draft: Draft, territoryId: TerritoryId, typeId: UnitTypeId): number {
  return (draft.recruits ?? []).filter((order) => order.territoryId === territoryId && order.unitTypeId === typeId).length;
}

/** What the draft's Recruit and Replenish orders will cost at reveal; Replenish orders in turn against the carry (B2). */
export function basketCost(scenario: Scenario, session: PlanningSession): Resources {
  const recruits = (session.draft.recruits ?? []).reduce<Resources>(
    (sum, order) => addResources(sum, scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.cost ?? {}), {}
  );
  return addResources(recruits, replenishmentCost(scenario, session.game.state, session.factionId, session.draft.replenishments ?? []));
}

/** B2: what these Replenish orders pay at reveal, priced in turn against the faction's carry. */
export function replenishmentCost(scenario: Scenario, state: GameState, factionId: FactionId, orders: readonly ReplenishOrder[]): Resources {
  const units = orders.flatMap((order): UnitState[] => {
    const unit = state.units[order.unitId];
    return unit === undefined ? [] : [unit];
  });
  return priceReplenishments(scenario, state, factionId, units).total;
}

/** The balance left after the draft's purchases: Recruit and Replenish orders, and Build orders ($5). */
export function balanceAfterBasket(scenario: Scenario, session: PlanningSession): Resources {
  const builds = plannedSpend(scenario, session.draft.builds ?? []);
  return subtractResources(subtractResources(treasuryOf(session.game.state, session.factionId), basketCost(scenario, session)), builds);
}

/**
 * Sets how many units of a type the draft recruits at a territory this turn. Refused, with
 * feedback, when the site or the type is locked, or the territory's D7 limit would be passed.
 */
export function setRecruitQuantity(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId, typeId: UnitTypeId, quantity: number): PlanningSession {
  const { state } = session.game;
  const type = scenario.index.unitTypes.get(typeId);
  if (type === undefined) return session;
  const wanted = Math.max(0, Math.floor(quantity));
  const current = recruitQuantity(session.draft, territoryId, typeId);
  if (wanted > current) {
    const site = recruitSiteProblem(scenario, state, session.factionId, territoryId);
    if (site !== undefined) return feedback(session, site);
    const lock = typeLock(scenario, state, session.factionId, territoryId, type);
    if (lock.reasons.length > 0) return feedback(session, lock.reasons.join(" "));
    const others = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId).length - current;
    const slots = recruitSlots(scenario, state, territoryId);
    if (others + wanted > slots) return feedback(session, `At most ${String(slots)} new units a turn can be recruited here.`);
  }
  const kept = (session.draft.recruits ?? []).filter((order) => !(order.territoryId === territoryId && order.unitTypeId === typeId));
  const added: RecruitOrder[] = Array.from({ length: wanted }, () => ({ factionId: session.factionId, kind: "recruit", territoryId, unitTypeId: typeId }));
  const draft: Draft = { ...session.draft, recruits: [...kept, ...added] };
  delete (draft as { feedback?: string }).feedback;
  return withDraft(session, draft);
}

/** True when every selected unit may take a Replenish order now. */
export function canReplenishSelection(scenario: Scenario, session: PlanningSession): boolean {
  const units = selectedUnits(session);
  return units.length > 0 && units.every((unit) => replenishProblem(scenario, session.game.state, unit) === undefined);
}

/**
 * Gives the selected units Replenish orders, replacing any move they had (a unit takes one
 * order, M1). The territory returns to the selection rule.
 */
export function chooseReplenish(scenario: Scenario, session: PlanningSession): PlanningSession {
  const units = selectedUnits(session);
  const problem = units.map((unit) => replenishProblem(scenario, session.game.state, unit)).find((reason) => reason !== undefined);
  if (units.length === 0 || problem !== undefined) return feedback(session, problem ?? "Select at least one unit first.");
  const chosen = new Set(units.map((unit) => unit.id));
  // m11, EB-11: refused while the rest of the draft's purchases leave too little to pay for it.
  const without: PlanningSession = { ...session, draft: { ...session.draft, replenishments: (session.draft.replenishments ?? []).filter((order) => !chosen.has(order.unitId)) } };
  const left = balanceAfterBasket(scenario, without);
  const price = replenishmentCost(scenario, session.game.state, session.factionId, [...(without.draft.replenishments ?? []), ...units.map((unit) => ({ factionId: session.factionId, kind: "replenish" as const, unitId: unit.id }))]);
  const extra = subtractResources(price, replenishmentCost(scenario, session.game.state, session.factionId, without.draft.replenishments ?? []));
  if (session.game.state.treasuries[session.factionId] !== undefined && !canAfford(left, extra)) return feedback(session, "Not enough Funds or Manpower left to replenish.");
  const orders = session.draft.orders.filter((order) => !chosen.has(order.unitId));
  const replenishments: ReplenishOrder[] = [
    ...(session.draft.replenishments ?? []).filter((order) => !chosen.has(order.unitId)),
    ...units.map((unit) => ({ factionId: session.factionId, kind: "replenish" as const, unitId: unit.id }))
  ];
  const territoryId = session.draft.selectedTerritoryId;
  const base: Draft = territoryId === undefined ? { orders, selectedUnitIds: [] } : selecting(territoryId, availableUnitIds(session, territoryId, orders, replenishments), orders);
  const who = units.length === 1 ? "1 unit" : `${String(units.length)} units`;
  return withDraft(session, { ...keepBasket(session.draft), ...base, replenishments, feedback: `${who} will replenish.` });
}

/** The draft's Replenish orders less those of these units (they were given another order). */
export function replenishWithout(draft: Draft, unitIds: Iterable<string>): Pick<Draft, "replenishments"> {
  const dropped = new Set(unitIds);
  return draft.replenishments === undefined ? {} : { replenishments: draft.replenishments.filter((order) => !dropped.has(order.unitId)) };
}

/** The draft's Recruit basket, Replenish and Build orders, to carry into a rebuilt draft. */
export function keepBasket(draft: Draft): Pick<Draft, "builds" | "recruits" | "replenishments"> {
  return {
    ...(draft.builds === undefined ? {} : { builds: draft.builds }),
    ...(draft.recruits === undefined ? {} : { recruits: draft.recruits }),
    ...(draft.replenishments === undefined ? {} : { replenishments: draft.replenishments })
  };
}
