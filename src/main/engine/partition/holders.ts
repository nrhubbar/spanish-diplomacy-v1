import type {
  CityId,
  FactionId,
  GameState,
  Scenario,
  SubTerritoryDefinition,
  SubTerritoryId,
  SubTerritoryState,
  TerritoryControl,
  TerritoryId
} from "../types";

/**
 * W2, W6, P1, P7: who holds what. Under the `provinces` partition module a territory's control
 * is derived from its sub-territories' holders: one holder controls it whole, two or more
 * contest it. These helpers are pure and shared by the engine, the UI and the computer player.
 */

export type Holdings = Readonly<Record<SubTerritoryId, SubTerritoryState>>;

/** True when the scenario partitions its territories into sub-territories with the `provinces` module. */
export function isPartitioned(scenario: Scenario): boolean {
  return scenario.rules.partition === "provinces" && scenario.subTerritories.length > 0;
}

/** A territory's sub-territories in scenario order. */
export function subTerritoriesOf(scenario: Scenario, territoryId: TerritoryId): readonly SubTerritoryDefinition[] {
  return scenario.index.subTerritoriesByTerritory.get(territoryId) ?? [];
}

/** The holder of a sub-territory: its state, or its start holder when the state has none. */
export function holderOf(scenario: Scenario, holdings: Holdings, subTerritoryId: SubTerritoryId): FactionId | undefined {
  return holdings[subTerritoryId]?.holder ?? scenario.index.subTerritories.get(subTerritoryId)?.startHolder;
}

/** The factions holding sub-territories in a territory, in scenario faction order. */
export function holdersIn(scenario: Scenario, holdings: Holdings, territoryId: TerritoryId): readonly FactionId[] {
  const present = new Set(subTerritoriesOf(scenario, territoryId).flatMap((sub) => holderOf(scenario, holdings, sub.id) ?? []));
  return scenario.factions.map((faction) => faction.id).filter((id) => present.has(id));
}

/** The sub-territories of a territory one faction holds, in scenario order. */
export function heldBy(scenario: Scenario, holdings: Holdings, territoryId: TerritoryId, factionId: FactionId): readonly SubTerritoryId[] {
  return subTerritoriesOf(scenario, territoryId).filter((sub) => holderOf(scenario, holdings, sub.id) === factionId).map((sub) => sub.id);
}

/** W6: one holder controls a territory whole; two or more contest it. Undefined for a territory without sub-territories. */
export function territoryControlFrom(scenario: Scenario, holdings: Holdings, territoryId: TerritoryId): TerritoryControl | undefined {
  const holders = holdersIn(scenario, holdings, territoryId);
  const [only] = holders;
  if (only === undefined) return undefined;
  return holders.length === 1 ? { factionId: only, kind: "controlled" } : { factionIds: holders, kind: "contested" };
}

/**
 * P2, P7: territory and city control derived from the holders. A city follows the holder of its
 * own sub-territory. Territories and cities without sub-territories keep `previous`.
 */
export function controlFromHolders(
  scenario: Scenario,
  holdings: Holdings,
  previous: Pick<GameState, "cityControl" | "control">
): Pick<GameState, "cityControl" | "control"> {
  const control: Record<TerritoryId, TerritoryControl> = { ...previous.control };
  for (const territory of scenario.territories) {
    const derived = territoryControlFrom(scenario, holdings, territory.id);
    if (derived !== undefined && !sameControl(derived, previous.control[territory.id])) control[territory.id] = derived;
  }
  const cityControl: Record<CityId, FactionId> = { ...previous.cityControl };
  for (const city of scenario.cities) {
    const holder = city.subTerritoryId === undefined ? undefined : holderOf(scenario, holdings, city.subTerritoryId);
    if (holder !== undefined) cityControl[city.id] = holder;
  }
  return { cityControl, control };
}

/**
 * W6, C1, C8: a territory is contested when two or more factions hold sub-territories in it.
 * Exposed for every slice that pauses or forbids something in contested ground (training,
 * Replenish, Recruit, build queues). Without sub-territories it falls back to the state's control.
 */
export function isContested(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, territoryId: TerritoryId): boolean {
  if (subTerritoriesOf(scenario, territoryId).length === 0) return state.control[territoryId]?.kind === "contested";
  return holdersIn(scenario, state.subTerritories, territoryId).length > 1;
}

/** P7: true when one faction holds every sub-territory of the territory (or controls it, without sub-territories). */
export function holdsWhole(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, territoryId: TerritoryId, factionId: FactionId): boolean {
  if (subTerritoriesOf(scenario, territoryId).length === 0) {
    const control = state.control[territoryId];
    return control?.kind === "controlled" && control.factionId === factionId;
  }
  const holders = holdersIn(scenario, state.subTerritories, territoryId);
  return holders.length === 1 && holders[0] === factionId;
}

/** Equal control, contested factions compared as a set (so a stated order is kept). */
function sameControl(left: TerritoryControl, right: TerritoryControl | undefined): boolean {
  if (right === undefined || left.kind !== right.kind) return false;
  if (left.kind === "controlled" && right.kind === "controlled") return left.factionId === right.factionId;
  const ids = left.kind === "contested" ? left.factionIds : [];
  const others = right.kind === "contested" ? right.factionIds : [];
  return ids.length === others.length && ids.every((id) => others.includes(id));
}
