import { compareIds } from "../../engine/board";
import { upkeepShortfall } from "../../engine/economy/upkeep";
import { requireUnitDefinition, requireUnitType } from "../../engine/lookup";
import { isContested } from "../../engine/recruitment/rules";
import { disbandProblem } from "../../engine/recruitment/disband";
import type { DisbandOrder, ResourceId, TerritoryId, UnitId, UnitState, UnitTypeDefinition } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/**
 * D1: while next turn's stock would fall short, the computer player disbands the unit it can
 * spare that fights least for the upkeep it saves, until the stock covers it or nothing is left
 * to spare. It spares a unit with no other order, outside contested ground, that is not the last
 * fighting unit of its side in a territory next to another side's. No random draws (CT-36).
 */
export const planDisbands: OrderPlanner<DisbandOrder> = ({ factionId, planned, scenario, state }) => {
  const ordered = new Set<UnitId>(planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const typeOf = (unit: UnitState): UnitTypeDefinition => requireUnitType(scenario, (state.raised[unit.id] ?? requireUnitDefinition(scenario, unit.id)).type);
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const fights = (unit: UnitState): boolean => typeOf(unit).kind === "ground" && typeOf(unit).defence > 0;
  const onBorder = (territoryId: TerritoryId): boolean => (scenario.index.neighbors.get(territoryId) ?? []).some(({ territoryId: next }) => {
    const control = state.control[next];
    return control !== undefined && (control.kind !== "controlled" || control.factionId !== factionId);
  });
  const orders: DisbandOrder[] = [];
  const spared = (unit: UnitState, leaving: ReadonlySet<UnitId>): boolean =>
    !leaving.has(unit.id) && !ordered.has(unit.id) && disbandProblem(scenario, state, unit) === undefined && !isContested(scenario, state, unit.territoryId)
    && (!fights(unit) || !onBorder(unit.territoryId) || own.some((other) => other.id !== unit.id && other.territoryId === unit.territoryId && !leaving.has(other.id) && !ordered.has(other.id) && fights(other)));
  for (;;) {
    const short = Object.keys(upkeepShortfall(scenario, state, factionId, [...planned, ...orders])) as ResourceId[];
    const leaving = new Set(orders.map((order) => order.unitId));
    const saved = (unit: UnitState): number => short.reduce((sum, id) => sum + (typeOf(unit).upkeep[id] ?? 0), 0);
    const worth = (unit: UnitState): number => (typeOf(unit).attack + typeOf(unit).defence) / saved(unit);
    const [least] = own.filter((unit) => saved(unit) > 0 && spared(unit, leaving)).sort((a, b) => worth(a) - worth(b) || compareIds(a.id, b.id));
    if (least === undefined) return orders;
    orders.push({ factionId, kind: "disband", unitId: least.id });
  }
};
