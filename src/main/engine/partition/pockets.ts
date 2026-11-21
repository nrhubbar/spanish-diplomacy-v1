import type { FactionId, GameState, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitState } from "../types";
import { distancesFrom, frontGraph } from "./flips";
import { type Holdings, heldBy, holdersIn, subTerritoriesOf } from "./holders";

/**
 * R1: pockets. In a contested territory each side's armies belong to a pocket, a connected group
 * of sub-territories that side holds; they leave only across its borders. Withdraw, retreat,
 * control, the Invade and Reinforce panes and the AI call these and never re-derive them.
 *
 * Units stand in a territory, not a sub-territory. An army's place inside one is its stored
 * `subTerritoryId` (set at the end of each turn in contested ground, `settleAnchors`), else its
 * city's sub-territory; an army with neither stands in its side's first pocket.
 */
export interface Pocket {
  readonly factionId: FactionId;
  /** The pocket's sub-territories, in scenario order. */
  readonly subTerritoryIds: readonly SubTerritoryId[];
  readonly territoryId: TerritoryId;
}

/**
 * R1: the side's pockets in a territory on these holdings, in scenario order of their first
 * sub-territory. Uncontested ground is one pocket of everything the side holds (as today), even
 * where it is not joined (islands); none where the side holds nothing.
 */
export function pocketsIn(scenario: Scenario, holdings: Holdings, territoryId: TerritoryId, factionId: FactionId): Pocket[] {
  // Holdings are never changed in place (a flip makes new ones), so the answer is cached per holdings object.
  const byScenario = cache.get(holdings) ?? new WeakMap<Scenario, Map<string, Pocket[]>>();
  cache.set(holdings, byScenario);
  const known = byScenario.get(scenario) ?? new Map<string, Pocket[]>();
  byScenario.set(scenario, known);
  const key = `${territoryId}|${factionId}`;
  const cached = known.get(key);
  if (cached !== undefined) return [...cached];
  const pockets = findPockets(scenario, holdings, territoryId, factionId);
  known.set(key, pockets);
  return [...pockets];
}

const cache = new WeakMap<Holdings, WeakMap<Scenario, Map<string, Pocket[]>>>();

function findPockets(scenario: Scenario, holdings: Holdings, territoryId: TerritoryId, factionId: FactionId): Pocket[] {
  const held = heldBy(scenario, holdings, territoryId, factionId);
  if (held.length === 0) return [];
  if (holdersIn(scenario, holdings, territoryId).length < 2) return [{ factionId, subTerritoryIds: held, territoryId }];
  // Union-find over the borders between the side's own sub-territories (all inside the territory).
  const parent = new Map<SubTerritoryId, SubTerritoryId>(held.map((id) => [id, id]));
  const root = (id: SubTerritoryId): SubTerritoryId => {
    let current = id;
    for (let up = parent.get(current) as SubTerritoryId; up !== current; up = parent.get(current) as SubTerritoryId) current = up;
    return current;
  };
  for (const [a, b] of scenario.subTerritoryBorders) {
    if (parent.has(a) && parent.has(b)) parent.set(root(a), root(b));
  }
  const groups = new Map<SubTerritoryId, SubTerritoryId[]>();
  for (const id of held) groups.set(root(id), [...(groups.get(root(id)) ?? []), id]);
  const pockets = [...groups.values()].map((subTerritoryIds): Pocket => ({ factionId, subTerritoryIds, territoryId }));
  return pockets;
}

/** R1: the side's pockets in a territory, in scenario order of their first sub-territory; none where it holds nothing. */
export function pocketsOf(scenario: Scenario, state: Pick<GameState, "subTerritories">, territoryId: TerritoryId, factionId: FactionId): Pocket[] {
  return pocketsIn(scenario, state.subTerritories, territoryId, factionId);
}

/** Where an army stands inside its territory: its stored sub-territory, else its city's; undefined with neither, or when that lies in another territory. */
export function armyAnchor(scenario: Scenario, unit: UnitState): SubTerritoryId | undefined {
  const anchor = unit.subTerritoryId ?? (unit.cityId === undefined ? undefined : scenario.index.cities.get(unit.cityId)?.subTerritoryId);
  return anchor !== undefined && scenario.index.subTerritories.get(anchor)?.territoryId === unit.territoryId ? anchor : undefined;
}

/** R1: the pocket holding the army's anchor on these holdings, else its side's first pocket there. */
export function pocketOfUnit(scenario: Scenario, holdings: Holdings, unit: UnitState): Pocket | undefined {
  const pockets = pocketsIn(scenario, holdings, unit.territoryId, unit.factionId);
  const anchor = armyAnchor(scenario, unit);
  return pockets.find((pocket) => anchor !== undefined && pocket.subTerritoryIds.includes(anchor)) ?? pockets[0];
}

/** R1: the pocket a ground army stands in; undefined for an army not on the map or where its side holds nothing. */
export function pocketOfArmy(scenario: Scenario, state: Pick<GameState, "subTerritories" | "units">, unitId: UnitId): Pocket | undefined {
  const unit = state.units[unitId];
  return unit === undefined ? undefined : pocketOfUnit(scenario, state.subTerritories, unit);
}

/**
 * R1: the sub-territory an army arriving from `fromTerritory` reaches first in `toTerritory`: the
 * side's ground nearest the border it crosses (over land where the two share a land connection),
 * ties in scenario order. Undefined when the side holds nothing there.
 */
export function arrivalSite(scenario: Scenario, holdings: Holdings, fromTerritory: TerritoryId, toTerritory: TerritoryId, factionId: FactionId): SubTerritoryId | undefined {
  const held = heldBy(scenario, holdings, toTerritory, factionId);
  const distance = distancesFrom(scenario, subTerritoriesOf(scenario, fromTerritory).map((sub) => sub.id), frontGraph(scenario, fromTerritory, toTerritory));
  const far = Number.POSITIVE_INFINITY;
  return held.reduce<SubTerritoryId | undefined>((best, id) =>
    best === undefined || (distance.get(id) ?? far) < (distance.get(best) ?? far) ? id : best, undefined);
}

/**
 * R1: the pocket an army arriving from `fromTerritory` joins in `toTerritory`: the one on the
 * side of the border it crosses. Undefined when its side holds nothing there yet.
 */
export function arrivalPocket(scenario: Scenario, state: Pick<GameState, "subTerritories">, fromTerritory: TerritoryId, toTerritory: TerritoryId, factionId: FactionId): Pocket | undefined {
  const site = arrivalSite(scenario, state.subTerritories, fromTerritory, toTerritory, factionId);
  return pocketsOf(scenario, state, toTerritory, factionId).find((pocket) => site !== undefined && pocket.subTerritoryIds.includes(site));
}
