import type { FactionId, GameState, Scenario, SubTerritoryDefinition, TerritoryId } from "../types";

/**
 * W6, $2: who holds a territory, read from its sub-territories' holders (not from the Milestone 2
 * territory control). A territory is held whole when one faction holds every sub-territory, and
 * contested when two or more factions hold sub-territories in it.
 */

type Sites = GameState["subTerritories"];

export function subTerritoriesOf(scenario: Scenario, territoryId: TerritoryId): readonly SubTerritoryDefinition[] {
  return scenario.index.subTerritoriesByTerritory.get(territoryId) ?? [];
}

/** The distinct holders of a territory's sub-territories, in sub-territory order. */
export function holdersIn(scenario: Scenario, sites: Sites, territoryId: TerritoryId): readonly FactionId[] {
  const holders: FactionId[] = [];
  for (const sub of subTerritoriesOf(scenario, territoryId)) {
    const holder = sites[sub.id]?.holder;
    if (holder !== undefined && !holders.includes(holder)) holders.push(holder);
  }
  return holders;
}

/** The faction holding every sub-territory of the territory, if one does. */
export function wholeHolder(scenario: Scenario, sites: Sites, territoryId: TerritoryId): FactionId | undefined {
  const holders = holdersIn(scenario, sites, territoryId);
  return holders.length === 1 ? holders[0] : undefined;
}

/** W6: two or more factions hold sub-territories in the territory. */
export function isContested(scenario: Scenario, sites: Sites, territoryId: TerritoryId): boolean {
  return holdersIn(scenario, sites, territoryId).length > 1;
}

/** The territories a faction holds whole, in scenario order. */
export function territoriesHeldWhole(scenario: Scenario, sites: Sites, factionId: FactionId): readonly TerritoryId[] {
  return scenario.territories.filter((territory) => wholeHolder(scenario, sites, territory.id) === factionId).map((territory) => territory.id);
}
