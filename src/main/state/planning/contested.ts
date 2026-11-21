import { isContested, isPartitioned } from "../../engine/partition/holders";
import { withdrawRoutes, type WithdrawRoute } from "../../engine/partition/paths";
import type { Scenario, TerritoryId, UnitState } from "../../engine/types";
import type { PlanningSession } from "./selection";

/**
 * C1 (Q-UX-14): planning in contested ground. Units there attack by default (hold, when
 * demoralized, C4) or withdraw through their own sub-territories (P6); Move, Entrench, Rest and
 * Replenish are offered greyed out with the reason.
 */

/** True when the unit stands in contested ground under the `provinces` partition module. */
export function inContestedGround(scenario: Scenario | undefined, session: PlanningSession, unit: UnitState): boolean {
  return scenario !== undefined && isPartitioned(scenario) && isContested(scenario, session.game.state, unit.territoryId);
}

/** The Withdraw routes open to every selected unit (they share a territory), in neighbour order. */
export function selectedWithdrawRoutes(scenario: Scenario, session: PlanningSession): readonly WithdrawRoute[] {
  const territoryId = session.draft.selectedTerritoryId;
  if (territoryId === undefined || session.draft.selectedUnitIds.length === 0) return [];
  return withdrawRoutes(scenario, session.game.state, session.factionId, territoryId, session.draft.selectedUnitIds);
}

export function withdrawDestinations(scenario: Scenario, session: PlanningSession): readonly TerritoryId[] {
  return selectedWithdrawRoutes(scenario, session).map((route) => route.to);
}

/** An order kind shown greyed out, and why. */
export interface BlockedOrder {
  readonly label: string;
  readonly reason: string;
}

export function blockedOrders(scenario: Scenario): readonly BlockedOrder[] {
  return [
    { label: "Move, Entrench, Rest", reason: "Not in contested ground: units here attack or withdraw." },
    ...(scenario.rules.recruitment === "none" ? [] : [{ label: "Replenish", reason: "Not in contested ground." }])
  ];
}

/** True when another faction's army stands in the territory (the standing battle, M27); else the sweep (P3). */
export function enemyPresent(session: PlanningSession, territoryId: TerritoryId): boolean {
  return Object.values(session.game.state.units).some((unit) => unit.territoryId === territoryId && unit.factionId !== session.factionId);
}
