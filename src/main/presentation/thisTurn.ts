import { requireUnitType } from "../engine/lookup";
import type { AirMissionOrder, BuildOrder, DisbandOrder, FactionId, GameState, MoveOrder, RecruitOrder, ReplenishOrder, SackOrder, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitTypeId, WithdrawOrder } from "../engine/types";
import { missionNames } from "./airPane";
import { projectBaseName, projectTerms } from "./economy";
import { glyphs } from "./glyphs";
import { subTerritoryName } from "./movement";
import { recruitTerms, termsLine } from "./recruitment";
import { plannedOrderRoute, territoryName, unitName } from "./text";

/**
 * U3: the words and grouping of the pane's This turn view, the orders given so far. The view
 * renders what these return; a Cancel button dispatches the entry's `cancel`.
 */

/** The orders planned so far: the draft's, with the air orders that will be submitted. */
export interface PlannedSoFar {
  readonly airOrders: readonly (AirMissionOrder | SackOrder)[];
  readonly builds?: readonly BuildOrder[];
  readonly disbands?: readonly DisbandOrder[];
  readonly orders: readonly (MoveOrder | WithdrawOrder)[];
  readonly recruits?: readonly RecruitOrder[];
  readonly replenishments?: readonly ReplenishOrder[];
  /** U2: armies told to stay (Entrench, Rest, Attack or Hold), each with its order's name. */
  readonly stays?: readonly { readonly label: string; readonly unitId: UnitId }[];
}

export type ThisTurnGroupKind = "units" | "air" | "recruits" | "builds";

/** What a Cancel button undoes. */
export type ThisTurnCancel =
  | { readonly kind: "order"; readonly unitId: UnitId }
  | { readonly kind: "air"; readonly unitId: UnitId }
  | { readonly kind: "sack"; readonly unitId: UnitId }
  | { readonly kind: "recruit"; readonly territoryId: TerritoryId; readonly unitTypeId: UnitTypeId }
  | { readonly kind: "build"; readonly index: number };

export interface ThisTurnEntry {
  readonly cancel: ThisTurnCancel;
  /** How many orders the line stands for: recruits of one type at one place share a line. */
  readonly count: number;
  readonly detail: string;
  readonly group: ThisTurnGroupKind;
  readonly key: string;
  /** A planned move, whose odds the line shows. */
  readonly move?: MoveOrder;
  /** The territory the line is grouped under by region; undefined when the place is unknown. */
  readonly region: TerritoryId | undefined;
  readonly title: string;
}

export interface ThisTurnGroup {
  readonly count: number;
  readonly entries: readonly ThisTurnEntry[];
  readonly key: string;
  readonly label: string;
}

export type ThisTurnGrouping = "type" | "region";

const groupLabels: Readonly<Record<ThisTurnGroupKind, string>> = {
  air: "Air missions",
  builds: "Builds",
  recruits: "Recruits",
  units: "Unit orders"
};

const groupOrder: readonly ThisTurnGroupKind[] = ["units", "air", "recruits", "builds"];

function regionOfSub(scenario: Scenario, id: SubTerritoryId): TerritoryId | undefined {
  return scenario.index.subTerritories.get(id)?.territoryId;
}

function unitEntries(scenario: Scenario, draft: PlannedSoFar, territoryOf: (unitId: UnitId) => TerritoryId): readonly ThisTurnEntry[] {
  const moves = draft.orders.map((order): ThisTurnEntry => ({
    cancel: { kind: "order", unitId: order.unitId },
    count: 1,
    detail: `${order.kind === "withdraw" ? "Withdraw" : "Move"} ${glyphs.dot} ${plannedOrderRoute(scenario, order)}`,
    group: "units",
    key: `order:${order.unitId}`,
    ...(order.kind === "move" ? { move: order } : {}),
    region: order.from,
    title: unitName(scenario, order.unitId)
  }));
  const replenish = (draft.replenishments ?? []).map((order): ThisTurnEntry => {
    const region = territoryOf(order.unitId);
    return {
      cancel: { kind: "order", unitId: order.unitId },
      count: 1,
      detail: `Replenish ${glyphs.dot} ${territoryName(scenario, region)}`,
      group: "units",
      key: `replenish:${order.unitId}`,
      region,
      title: unitName(scenario, order.unitId)
    };
  });
  const disbands = (draft.disbands ?? []).map((order): ThisTurnEntry => {
    const region = territoryOf(order.unitId);
    return {
      cancel: { kind: "order", unitId: order.unitId },
      count: 1,
      detail: `Disband ${glyphs.dot} ${territoryName(scenario, region)}`,
      group: "units",
      key: `disband:${order.unitId}`,
      region,
      title: unitName(scenario, order.unitId)
    };
  });
  const stays = (draft.stays ?? []).map((stay): ThisTurnEntry => {
    const region = territoryOf(stay.unitId);
    return {
      cancel: { kind: "order", unitId: stay.unitId },
      count: 1,
      detail: `${stay.label} ${glyphs.dot} ${territoryName(scenario, region)}`,
      group: "units",
      key: `stay:${stay.unitId}`,
      region,
      title: unitName(scenario, stay.unitId)
    };
  });
  return [...moves, ...replenish, ...disbands, ...stays];
}

function airEntry(scenario: Scenario, order: AirMissionOrder | SackOrder, territoryOf: (unitId: UnitId) => TerritoryId): ThisTurnEntry {
  if (order.kind === "sack") {
    return { cancel: { kind: "sack", unitId: order.unitId }, count: 1, detail: "Sacked at the end of the turn", group: "air", key: `sack:${order.unitId}`, region: territoryOf(order.unitId), title: unitName(scenario, order.unitId) };
  }
  const { mission } = order;
  const region = "subTerritoryId" in mission ? regionOfSub(scenario, mission.subTerritoryId) : mission.territoryId;
  const target = "subTerritoryId" in mission ? subTerritoryName(scenario, mission.subTerritoryId) : territoryName(scenario, mission.territoryId);
  const where = "subTerritoryId" in mission && region !== undefined ? `${target} (${territoryName(scenario, region)})` : target;
  return {
    cancel: { kind: "air", unitId: order.unitId },
    count: 1,
    detail: `${missionNames[mission.kind]} ${glyphs.dot} ${where}`,
    group: "air",
    key: `air:${order.unitId}`,
    region,
    title: unitName(scenario, order.unitId)
  };
}

/** Recruits of one type at one territory share a line, in the order first added. */
function recruitEntries(scenario: Scenario, recruits: readonly RecruitOrder[]): readonly ThisTurnEntry[] {
  const lines = new Map<string, { readonly order: RecruitOrder; count: number }>();
  for (const order of recruits) {
    const key = `${order.territoryId}:${order.unitTypeId}`;
    const line = lines.get(key);
    if (line === undefined) lines.set(key, { count: 1, order });
    else line.count += 1;
  }
  return [...lines.entries()].map(([key, { count, order }]) => {
    const type = requireUnitType(scenario, order.unitTypeId);
    return {
      cancel: { kind: "recruit", territoryId: order.territoryId, unitTypeId: order.unitTypeId },
      count,
      detail: `Recruit ${glyphs.dot} ${termsLine(recruitTerms(scenario, type), "meta")}`,
      group: "recruits",
      key: `recruit:${key}`,
      region: order.territoryId,
      title: `${count > 1 ? `${String(count)} ${glyphs.times} ` : ""}${type.name} at ${territoryName(scenario, order.territoryId)}`
    };
  });
}

function buildEntry(scenario: Scenario, order: BuildOrder, index: number): ThisTurnEntry {
  const terms = projectTerms(scenario, order.project);
  return {
    cancel: { index, kind: "build" },
    count: 1,
    detail: terms === "" ? "Build" : `Build ${glyphs.dot} ${terms}`,
    group: "builds",
    key: `build:${String(index)}`,
    region: regionOfSub(scenario, order.subTerritoryId),
    title: `${projectBaseName(scenario, order.project)} at ${subTerritoryName(scenario, order.subTerritoryId)}`
  };
}

/** Every order given so far this turn, one line each: unit orders, air missions, recruits, then builds. */
export function thisTurnEntries(scenario: Scenario, draft: PlannedSoFar, territoryOf: (unitId: UnitId) => TerritoryId): readonly ThisTurnEntry[] {
  return [
    ...unitEntries(scenario, draft, territoryOf),
    ...draft.airOrders.map((order) => airEntry(scenario, order, territoryOf)),
    ...recruitEntries(scenario, draft.recruits ?? []),
    ...(draft.builds ?? []).map((order, index) => buildEntry(scenario, order, index))
  ];
}

const countOf = (entries: readonly ThisTurnEntry[]): number => entries.reduce((sum, entry) => sum + entry.count, 0);

/** "6 orders given this turn". */
export function ordersGivenLine(turnNumber: number, entries: readonly ThisTurnEntry[]): string {
  const count = countOf(entries);
  return `Turn ${String(turnNumber)} ${glyphs.dot} ${count === 0 ? "no orders given yet" : `${String(count)} ${count === 1 ? "order" : "orders"} given this turn`}`;
}

/**
 * The lines grouped by type (unit orders, air missions, recruits, builds) or by region (the
 * scenario's territory order, then anything whose place is unknown). Empty groups are left out.
 */
export function groupThisTurn(scenario: Scenario, entries: readonly ThisTurnEntry[], by: ThisTurnGrouping): readonly ThisTurnGroup[] {
  const groups: readonly { readonly key: string; readonly label: string; readonly entries: readonly ThisTurnEntry[] }[] = by === "type"
    ? groupOrder.map((kind) => ({ entries: entries.filter((entry) => entry.group === kind), key: kind, label: groupLabels[kind] }))
    : [
        ...scenario.territories.map((territory) => ({ entries: entries.filter((entry) => entry.region === territory.id), key: territory.id, label: territory.name })),
        { entries: entries.filter((entry) => entry.region === undefined), key: "elsewhere", label: "Elsewhere" }
      ];
  return groups.filter((group) => group.entries.length > 0).map((group) => ({ ...group, count: countOf(group.entries) }));
}

/**
 * U1: the top bar's counts. Recruitment: the viewer's units in training plus this turn's Recruit
 * orders. Building: the viewer's build queue items plus this turn's Build orders. Undefined when
 * the scenario has no recruitment, or no economy.
 */
export function queueCounts(
  scenario: Scenario,
  state: Pick<GameState, "subTerritories" | "training">,
  factionId: FactionId,
  planned: Pick<PlannedSoFar, "builds" | "recruits">
): { readonly building: number | undefined; readonly recruiting: number | undefined } {
  const training = state.training.filter((item) => item.factionId === factionId).length;
  const queued = Object.values(state.subTerritories).flatMap((site) => site.queue).filter((item) => item.factionId === factionId).length;
  return {
    building: scenario.rules.economy === "none" ? undefined : queued + (planned.builds ?? []).length,
    recruiting: scenario.rules.recruitment === "none" ? undefined : training + (planned.recruits ?? []).length
  };
}
