import { type Armies, compareIds, placeAt, removeArmies, replaceArmies, requireArmy } from "./board";
import { hookedRetreatAllowed } from "./hooks";
import { neighborsOf, requireUnitState } from "./lookup";
import type { FactionId, GameState, MoveOrder, Scenario, TerritoryId, UnitId, UnitState } from "./types";

/** Which outcome reports what became of a leaving army: a battle, by index, or its own move. */
export type ReportTo =
  | { readonly battleIndex: number }
  /** An entry tie (M19): the move bounced without a battle against these factions. */
  | { readonly opposingFactionIds: readonly FactionId[]; readonly order: MoveOrder };

/**
 * M21: an army that must leave where it stands once the battles are over. `return` armies are
 * back at their origin (`from`) and fall back only if another faction took it; `retreat` armies
 * must leave the battle territory `from`.
 */
export interface Leaving {
  readonly from: TerritoryId;
  readonly kind: "return" | "retreat";
  readonly report: ReportTo;
  readonly unitId: UnitId;
}

/** What became of a leaving army. */
export type Settled =
  | { readonly kind: "home"; readonly leaving: Leaving }
  | { readonly kind: "retreated"; readonly leaving: Leaving; readonly takenBy?: FactionId; readonly to: TerritoryId }
  | { readonly kind: "surrendered"; readonly leaving: Leaving; readonly takenBy?: FactionId };

export interface Departures {
  readonly armies: Armies;
  readonly settled: readonly Settled[];
}

/**
 * M21 (C11): returning armies stay home unless an army of another faction entered their origin
 * this turn and stands there. Every army that must go retreats to the adjacent territory its
 * faction controlled at the start of the turn where no army of another faction stands, choosing
 * the one holding the most armies of its faction (ties: scenario order). Every choice is made
 * against the same snapshot, before any retreat, so armies of one faction leaving one territory
 * go together and the order never matters. With nowhere to go, the army surrenders.
 */
export function settleDepartures(scenario: Scenario, start: GameState, armies: Armies, leaving: readonly Leaving[]): Departures {
  const retreating = new Set(leaving.filter((entry) => entry.kind === "retreat").map((entry) => entry.unitId));
  const takers = new Map(leaving.flatMap((entry): [UnitId, FactionId][] => {
    const taker = entry.kind === "return" ? takerOf(start, armies, entry, retreating) : undefined;
    return taker === undefined ? [] : [[entry.unitId, taker]];
  }));
  const going = new Set([...retreating, ...takers.keys()]);
  const staying = Object.values(armies).filter((unit) => !going.has(unit.id));

  const settled = leaving.map((entry): Settled => {
    const takenBy = takers.get(entry.unitId);
    if (!going.has(entry.unitId)) {
      return { kind: "home", leaving: entry };
    }
    const unit = requireArmy(armies, entry.unitId);
    const to = retreatDestination(scenario, start, staying, unit.factionId, entry.from, unit.id);
    const taken = takenBy === undefined ? {} : { takenBy };
    return to === undefined ? { kind: "surrendered", leaving: entry, ...taken } : { kind: "retreated", leaving: entry, to, ...taken };
  });

  const moved: UnitState[] = [];
  const surrendered: UnitId[] = [];
  for (const entry of settled) {
    if (entry.kind === "retreated") {
      moved.push(placeAt(requireArmy(armies, entry.leaving.unitId), entry.to));
    } else if (entry.kind === "surrendered") {
      surrendered.push(entry.leaving.unitId);
    }
  }
  return { armies: removeArmies(replaceArmies(armies, moved), surrendered), settled };
}

/** The faction that took a returning army's origin: one of its armies entered it this turn and stands there. */
function takerOf(start: GameState, armies: Armies, entry: Leaving, retreating: ReadonlySet<UnitId>): FactionId | undefined {
  const unit = requireArmy(armies, entry.unitId);
  const entered = Object.values(armies).filter((other) =>
    other.territoryId === entry.from
    && other.factionId !== unit.factionId
    && !retreating.has(other.id)
    && requireUnitState(start, other.id).territoryId !== entry.from);
  return entered.map((other) => other.factionId).sort(compareIds)[0];
}

export function retreatDestination(
  scenario: Scenario,
  start: GameState,
  staying: readonly UnitState[],
  factionId: FactionId,
  from: TerritoryId,
  /** R1: the army retreating, whose pocket the path leaves from; without one, any of the side's ground. */
  unitId?: UnitId
): TerritoryId | undefined {
  const candidates = neighborsOf(scenario, from)
    .map((neighbor) => neighbor.territoryId)
    .filter((id) => {
      const control = start.control[id];
      return control?.kind === "controlled" && control.factionId === factionId
        && !staying.some((unit) => unit.territoryId === id && unit.factionId !== factionId)
        // P6, R1: a module may require a path (out of the army's own pocket).
        && hookedRetreatAllowed({ factionId, from, scenario, state: start, to: id, ...(unitId === undefined ? {} : { unitId }) });
    })
    .map((id) => ({ friends: staying.filter((unit) => unit.territoryId === id).length, id, rank: scenario.territories.findIndex((territory) => territory.id === id) }))
    .sort((left, right) => right.friends - left.friends || left.rank - right.rank);
  return candidates[0]?.id;
}
