import { carryScale, deposit, holdings, inPoints, inThousandths } from "../carry";
import { compareIds } from "../board";
import { requireUnitType } from "../lookup";
import { draftState, type Phase, type SystemState } from "../phases/draft";
import { replenishQuote, trainsOn, unitBasics } from "../recruitment/rules";
import { addResources, subtractResources } from "../resources";
import type { EconomyTurnOutcome, FactionId, GameState, MenLeft, Order, RecruitmentRefusal, ResourceId, Resources, Scenario, UnitId, UnitState, UnitTypeDefinition, UpkeepRules } from "../types";
import { projectCost } from "./catalogue";
import { incomeFor } from "./income";

/**
 * D1: upkeep. Every unit on the map costs its type's full upkeep each turn, whatever its
 * strength; types with no upkeep (generals) and units in training cost nothing. It is charged
 * after income. What the stock cannot pay leaves as men (`menLeaving`), and what cannot leave is
 * forgotten. Amounts here are thousandths of a point unless a name says otherwise.
 *
 * `projectedHoldings` is the one forecast of next turn's stock: the refusal at reveal, the
 * planning screen, the balance view and the computer player all ask it.
 */

/** The units of one type that upkeep is paid for. */
export interface UpkeepLine {
  readonly count: number;
  readonly type: UnitTypeDefinition;
}

function linesOf(scenario: Scenario, types: readonly UnitTypeDefinition[]): readonly UpkeepLine[] {
  return scenario.unitTypes.flatMap((type) => {
    const count = types.filter((entry) => entry.id === type.id).length;
    return count === 0 || Object.keys(type.upkeep).length === 0 ? [] : [{ count, type }];
  });
}

/** Each unit's type, whether it came with the scenario or was raised in play. */
function typesOf(scenario: Scenario, state: Pick<GameState, "raised">, units: readonly UnitState[]): readonly UnitTypeDefinition[] {
  return units.flatMap((unit) => unitBasics(scenario, state, unit.id)?.type ?? []);
}

/** What these units cost a turn. */
export function upkeepBill(lines: readonly UpkeepLine[]): Resources {
  return lines.reduce<Resources>((sum, line) => {
    const each = inThousandths(line.type.upkeep);
    return addResources(sum, Object.fromEntries(Object.entries(each).map(([id, value]) => [id, value * line.count])));
  }, {});
}

/** The units a faction will pay upkeep for this turn: those on the map less those it disbands, and those whose training ends. */
export function upkeepLines(scenario: Scenario, state: GameState, factionId: FactionId, planned: readonly Order[]): readonly UpkeepLine[] {
  if (scenario.upkeep === undefined) return [];
  const leaving = new Set(planned.flatMap((order) => (order.kind === "disband" ? [order.unitId] : [])));
  const standing = typesOf(scenario, state, Object.values(state.units).filter((unit) => unit.factionId === factionId && !leaving.has(unit.id)));
  const finishing = state.training
    .filter((item) => item.factionId === factionId && item.turnsLeft === 1 && trainsOn(scenario, state, item))
    .map((item) => requireUnitType(scenario, item.typeId));
  const raised = planned.flatMap((order) => (order.kind === "recruit" ? [requireUnitType(scenario, order.unitTypeId)] : [])).filter((type) => type.recruit?.trainingTurns === 1);
  return linesOf(scenario, [...standing, ...finishing, ...raised]);
}

/** What an order takes from the stock at reveal. */
function priceOf(scenario: Scenario, state: GameState, order: Order): Resources {
  switch (order.kind) {
    case "build":
      return inThousandths(projectCost(scenario, order.project)?.cost ?? {});
    case "recruit":
      return inThousandths(scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.cost ?? {});
    case "replenish": {
      const unit = state.units[order.unitId];
      return unit === undefined ? {} : replenishQuote(scenario, state, unit)?.owed ?? {};
    }
    default:
      return {};
  }
}

/**
 * What a faction will have after this turn with these orders: what it has, less their price, plus
 * income, less upkeep. Below zero: short. Looking `turns` ahead counts this turn's income and bill again for each.
 */
export function projectedHoldings(scenario: Scenario, state: GameState, factionId: FactionId, planned: readonly Order[], turns = 1): Resources {
  const spent = planned.reduce<Resources>((sum, order) => addResources(sum, priceOf(scenario, state, order)), {});
  const income = inThousandths(incomeFor(scenario, state, factionId).paid);
  const bill = upkeepBill(upkeepLines(scenario, state, factionId, planned));
  const over = (amounts: Resources): Resources => Object.fromEntries(Object.entries(amounts).map(([id, value]) => [id, value * turns]));
  return subtractResources(subtractResources(addResources(holdings(state, factionId), over(income)), spent), over(bill));
}

/** The resources next turn's stock (or that of `turns` ahead) falls short of, with how much, in points. Only resources some unit type's upkeep takes count. */
export function upkeepShortfall(scenario: Scenario, state: GameState, factionId: FactionId, planned: readonly Order[], turns = 1): Resources {
  if (scenario.upkeep === undefined) return {};
  const charged = new Set(scenario.unitTypes.flatMap((type) => Object.keys(type.upkeep)));
  const projected = projectedHoldings(scenario, state, factionId, planned, turns);
  return inPoints(Object.fromEntries(Object.entries(projected).filter(([id, value]) => charged.has(id) && value < 0).map(([id, value]) => [id, -value])));
}

/** Why a Recruit or Replenish order is refused, its price and upkeep counted in `planned`, or undefined when next turn's stock covers it. */
export function upkeepProblem(scenario: Scenario, state: GameState, factionId: FactionId, planned: readonly Order[]): RecruitmentRefusal | undefined {
  const short = upkeepShortfall(scenario, state, factionId, planned);
  const resourceIds = scenario.resources.map((resource) => resource.id).filter((id) => short[id] !== undefined);
  return resourceIds.length === 0 ? undefined : { code: "upkeep-short", resourceIds };
}

/**
 * D1: the men who leave when `short` points of a resource cannot be paid: one point is the
 * resource's display unit of men. They are shared over the units that cost that resource, in
 * proportion to their men (largest remainder first, then by id), each unit's share capped by
 * the rules: a share of full strength a turn, and never below a share of full strength. What a
 * cap holds back is not passed to other units; it goes unpaid.
 */
export function menLeaving(scenario: Scenario, raised: GameState["raised"], rules: UpkeepRules, units: readonly UnitState[], resourceId: ResourceId, short: number): readonly MenLeft[] {
  const paying = units.flatMap((unit) => {
    const basics = unitBasics(scenario, { raised }, unit.id);
    return basics?.type.kind === "ground" && basics.type.upkeep[resourceId] !== undefined ? [{ ...unit, full: basics.fullStrength }] : [];
  }).sort((a, b) => compareIds(a.id, b.id));
  const total = paying.reduce((sum, unit) => sum + unit.strength, 0);
  const perPoint = scenario.resources.find((resource) => resource.id === resourceId)?.display?.unit ?? 1;
  const men = Math.min(total, Math.round((short * perPoint) / carryScale));
  if (men <= 0) return [];
  const shares = paying.map((unit) => ({ floor: Math.floor((men * unit.strength) / total), rest: (men * unit.strength) % total, unit }));
  const over = men - shares.reduce((sum, share) => sum + share.floor, 0);
  const rounded = new Set([...shares].sort((a, b) => b.rest - a.rest).slice(0, over).map((share) => share.unit.id));
  return shares.flatMap(({ floor, unit }) => {
    const most = Math.min(Math.floor(unit.full * rules.maxLossShare), unit.strength - Math.ceil(unit.full * rules.minStrengthShare));
    const leaving = Math.min(most, floor + (rounded.has(unit.id) ? 1 : 0));
    return leaving > 0 ? [{ men: leaving, unitId: unit.id }] : [];
  });
}

/** Step 11, after income: each faction pays its units' upkeep; a shortage sends men home. */
export const chargeUpkeep: Phase = (draft) => {
  const { scenario } = draft.input;
  const rules = scenario.upkeep;
  if (rules === undefined) return draft;
  const { units } = draftState(draft);
  const armies: Record<UnitId, UnitState> = { ...draft.armies };
  const events: EconomyTurnOutcome[] = [];
  let systems: SystemState = draft.systems;
  for (const { id: factionId } of scenario.factions) {
    const own = Object.values(units).filter((unit) => unit.factionId === factionId);
    const due = upkeepBill(linesOf(scenario, typesOf(scenario, systems, own)));
    if (systems.treasuries[factionId] === undefined || Object.keys(due).length === 0) continue;
    const held = holdings(systems, factionId);
    // A debt an earlier Replenish left is no part of the bill: it stays in the carry.
    const unpaid = Object.fromEntries((Object.entries(due) as [ResourceId, number][]).map(([id, bill]): [string, number] => [id, bill - Math.min(bill, Math.max(0, held[id] ?? 0))]).filter(([, value]) => value > 0));
    systems = { ...systems, ...deposit(systems, factionId, subtractResources(unpaid, due)) };
    const left = (Object.entries(unpaid) as [ResourceId, number][]).flatMap(([id, short]) => menLeaving(scenario, systems.raised, rules, own, id, short));
    for (const { men, unitId } of left) {
      const unit = armies[unitId];
      if (unit !== undefined) armies[unitId] = { ...unit, strength: unit.strength - men };
    }
    events.push({ due: inPoints(due), factionId, kind: "upkeep", left, short: inPoints(unpaid) });
  }
  return { ...draft, armies, events: [...draft.events, ...events], systems };
};
