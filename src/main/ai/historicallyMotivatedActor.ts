import type {
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  ScenarioDefinition,
  TerritoryId,
  UnitState
} from "../engine/types";
import { validateMoveOrder } from "../engine/validation";

export type RandomSource = () => number;

export function generateComputerSubmission(
  scenario: ScenarioDefinition,
  state: GameState,
  factionId: FactionId,
  random: RandomSource = Math.random
): PlayerSubmission {
  const faction = scenario.factions.find((candidate) => candidate.id === factionId);

  if (faction === undefined) {
    throw new Error(`Unknown computer faction: ${factionId}`);
  }

  const orders = Object.values(state.units)
    .filter((unit) => unit.factionId === factionId)
    .flatMap((unit) => {
      const options = legalMovesForUnit(scenario, state, unit);

      if (options.length === 0) {
        return [];
      }

      const scored = options.map((order) => ({
        order,
        score: scoreMove(scenario, state, factionId, faction.objectiveTerritoryIds, order)
      }));
      const bestScore = Math.max(0, ...scored.map((entry) => entry.score));
      const best = scored.filter((entry) => entry.score === bestScore && entry.score > 0);

      if (best.length === 0) {
        return [];
      }

      const index = Math.min(best.length - 1, Math.floor(random() * best.length));
      return [(best[index] as { readonly order: MoveOrder }).order];
    });

  return { factionId, orders };
}

export function legalMovesForUnit(
  scenario: ScenarioDefinition,
  state: GameState,
  unit: UnitState
): readonly MoveOrder[] {
  const territory = scenario.territories.find((candidate) => candidate.id === unit.territoryId);

  if (territory === undefined) {
    return [];
  }

  return territory.adjacent
    .map((to): MoveOrder => ({
      factionId: unit.factionId,
      from: unit.territoryId,
      kind: "move",
      to,
      unitId: unit.id
    }))
    .filter((order) => validateMoveOrder(scenario, state, order).ok);
}

function scoreMove(
  scenario: ScenarioDefinition,
  state: GameState,
  factionId: FactionId,
  objectives: readonly TerritoryId[],
  order: MoveOrder
): number {
  const destinationControl = state.control[order.to];
  const capturesOpponent =
    destinationControl.kind === "controlled" && destinationControl.factionId !== factionId;
  const contested = destinationControl.kind === "contested";
  const objective = objectives.includes(order.to);
  const distanceGain = Math.max(
    0,
    nearestObjectiveDistance(scenario, order.from, objectives) -
      nearestObjectiveDistance(scenario, order.to, objectives)
  );

  return distanceGain * 3 + (objective ? 5 : 0) + (capturesOpponent ? 4 : 0) + (contested ? 2 : 0);
}

function nearestObjectiveDistance(
  scenario: ScenarioDefinition,
  start: TerritoryId,
  objectives: readonly TerritoryId[]
): number {
  if (objectives.includes(start)) {
    return 0;
  }

  const visited = new Set<TerritoryId>([start]);
  let frontier: TerritoryId[] = [start];
  let distance = 0;

  while (frontier.length > 0) {
    distance += 1;
    const next = frontier.flatMap((territoryId) =>
      scenario.territories.find((territory) => territory.id === territoryId)!.adjacent
    ).filter((territoryId) => {
      if (visited.has(territoryId)) {
        return false;
      }
      visited.add(territoryId);
      return true;
    });

    if (next.some((territoryId) => objectives.includes(territoryId))) {
      return distance;
    }

    frontier = next;
  }

  return Number.MAX_SAFE_INTEGER;
}
