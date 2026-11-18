import { citiesIn, neighborsOf, requireFaction } from "../engine/lookup";
import type { RandomSource } from "../engine/random";
import type {
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  Scenario,
  TerritoryId,
  TurnOutcome,
  UnitState
} from "../engine/types";
import { validateMoveOrder } from "../engine/validation";

/**
 * Public information a computer player may use. It sees exactly what a human sees: the board
 * and the revealed outcomes of the previous turn, never another faction's pending orders.
 */
export interface ComputerPlayerContext {
  readonly previousOutcomes?: readonly TurnOutcome[];
}

/** Scoring weights, exported so tests and the soak run can reason about them. */
export const computerWeights = {
  approachObjective: 3,
  bouncedLastTurn: -4,
  captureCity: 1,
  captureTerritory: 4,
  contested: 2,
  crowding: -1,
  holdLastDefenderOfObjective: 6,
  holdOwnCity: 1,
  holdThreatened: 2,
  idleInertia: 1,
  likelyHeld: -3,
  takeObjective: 5
} as const;

export function generateComputerSubmission(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  random: RandomSource,
  context: ComputerPlayerContext = {}
): PlayerSubmission {
  const faction = requireFaction(scenario, factionId);
  const objectives = new Set<TerritoryId>(faction.objectiveTerritoryIds);
  const ownUnits = Object.values(state.units).filter((unit) => unit.factionId === factionId);
  const defenders = countBy(ownUnits.map((unit) => unit.territoryId));
  const plannedArrivals = new Map<TerritoryId, number>();
  const bounced = bouncedMoves(context.previousOutcomes ?? [], factionId);
  const targets = remainingObjectives(state, factionId, objectives);
  const distance = distancesTo(scenario, targets.size > 0 ? targets : objectives);
  const orders: MoveOrder[] = [];

  for (const unit of ownUnits) {
    const holdScore = scoreHold(scenario, state, unit, objectives, defenders.get(unit.territoryId) ?? 0);
    const scored = legalMoves(scenario, state, unit).map((order) => ({
      order,
      score: scoreMove(scenario, state, order, objectives, distance, bounced, plannedArrivals)
    }));
    const best = Math.max(Number.NEGATIVE_INFINITY, ...scored.map((entry) => entry.score));
    if (best <= holdScore) {
      continue;
    }
    const choices = scored.filter((entry) => entry.score === best);
    const choice = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
    if (choice === undefined) {
      continue;
    }
    orders.push(choice.order);
    defenders.set(unit.territoryId, (defenders.get(unit.territoryId) ?? 1) - 1);
    plannedArrivals.set(choice.order.to, (plannedArrivals.get(choice.order.to) ?? 0) + 1);
  }

  return { factionId, orders };
}

export function legalMoves(scenario: Scenario, state: GameState, unit: UnitState): readonly MoveOrder[] {
  return neighborsOf(scenario, unit.territoryId)
    .map((neighbor): MoveOrder => ({
      factionId: unit.factionId,
      from: unit.territoryId,
      kind: "move",
      to: neighbor.territoryId,
      unitId: unit.id
    }))
    .filter((order) => validateMoveOrder(scenario, state, order).ok);
}

function scoreHold(
  scenario: Scenario,
  state: GameState,
  unit: UnitState,
  objectives: ReadonlySet<TerritoryId>,
  defendersHere: number
): number {
  // Only the last defender carries the value of holding; extra units are free to advance.
  if (defendersHere > 1) {
    return computerWeights.idleInertia;
  }
  const here = unit.territoryId;
  const ownCities = citiesIn(scenario, here).filter((city) => state.cityControl[city.id] === unit.factionId).length;
  const threatened = neighborsOf(scenario, here).some((neighbor) =>
    Object.values(state.units).some(
      (other) => other.territoryId === neighbor.territoryId && other.factionId !== unit.factionId
    )
  );
  return computerWeights.idleInertia
    + (objectives.has(here) ? computerWeights.holdLastDefenderOfObjective : 0)
    + ownCities * computerWeights.holdOwnCity
    + (threatened ? computerWeights.holdThreatened : 0);
}

function scoreMove(
  scenario: Scenario,
  state: GameState,
  order: MoveOrder,
  objectives: ReadonlySet<TerritoryId>,
  distance: ReadonlyMap<TerritoryId, number>,
  bounced: ReadonlySet<string>,
  plannedArrivals: ReadonlyMap<TerritoryId, number>
): number {
  const control = state.control[order.to];
  const ownsDestination = control?.kind === "controlled" && control.factionId === order.factionId;
  const hostileHere = Object.values(state.units).some(
    (unit) => unit.territoryId === order.to && unit.factionId !== order.factionId
  );
  const friendlyHere = Object.values(state.units).some(
    (unit) => unit.territoryId === order.to && unit.factionId === order.factionId
  );
  const gain = Math.max(0, (distance.get(order.from) ?? 0) - (distance.get(order.to) ?? 0));
  const newCities = citiesIn(scenario, order.to).filter((city) => state.cityControl[city.id] !== order.factionId).length;

  return gain * computerWeights.approachObjective
    + (objectives.has(order.to) && !ownsDestination ? computerWeights.takeObjective : 0)
    + (control?.kind === "controlled" && !ownsDestination ? computerWeights.captureTerritory : 0)
    + (control?.kind === "contested" ? computerWeights.contested : 0)
    + newCities * computerWeights.captureCity
    + (hostileHere && !friendlyHere ? computerWeights.likelyHeld : 0)
    + (bounced.has(moveKey(order)) ? computerWeights.bouncedLastTurn : 0)
    + (plannedArrivals.get(order.to) ?? 0) * computerWeights.crowding;
}

function remainingObjectives(
  state: GameState,
  factionId: FactionId,
  objectives: ReadonlySet<TerritoryId>
): ReadonlySet<TerritoryId> {
  return new Set([...objectives].filter((territoryId) => {
    const control = state.control[territoryId];
    return !(control?.kind === "controlled" && control.factionId === factionId);
  }));
}

/** Breadth-first distance from every territory to the nearest target. */
function distancesTo(scenario: Scenario, targets: ReadonlySet<TerritoryId>): ReadonlyMap<TerritoryId, number> {
  const distance = new Map<TerritoryId, number>();
  let frontier = [...targets];
  for (const target of frontier) distance.set(target, 0);
  let step = 0;
  while (frontier.length > 0) {
    step += 1;
    const next: TerritoryId[] = [];
    for (const territoryId of frontier) {
      for (const neighbor of neighborsOf(scenario, territoryId)) {
        if (!distance.has(neighbor.territoryId)) {
          distance.set(neighbor.territoryId, step);
          next.push(neighbor.territoryId);
        }
      }
    }
    frontier = next;
  }
  return distance;
}

function bouncedMoves(outcomes: readonly TurnOutcome[], factionId: FactionId): ReadonlySet<string> {
  return new Set(outcomes.flatMap((outcome) =>
    outcome.kind === "bounced-move" && outcome.order.factionId === factionId ? [moveKey(outcome.order)] : []
  ));
}

function moveKey(order: MoveOrder): string {
  return `${order.unitId}:${order.from}:${order.to}`;
}

function countBy<Key>(keys: readonly Key[]): Map<Key, number> {
  const counts = new Map<Key, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}
