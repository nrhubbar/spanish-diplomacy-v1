import type {
  BouncedMoveOutcome,
  DisbandedMoveOutcome,
  GameState,
  InvalidOrderOutcome,
  MoveOrder,
  NoMoveOutcome,
  PlayerSubmission,
  ScenarioDefinition,
  SuccessfulMoveOutcome,
  TerritoryId,
  TurnOutcome,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "./types";
import { validateMoveOrder } from "./validation";
import { evaluateVictory, victoryProgress } from "./victory";

export function resolveTurn(
  scenario: ScenarioDefinition,
  state: GameState,
  submissions: readonly PlayerSubmission[]
): TurnResolutionResult {
  const submittedOrders = submissions.flatMap((submission) => submission.orders);
  const invalidOutcomes = submittedOrders.flatMap((order): InvalidOrderOutcome[] => {
    const validation = validateMoveOrder(scenario, state, order);

    return validation.ok
      ? []
      : [{ kind: "invalid-order", order, reason: `Impossible order: ${validation.reason}` }];
  });
  const validMoves = submittedOrders.filter((order) => validateMoveOrder(scenario, state, order).ok);
  const movingUnitIds = new Set<UnitId>(validMoves.map((order) => order.unitId));
  const incomingByDestination = groupMovesByDestination(validMoves);
  const invalidUnitIds = new Set<UnitId>(invalidOutcomes.map((outcome) => outcome.order.unitId));
  const firstPass = validMoves.map((order) =>
    resolveMoveOrder(order, state, validMoves, movingUnitIds, incomingByDestination)
  );
  const successfulMoveDestinations = new Map<TerritoryId, SuccessfulMoveOutcome>();

  for (const outcome of firstPass) {
    if (outcome.kind === "successful-move") {
      successfulMoveDestinations.set(outcome.order.to, outcome);
    }
  }

  const outcomes = [
    ...firstPass.map((outcome) => applyDisbandIfOriginWasCaptured(outcome, successfulMoveDestinations)),
    ...invalidOutcomes,
    ...buildNoMoveOutcomes(scenario, state, submissions, movingUnitIds, invalidUnitIds)
  ];
  const disbandedUnitIds = new Set<UnitId>(
    outcomes.flatMap((outcome) =>
      outcome.kind === "disbanded-move" || outcome.kind === "invalid-order" ? [outcome.order.unitId] : []
    )
  );
  const finalUnits = applyUnitOutcomes(state.units, outcomes, disbandedUnitIds);
  const finalControl = applyControlOutcomes(state.control, outcomes);
  const cityControl = applyCityControlOutcomes(scenario, state.cityControl, outcomes);
  const finalState = { cityControl, control: finalControl, turnNumber: state.turnNumber, units: finalUnits };
  const progress = victoryProgress(scenario, finalState);
  const victory = evaluateVictory(progress);
  const controlChanges = outcomes.flatMap((outcome) =>
    outcome.kind === "successful-move"
      ? [{ territoryId: outcome.order.to, controller: outcome.order.factionId }]
      : []
  );

  return {
    controlChanges,
    cityControl,
    finalControl,
    finalUnits,
    outcomes,
    progress,
    submittedOrders,
    summaryLines: outcomes.map((outcome) => formatOutcome(scenario, outcome)),
    ...(victory === undefined ? {} : { victory })
  };
}

function resolveMoveOrder(
  order: MoveOrder,
  state: GameState,
  validMoves: readonly MoveOrder[],
  movingUnitIds: ReadonlySet<UnitId>,
  incomingByDestination: ReadonlyMap<TerritoryId, readonly MoveOrder[]>
): SuccessfulMoveOutcome | BouncedMoveOutcome {
  const destinationIncoming = incomingByDestination.get(order.to) as readonly MoveOrder[];
  const hostileStationaryOccupant = Object.values(state.units).find(
    (unit) =>
      unit.territoryId === order.to &&
      unit.factionId !== order.factionId &&
      !movingUnitIds.has(unit.id)
  );
  const hostileIncoming = destinationIncoming.filter(
    (candidate) => candidate.factionId !== order.factionId
  );
  const headOnSwap = validMoves.some(
    (otherOrder) =>
      otherOrder.factionId !== order.factionId &&
      otherOrder.unitId !== order.unitId &&
      otherOrder.from === order.to &&
      otherOrder.to === order.from
  );

  if (hostileIncoming.length === 0 && hostileStationaryOccupant === undefined && !headOnSwap) {
    return { kind: "successful-move", order };
  }

  return {
    kind: "bounced-move",
    order,
    reason:
      headOnSwap
        ? "Units attempted to swap territories."
        : hostileStationaryOccupant === undefined
        ? "Multiple units moved to the same territory."
        : "Destination was occupied."
  };
}

function applyDisbandIfOriginWasCaptured(
  outcome: SuccessfulMoveOutcome | BouncedMoveOutcome,
  successfulMoveDestinations: ReadonlyMap<TerritoryId, SuccessfulMoveOutcome>
): SuccessfulMoveOutcome | BouncedMoveOutcome | DisbandedMoveOutcome {
  if (outcome.kind === "successful-move") {
    return outcome;
  }

  const originCapture = successfulMoveDestinations.get(outcome.order.from);

  if (originCapture === undefined) {
    return outcome;
  }

  return {
    kind: "disbanded-move",
    order: outcome.order,
    reason: `${outcome.reason} Origin was captured by ${originCapture.order.factionId}.`
  };
}

function buildNoMoveOutcomes(
  scenario: ScenarioDefinition,
  state: GameState,
  submissions: readonly PlayerSubmission[],
  movingUnitIds: ReadonlySet<UnitId>,
  invalidUnitIds: ReadonlySet<UnitId>
): readonly NoMoveOutcome[] {
  return scenario.factions.flatMap((faction) => {
    const submission = submissions.find((candidate) => candidate.factionId === faction.id);
    const factionUnits = Object.values(state.units).filter((unit) => unit.factionId === faction.id);
    const idleUnits = factionUnits.filter(
      (unit) => !movingUnitIds.has(unit.id) && !invalidUnitIds.has(unit.id)
    );

    if (submission === undefined || submission.orders.length === 0) {
      return idleUnits.length === 0
        ? [{ kind: "no-move", factionId: faction.id }]
        : idleUnits.map((unit) => ({ kind: "no-move", factionId: faction.id, unitId: unit.id }));
    }

    return [];
  });
}

function applyUnitOutcomes(
  startUnits: Record<UnitId, UnitState>,
  outcomes: readonly TurnOutcome[],
  disbandedUnitIds: ReadonlySet<UnitId>
): Record<UnitId, UnitState> {
  const finalUnits = Object.fromEntries(
    Object.entries(startUnits).filter(([unitId]) => !disbandedUnitIds.has(unitId))
  );

  for (const outcome of outcomes) {
    if (outcome.kind === "successful-move" && !disbandedUnitIds.has(outcome.order.unitId)) {
      const unit = finalUnits[outcome.order.unitId];

      if (unit === undefined) {
        continue;
      }

      finalUnits[outcome.order.unitId] = {
        ...unit,
        territoryId: outcome.order.to
      };
    }
  }

  return finalUnits;
}

function applyControlOutcomes(
  startControl: GameState["control"],
  outcomes: readonly TurnOutcome[]
): GameState["control"] {
  const finalControl = { ...startControl };

  for (const outcome of outcomes) {
    if (outcome.kind === "successful-move") {
      finalControl[outcome.order.to] = { kind: "controlled", factionId: outcome.order.factionId };
    }
  }

  return finalControl;
}

function applyCityControlOutcomes(
  scenario: ScenarioDefinition,
  startControl: GameState["cityControl"],
  outcomes: readonly TurnOutcome[]
): GameState["cityControl"] {
  const finalControl = { ...startControl };

  for (const outcome of outcomes) {
    if (outcome.kind !== "successful-move") {
      continue;
    }

    for (const city of scenario.cities.filter((candidate) => candidate.territoryId === outcome.order.to)) {
      finalControl[city.id] = outcome.order.factionId;
    }
  }

  return finalControl;
}

function groupMovesByDestination(moveOrders: readonly MoveOrder[]): Map<TerritoryId, MoveOrder[]> {
  const grouped = new Map<TerritoryId, MoveOrder[]>();

  for (const order of moveOrders) {
    grouped.set(order.to, [...(grouped.get(order.to) ?? []), order]);
  }

  return grouped;
}

function formatOutcome(scenario: ScenarioDefinition, outcome: TurnOutcome): string {
  if (outcome.kind === "no-move") {
    const factionName = scenario.factions.find((faction) => faction.id === outcome.factionId)?.name ?? outcome.factionId;
    return outcome.unitId === undefined
      ? `${factionName} submitted no orders.`
      : `${unitName(scenario, outcome.unitId)} held in place.`;
  }

  const unit = unitName(scenario, outcome.order.unitId);
  const from = territoryName(scenario, outcome.order.from);
  const to = territoryName(scenario, outcome.order.to);

  if (outcome.kind === "successful-move") {
    return `${unit} moved from ${from} to ${to}.`;
  }

  if (outcome.kind === "disbanded-move") {
    return `${unit} was disbanded while moving from ${from} to ${to}: ${outcome.reason}`;
  }

  if (outcome.kind === "invalid-order") {
    return `${unit} was disbanded: ${outcome.reason}`;
  }

  return `${unit} bounced moving from ${from} to ${to}: ${outcome.reason}`;
}

function unitName(scenario: ScenarioDefinition, unitId: UnitId): string {
  return scenario.units[unitId]?.displayName ?? unitId;
}

function territoryName(scenario: ScenarioDefinition, territoryId: TerritoryId): string {
  return scenario.territories.find((territory) => territory.id === territoryId)?.name ?? territoryId;
}
