import { plannedSpend } from "../../engine/economy/catalogue";
import { upkeepProblem } from "../../engine/economy/upkeep";
import { isContested, priceReplenishments, recruitSiteProblem, recruitSlots, replenishProblem, typeLock } from "../../engine/recruitment/rules";
import { addResources, subtractResources, treasuryOf } from "../../engine/resources";
import type { FactionId, GameState, Order, RecruitOrder, ReplenishOrder, Resources, Scenario, TerritoryId, UnitId, UnitState, UnitTypeId } from "../../engine/types";
import { andList } from "../../presentation/queues";
import { replenishDetail } from "../../presentation/recruitment";
import { unitName } from "../../presentation/text";
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
    if (site !== undefined) return feedback(session, site);
    const lock = typeLock(scenario, state, session.factionId, territoryId, type);
    if (lock.reasons.length > 0) return feedback(session, lock.reasons.join(" "));
    const others = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId).length - current;
    const slots = recruitSlots(scenario, state, territoryId);
    if (others + wanted > slots) return feedback(session, `At most ${String(slots)} new units a turn can be recruited here.`);
  }
  // Every order that stays keeps its place: only the last of this type go, and new ones join at the end.
  const last = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId && order.unitTypeId === typeId).slice(wanted);
  const kept = (session.draft.recruits ?? []).filter((order) => !last.includes(order));
  const added: RecruitOrder[] = Array.from({ length: Math.max(0, wanted - current) }, () => ({ factionId: session.factionId, kind: "recruit", territoryId, unitTypeId: typeId }));
  const draft: Draft = { ...session.draft, recruits: [...kept, ...added] };
  delete (draft as { feedback?: string }).feedback;
  const short = wanted > current ? upkeepProblem(scenario, state, session.factionId, draftOrders(draft)) : undefined;
  return short === undefined ? withDraft(session, draft) : feedback(session, short);
}

/** D1: why one more unit of a type is refused for its price and upkeep, the draft's other orders counted, or undefined. */
export function recruitUpkeepProblem(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId, unitTypeId: UnitTypeId): string | undefined {
  const { draft, factionId, game } = session;
  return upkeepProblem(scenario, game.state, factionId, [...draftOrders(draft), { factionId, kind: "recruit", territoryId, unitTypeId }]);
}

/** Takes back one of a territory's Recruit orders, by its place among them. The others keep their order. */
export function takeBackRecruit(session: PlanningSession, territoryId: TerritoryId, at: number): PlanningSession {
  const order = (session.draft.recruits ?? []).filter((other) => other.territoryId === territoryId)[at];
  if (order === undefined) return session;
  const draft: Draft = { ...session.draft, recruits: (session.draft.recruits ?? []).filter((other) => other !== order) };
  delete (draft as { feedback?: string }).feedback;
  return withDraft(session, draft);
}

/** D1: why a unit is left out whose Replenish next turn's stock cannot cover. */
const upkeepSkip = "upkeep leaves too little next turn";

/** U12: a selected unit the Replenish order leaves out, and why, in a few words. */
export interface ReplenishSkip {
  readonly name: string;
  readonly reason: string;
  readonly unitId: UnitId;
}

/** U12: what Replenish does for the selection: the units it refills, those it skips and why, and the price. */
export interface ReplenishPlan {
  readonly cost: Resources;
  readonly ready: readonly UnitState[];
  readonly selected: number;
  readonly skipped: readonly ReplenishSkip[];
}

/** U12: why this unit cannot replenish now, in a few words for a list, or undefined when it can. */
export function replenishSkipReason(scenario: Scenario, state: GameState, unit: UnitState): string | undefined {
  const problem = replenishProblem(scenario, state, unit);
  if (problem === undefined || scenario.recruitment === undefined) return problem;
  const definition = state.raised[unit.id] ?? scenario.index.units.get(unit.id);
  const type = definition === undefined ? undefined : scenario.index.unitTypes.get(definition.type);
  if (type !== undefined && (!type.orders.includes("replenish") || type.recruit === undefined)) return `${type.name} units cannot replenish`;
  if (isContested(scenario, state, unit.territoryId)) return "in contested ground";
  const control = state.control[unit.territoryId];
  if (control?.kind !== "controlled" || control.factionId !== unit.factionId) return "outside your territory";
  return "at full strength";
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
  const reasons = new Map(units.map((unit) => [unit.id, replenishSkipReason(scenario, state, unit)]));
  const eligible = units.filter((unit) => reasons.get(unit.id) === undefined);
  const funded = state.treasuries[session.factionId] === undefined
    ? undefined
    : balanceAfterBasket(scenario, { ...session, draft: { ...session.draft, replenishments: [] } });
  // Matched by unit, not position: a kept order whose unit no longer needs men is priced at nothing and left out.
  const all = priceReplenishments(scenario, state, session.factionId, [...keptUnits, ...eligible], funded).entries;
  const priced = all.filter((entry) => chosen.has(entry.unitId));
  const affordable = new Set(priced.filter((entry) => entry.affordable).map((entry) => entry.unitId));
  const paidFor = all.filter((entry) => entry.affordable).reduce<Resources>((sum, entry) => addResources(sum, entry.paid), {});
  const left = funded === undefined ? undefined : subtractResources(funded, paidFor);
  const short = shortfallNames(scenario, priced.filter((entry) => !entry.affordable).map((entry) => entry.paid), left);
  const covered = eligible.filter((unit) => affordable.has(unit.id));
  const ready = withinUpkeep(scenario, session, covered, kept);
  const granted = new Set(ready.map((unit) => unit.id));
  const skipped = units.flatMap((unit): ReplenishSkip[] => {
    const reason = reasons.get(unit.id) ?? (granted.has(unit.id) ? undefined : affordable.has(unit.id) ? upkeepSkip : `not enough ${short}`);
    return reason === undefined ? [] : [{ name: unitName(scenario, unit.id), reason, unitId: unit.id }];
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

/** The resources short for the orders left unpaid, against what the paid ones leave: "Funds", "Funds and Manpower". */
function shortfallNames(scenario: Scenario, prices: readonly Resources[], balance: Resources | undefined): string {
  const price = prices.reduce<Resources>((sum, paid) => addResources(sum, paid), {});
  const names = scenario.resources.filter((resource) => (price[resource.id] ?? 0) > (balance?.[resource.id] ?? 0)).map((resource) => resource.name);
  return names.length === 0 ? "Funds or Manpower" : names.join(" and ");
}

/** U12: "Skips Madrid Assault and Civil Guards (at full strength) and General Miaja (General units cannot replenish)." */
export function skippedText(skipped: readonly ReplenishSkip[]): string {
  const byReason = new Map<string, string[]>();
  for (const skip of skipped) byReason.set(skip.reason, [...byReason.get(skip.reason) ?? [], skip.name]);
  const parts = [...byReason].map(([reason, names]) => `${andList(names)} (${reason})`);
  return parts.length === 0 ? "" : `Skips ${andList(parts)}.`;
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
    const allowed = problems.some((problem) => problem === undefined);
    const unpaid = plan.skipped.some((skip) => skip.reason === upkeepSkip) ? `No selected unit can replenish. ${skippedText(plan.skipped)}` : "Not enough Funds or Manpower left to replenish.";
    return feedback(session, problems.length === 0 ? "Select at least one unit first." : allowed ? unpaid : String(problems[0]));
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
  const who = units.length === 1 ? "1 unit" : `${String(units.length)} units`;
  const skips = skippedText(plan.skipped);
  return withDraft(session, { ...keepBasket(session.draft), ...base, ...unitOrdersWithout(session.draft, chosen), replenishments, feedback: `${who} will replenish.${skips === "" ? "" : ` ${skips}`}` });
}

/** U12: the selection bar's line for Replenish: what it brings and costs, and which units it skips. */
export function replenishSelectionDetail(scenario: Scenario, session: PlanningSession): string {
  const plan = replenishPlan(scenario, session);
  if (plan.ready.length === 0) return `No selected unit can replenish. ${skippedText(plan.skipped)}`;
  const detail = replenishDetail(scenario, session.game.state, plan.ready);
  return plan.skipped.length === 0 ? detail : `Refills ${String(plan.ready.length)} of the ${String(plan.selected)} selected units: ${detail}. ${skippedText(plan.skipped)}`;
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
