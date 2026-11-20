import { hookedIncome } from "../hooks";
import type { FactionId, GameState, ResourceId, Resources, Scenario, SubTerritoryId, SubTerritoryState } from "../types";
import { subTerritoriesOf, territoriesHeldWhole } from "./holdings";
import { sumResources, subtractResources } from "./resources";

/**
 * $2, $3: income is the sum of the development of the sub-territories in the territories a
 * faction holds whole. A contested territory pays nobody. Raid cuts (U3) come through the
 * `incomeDelta` hook, so the turn's payout and the header's preview are the same function.
 */

/** One sub-territory's yield per turn: each development level times its track's yield. */
export function subTerritoryYield(scenario: Scenario, site: Pick<SubTerritoryState, "development">): Resources {
  const total: Record<ResourceId, number> = {};
  for (const track of scenario.development) {
    const level = site.development[track.id] ?? 0;
    if (level > 0) total[track.resource] = (total[track.resource] ?? 0) + level * track.yieldPerLevel;
  }
  return total;
}

export interface IncomeBreakdown {
  /** Income after every hook's change (raid cuts), never below zero. */
  readonly paid: Resources;
  /** What the hooks took away. */
  readonly cut: Resources;
  /** Income before the hooks. */
  readonly gross: Resources;
  /** The paying sub-territories: those of the territories held whole. */
  readonly subTerritoryIds: readonly SubTerritoryId[];
  /** U3: paying sub-territories with a raid cut recorded for this turn. */
  readonly cutSubTerritoryIds: readonly SubTerritoryId[];
}

/** $2: a faction's income in a state, before and after the hooks. */
export function incomeFor(scenario: Scenario, state: GameState, factionId: FactionId): IncomeBreakdown {
  const subTerritoryIds = territoriesHeldWhole(scenario, state.subTerritories, factionId)
    .flatMap((territoryId) => subTerritoriesOf(scenario, territoryId).map((sub) => sub.id));
  const gross = sumResources(...subTerritoryIds.flatMap((id) => {
    const site = state.subTerritories[id];
    return site === undefined ? [] : [subTerritoryYield(scenario, site)];
  }));
  const paid = hookedIncome({ factionId, income: gross, scenario, state });
  const cut = Object.fromEntries(Object.entries(subtractResources(gross, paid)).filter(([, value]) => value !== 0));
  const cutIds = new Set(state.raidCuts.filter((cut) => cut.turnNumber === state.turnNumber).map((cut) => cut.subTerritoryId));
  return { cut, cutSubTerritoryIds: subTerritoryIds.filter((id) => cutIds.has(id)), gross, paid, subTerritoryIds };
}
