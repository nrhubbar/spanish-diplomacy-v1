import { plannedSpend } from "../../engine/economy/catalogue";
import { upkeepProblem } from "../../engine/economy/upkeep";
import { priceReplenishments, recruitSiteProblem, recruitSlots, replenishProblem, typeLock } from "../../engine/recruitment/rules";
import { addResources, subtractResources, treasuryOf } from "../../engine/resources";
import type { FactionId, GameState, Order, RecruitOrder, Refusal, ReplenishOrder, ResourceId, Resources, Scenario, TerritoryId, UnitState, UnitTypeId } from "../../engine/types";
import { refusedFeedback } from "../../presentation/feedback";
import type { ReplenishPlan, ReplenishSkip } from "../../presentation/replenish";
import type { Draft } from "../session";
import { type PlanningSession, feedback, selectedUnits, selecting, withDraft } from "./selection";

/**
 * X4, R2-R5: the draft's Recruit basket and Replenish orders. The engine answers every rule
 * question (`engine/recruitment/rules.ts`); these functions keep the draft consistent: a unit
 * has at most one order, and a territory's basket never exceeds its D7 number of orders.
 */

/** Every order the draft submits at End Turn: moves, then Disband, Replenish, Recruit and Build orders. */
export function draftOrders(draft: Draft): readonly Order[] {
  return [...draft.orders, ...(draft.disbands ?? []), ...(draft.replenishments ?? []), ...(draft.recruits ?? []), ...(draft.builds ?? [])];
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
function replenishmentCost(scenario: Scenario, state: GameState, factionId: FactionId, orders: readonly ReplenishOrder[]): Resources {
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
 * feedback, when the site or the type is locked, the territory's D7 limit would be passed, or
 * next turn's stock would not cover the upkeep (D1).
 */
export function setRecruitQuantity(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId, typeId: UnitTypeId, quantity: number): PlanningSession {
  const { state } = session.game;
  const type = scenario.index.unitTypes.get(typeId);
  if (type === undefined) return session;
  const wanted = Math.max(0, Math.floor(quantity));
  const current = recruitQuantity(session.draft, territoryId, typeId);
  if (wanted > current) {
    const site = recruitSiteProblem(scenario, state, session.factionId, territoryId);
    if (site !== undefined) return feedback(session, refusedFeedback(site));
    const lock = typeLock(scenario, state, session.factionId, territoryId, type);
    if (lock.refusals.length > 0) return feedback(session, refusedFeedback(...lock.refusals));
    const others = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId).length - current;
    const slots = recruitSlots(scenario, state, territoryId);
    if (others + wanted > slots) return feedback(session, { code: "recruit-slots", slots });
  }
  // Every order that stays keeps its place: only the last of this type go, and new ones join at the end.
  const last = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId && order.unitTypeId === typeId).slice(wanted);
  const kept = (session.draft.recruits ?? []).filter((order) => !last.includes(order));
  const added: RecruitOrder[] = Array.from({ length: Math.max(0, wanted - current) }, () => ({ factionId: session.factionId, kind: "recruit", territoryId, unitTypeId: typeId }));
  const draft: Draft = { ...session.draft, recruits: [...kept, ...added] };
  delete (draft as { feedback?: unknown }).feedback;
  const short = wanted > current ? upkeepProblem(scenario, state, session.factionId, draftOrders(draft)) : undefined;
  return short === undefined ? withDraft(session, draft) : feedback(session, refusedFeedback(short));
}

/** D1: why one more unit of a type is refused for its price and upkeep, the draft's other orders counted, or undefined. */
export function recruitUpkeepProblem(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId, unitTypeId: UnitTypeId): Refusal | undefined {
  const { draft, factionId, game } = session;
  return upkeepProblem(scenario, game.state, factionId, [...draftOrders(draft), { factionId, kind: "recruit", territoryId, unitTypeId }]);
}

/** Takes back one of a territory's Recruit orders, by its place among them. The others keep their order. */
export function takeBackRecruit(session: PlanningSession, territoryId: TerritoryId, at: number): PlanningSession {
  const order = (session.draft.recruits ?? []).filter((other) => other.territoryId === territoryId)[at];
  if (order === undefined) return session;
  const draft: Draft = { ...session.draft, recruits: (session.draft.recruits ?? []).filter((other) => other !== order) };
  delete (draft as { feedback?: unknown }).feedback;
  return withDraft(session, draft);
}

/**
 * U12: Replenish for the whole selection. Units that cannot replenish are skipped with their
 * reason, and so are those the balance left after the rest of the draft cannot pay for, priced
 * in turn against the carry (B2) after the draft's other Replenish orders, and those that would
 * leave next turn's stock short of the upkeep (D1).
 */
export function replenishPlan(scenario: Scenario, session: PlanningSession): ReplenishPlan {
  const { state } = session.game;
  const units = selectedUnits(session);
  const chosen = new Set(units.map((unit) => unit.id));
  const kept = (session.draft.replenishments ?? []).filter((order) => !chosen.has(order.unitId));
  const keptUnits = kept.flatMap((order): UnitState[] => {
    const unit = state.units[order.unitId];
    return unit === undefined ? [] : [unit];
  });
  const refusals = new Map(units.map((unit) => [unit.id, replenishProblem(scenario, state, unit)]));
  const eligible = units.filter((unit) => refusals.get(unit.id) === undefined);
  const funded = state.treasuries[session.factionId] === undefined
    ? undefined
    : balanceAfterBasket(scenario, { ...session, draft: { ...session.draft, replenishments: [] } });
  // Matched by unit, not position: a kept order whose unit no longer needs men is priced at nothing and left out.
  const all = priceReplenishments(scenario, state, session.factionId, [...keptUnits, ...eligible], funded).entries;
  const priced = all.filter((entry) => chosen.has(entry.unitId));
  const affordable = new Set(priced.filter((entry) => entry.affordable).map((entry) => entry.unitId));
  const paidFor = all.filter((entry) => entry.affordable).reduce<Resources>((sum, entry) => addResources(sum, entry.paid), {});
  const left = funded === undefined ? undefined : subtractResources(funded, paidFor);
  const resourceIds = shortfall(scenario, priced.filter((entry) => !entry.affordable).map((entry) => entry.paid), left);
  const covered = eligible.filter((unit) => affordable.has(unit.id));
  const ready = withinUpkeep(scenario, session, covered, kept);
  const granted = new Set(ready.map((unit) => unit.id));
  const skipped = units.flatMap((unit): ReplenishSkip[] => {
    const refusal = refusals.get(unit.id);
    if (refusal !== undefined) return [{ reason: { code: "refused", refusal }, unitId: unit.id }];
    if (granted.has(unit.id)) return [];
    return [{ reason: affordable.has(unit.id) ? { code: "upkeep" } : { code: "unpaid", resourceIds }, unitId: unit.id }];
  });
  const cost = priced.filter((entry) => granted.has(entry.unitId)).reduce<Resources>((sum, entry) => addResources(sum, entry.paid), {});
  return { cost, ready, selected: units.length, skipped };
}

/** D1: the units, in turn, whose Replenish leaves next turn's stock covering the upkeep, after the draft's other orders. */
function withinUpkeep(scenario: Scenario, { draft, factionId, game }: PlanningSession, units: readonly UnitState[], kept: readonly ReplenishOrder[]): readonly UnitState[] {
  const others = draftOrders({ ...draft, ...unitOrdersWithout(draft, units.map((unit) => unit.id)), replenishments: kept });
  return units.reduce<readonly UnitState[]>((ready, unit) => {
    const next = [...ready, unit];
    const orders = next.map(({ id }): ReplenishOrder => ({ factionId, kind: "replenish", unitId: id }));
    return upkeepProblem(scenario, game.state, factionId, [...others, ...orders]) === undefined ? next : ready;
  }, []);
}

/** The resources short for the orders left unpaid, against what the paid ones leave. */
function shortfall(scenario: Scenario, prices: readonly Resources[], balance: Resources | undefined): readonly ResourceId[] {
  const price = prices.reduce<Resources>((sum, paid) => addResources(sum, paid), {});
  return scenario.resources.map((resource) => resource.id).filter((id) => (price[id] ?? 0) > (balance?.[id] ?? 0));
}

/** True when at least one selected unit may take a Replenish order now (U12: the rest are skipped). */
export function canReplenishSelection(scenario: Scenario, session: PlanningSession): boolean {
  return selectedUnits(session).some((unit) => replenishProblem(scenario, session.game.state, unit) === undefined);
}

/**
 * U12: gives every selected unit that can take it a Replenish order, replacing any move it had
 * (a unit takes one order, M1), and names the units skipped and why. Nothing is selected after.
 */
export function chooseReplenish(scenario: Scenario, session: PlanningSession): PlanningSession {
  const plan = replenishPlan(scenario, session);
  const units = plan.ready;
  if (units.length === 0) {
    // Nothing selected, none allowed (the first unit's reason, in full), or none the balance covers.
    const problems = selectedUnits(session).map((unit) => replenishProblem(scenario, session.game.state, unit));
    const [first] = problems;
    if (problems.length === 0) return feedback(session, { code: "no-units-selected" });
    if (first !== undefined && !problems.includes(undefined)) return feedback(session, refusedFeedback(first));
    return feedback(session, plan.skipped.some((skip) => skip.reason.code === "upkeep") ? { code: "replenish-none", skipped: plan.skipped } : { code: "replenish-unpaid" });
  }
  const chosen = new Set(units.map((unit) => unit.id));
  const orders = session.draft.orders.filter((order) => !chosen.has(order.unitId));
  const replenishments: ReplenishOrder[] = [
    ...(session.draft.replenishments ?? []).filter((order) => !chosen.has(order.unitId)),
    ...units.map((unit) => ({ factionId: session.factionId, kind: "replenish" as const, unitId: unit.id }))
  ];
  const territoryId = session.draft.selectedTerritoryId;
  // Note 11: once the order is given, nothing is selected.
  const base: Draft = territoryId === undefined ? { orders, selectedUnitIds: [] } : selecting(territoryId, [], orders);
  return withDraft(session, { ...keepBasket(session.draft), ...base, ...unitOrdersWithout(session.draft, chosen), replenishments, feedback: { code: "replenish-planned", skipped: plan.skipped, units: units.length } });
}

/** The draft's Replenish and Disband orders less those of these units (they were given another order). */
export function unitOrdersWithout(draft: Draft, unitIds: Iterable<string>): Pick<Draft, "disbands" | "replenishments"> {
  const dropped = new Set(unitIds);
  return {
    ...(draft.disbands === undefined ? {} : { disbands: draft.disbands.filter((order) => !dropped.has(order.unitId)) }),
    ...(draft.replenishments === undefined ? {} : { replenishments: draft.replenishments.filter((order) => !dropped.has(order.unitId)) })
  };
}

/** The draft's Recruit basket, Replenish, Disband and Build orders, to carry into a rebuilt draft. */
export function keepBasket(draft: Draft): Pick<Draft, "builds" | "disbands" | "recruits" | "replenishments"> {
  return {
    ...(draft.builds === undefined ? {} : { builds: draft.builds }),
    ...(draft.disbands === undefined ? {} : { disbands: draft.disbands }),
    ...(draft.recruits === undefined ? {} : { recruits: draft.recruits }),
    ...(draft.replenishments === undefined ? {} : { replenishments: draft.replenishments })
  };
}
