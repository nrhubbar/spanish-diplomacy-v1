import { citiesIn } from "./lookup";
import type {
  BounceCause,
  BouncedMoveOutcome,
  CityChange,
  CityId,
  ControlChange,
  DisbandedMoveOutcome,
  FactionId,
  GameState,
  InvalidOrderOutcome,
  MoveOrder,
  NoMoveOutcome,
  PlayerSubmission,
  Scenario,
  SuccessfulMoveOutcome,
  TerritoryControl,
  TerritoryId,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "./types";
import { validateMoveOrder } from "./validation";
import { evaluateVictory, victoryProgress } from "./victory";

/**
 * Resolves one turn under the `m2-movement` ruleset. Rule ids (M1-M10) refer to
 * `project/specs/scenario-package.md`.
 */
export function resolveTurn(
  scenario: Scenario,
  state: GameState,
  submissions: readonly PlayerSubmission[]
): TurnResolutionResult {
  const submittedOrders = submissions.flatMap((submission) => submission.orders);
  const { invalid, valid } = partitionOrders(scenario, state, submittedOrders);
  const invalidUnitIds = new Set<UnitId>(invalid.map((outcome) => outcome.order.unitId));
  const movingUnitIds = new Set<UnitId>(valid.map((order) => order.unitId));

  // Units without a valid move hold their territory this turn and can block entry (M4).
  const holders = Object.values(state.units).filter((unit) => !movingUnitIds.has(unit.id));
  const movement = valid.map((order) => resolveMove(order, valid, holders));
  const successful = movement.filter((outcome): outcome is SuccessfulMoveOutcome => outcome.kind === "successful-move");
  const moveOutcomes = movement.map((outcome) => disbandIfOriginCaptured(outcome, successful));

  const removedUnitIds = new Set<UnitId>([
    ...invalidUnitIds,
    ...moveOutcomes.flatMap((outcome) => (outcome.kind === "disbanded-move" ? [outcome.order.unitId] : []))
  ]);
  const units = applyUnitMovement(state.units, successful, removedUnitIds);
  const { cityControl, control } = deriveControl(scenario, state, units, successful);
  const finalState: GameState = { cityControl, control, turnNumber: state.turnNumber, units };
  const progress = victoryProgress(scenario, finalState);
  const victory = evaluateVictory(progress, scenario.victory.tieBreak);

  return {
    cityChanges: diffCities(state.cityControl, cityControl),
    controlChanges: diffControl(scenario, state.control, control),
    finalState,
    outcomes: [
      ...moveOutcomes,
      ...invalid,
      ...holdOutcomes(scenario, state, submissions)
    ],
    progress,
    submittedOrders,
    ...(victory === undefined ? {} : { victory })
  };
}

/** M1, M9: orders validate against the start-of-turn state; every order of a unit ordered twice is invalid. */
function partitionOrders(
  scenario: Scenario,
  state: GameState,
  orders: readonly MoveOrder[]
): { readonly invalid: readonly InvalidOrderOutcome[]; readonly valid: readonly MoveOrder[] } {
  const orderCount = new Map<UnitId, number>();
  for (const order of orders) orderCount.set(order.unitId, (orderCount.get(order.unitId) ?? 0) + 1);

  const invalid: InvalidOrderOutcome[] = [];
  const valid: MoveOrder[] = [];
  for (const order of orders) {
    if ((orderCount.get(order.unitId) ?? 0) > 1) {
      invalid.push({ kind: "invalid-order", order, reason: "A unit can receive only one order per turn." });
      continue;
    }
    const validation = validateMoveOrder(scenario, state, order);
    if (validation.ok) {
      valid.push(order);
    } else {
      invalid.push({ kind: "invalid-order", order, reason: validation.reason });
    }
  }
  return { invalid, valid };
}

/** M3, M4, M5, and the OD-7 reinforcement exception. */
function resolveMove(
  order: MoveOrder,
  validMoves: readonly MoveOrder[],
  holders: readonly UnitState[]
): SuccessfulMoveOutcome | BouncedMoveOutcome {
  const cause = bounceCause(order, validMoves, holders);
  return cause === undefined
    ? { kind: "successful-move", order }
    : { cause, kind: "bounced-move", order };
}

function bounceCause(
  order: MoveOrder,
  validMoves: readonly MoveOrder[],
  holders: readonly UnitState[]
): BounceCause | undefined {
  const opposingIncoming = uniqueFactions(
    validMoves.filter((other) => other.to === order.to && other.factionId !== order.factionId)
  );
  if (opposingIncoming.length > 0) {
    return { kind: "standoff", opposingFactionIds: opposingIncoming };
  }

  const headOn = uniqueFactions(
    validMoves.filter(
      (other) => other.factionId !== order.factionId && other.from === order.to && other.to === order.from
    )
  );
  if (headOn.length > 0) {
    return { kind: "head-on", opposingFactionIds: headOn };
  }

  const holdingHere = holders.filter((unit) => unit.territoryId === order.to);
  const hostileHolders = uniqueFactions(holdingHere.filter((unit) => unit.factionId !== order.factionId));
  const reinforcing = holdingHere.some((unit) => unit.factionId === order.factionId);
  if (hostileHolders.length > 0 && !reinforcing) {
    return { holdingFactionIds: hostileHolders, kind: "held" };
  }
  return undefined;
}

/** M8: a bounced unit is lost if a unit of another faction entered its origin. */
function disbandIfOriginCaptured(
  outcome: SuccessfulMoveOutcome | BouncedMoveOutcome,
  successful: readonly SuccessfulMoveOutcome[]
): SuccessfulMoveOutcome | BouncedMoveOutcome | DisbandedMoveOutcome {
  if (outcome.kind === "successful-move") {
    return outcome;
  }
  const capture = successful.find(
    (move) => move.order.to === outcome.order.from && move.order.factionId !== outcome.order.factionId
  );
  return capture === undefined
    ? outcome
    : {
        capturedByFactionId: capture.order.factionId,
        cause: outcome.cause,
        kind: "disbanded-move",
        order: outcome.order
      };
}

function applyUnitMovement(
  startUnits: GameState["units"],
  successful: readonly SuccessfulMoveOutcome[],
  removedUnitIds: ReadonlySet<UnitId>
): GameState["units"] {
  const destinations = new Map<UnitId, TerritoryId>(successful.map((move) => [move.order.unitId, move.order.to]));
  const units: Record<UnitId, UnitState> = {};

  for (const unit of Object.values(startUnits)) {
    if (removedUnitIds.has(unit.id)) {
      continue;
    }
    const destination = destinations.get(unit.id);
    units[unit.id] = destination === undefined
      ? unit
      : { factionId: unit.factionId, id: unit.id, territoryId: destination };
  }
  return units;
}

/**
 * M6, M7: a territory changes hands only when exactly one faction has units there after
 * resolution and either the set of factions present changed this turn or that faction
 * entered it. Holding never changes control, which preserves the historical start.
 */
function deriveControl(
  scenario: Scenario,
  start: GameState,
  finalUnits: GameState["units"],
  successful: readonly SuccessfulMoveOutcome[]
): Pick<GameState, "cityControl" | "control"> {
  const control: Record<TerritoryId, TerritoryControl> = { ...start.control };
  const cityControl: Record<CityId, FactionId> = { ...start.cityControl };
  const before = presence(start.units);
  const after = presence(finalUnits);

  for (const territory of scenario.territories) {
    const present = after.get(territory.id) ?? new Set<FactionId>();
    const [onlyFaction] = present;
    if (present.size !== 1 || onlyFaction === undefined) {
      continue;
    }
    const changed = !sameSet(before.get(territory.id) ?? new Set(), present);
    const entered = successful.some(
      (move) => move.order.to === territory.id && move.order.factionId === onlyFaction
    );
    if (changed || entered) {
      control[territory.id] = { factionId: onlyFaction, kind: "controlled" };
      for (const city of citiesIn(scenario, territory.id)) {
        cityControl[city.id] = onlyFaction;
      }
    }
  }
  return { cityControl, control };
}

function holdOutcomes(
  scenario: Scenario,
  state: GameState,
  submissions: readonly PlayerSubmission[]
): readonly NoMoveOutcome[] {
  return scenario.factions.flatMap((faction): NoMoveOutcome[] => {
    const submission = submissions.find((candidate) => candidate.factionId === faction.id);
    if (submission !== undefined && submission.orders.length > 0) {
      return [];
    }
    const units = Object.values(state.units).filter((unit) => unit.factionId === faction.id);
    return units.length === 0
      ? [{ factionId: faction.id, kind: "no-move" }]
      : units.map((unit) => ({ factionId: faction.id, kind: "no-move", unitId: unit.id }));
  });
}

function diffControl(
  scenario: Scenario,
  before: GameState["control"],
  after: GameState["control"]
): readonly ControlChange[] {
  return scenario.territories.flatMap((territory): ControlChange[] => {
    const previous = before[territory.id];
    const next = after[territory.id];
    return previous === undefined || next === undefined || sameControl(previous, next)
      ? []
      : [{ after: next, before: previous, territoryId: territory.id }];
  });
}

function diffCities(before: GameState["cityControl"], after: GameState["cityControl"]): readonly CityChange[] {
  return (Object.entries(after) as [CityId, FactionId][]).flatMap(([cityId, controller]): CityChange[] =>
    before[cityId] === controller ? [] : [{ after: controller, before: before[cityId], cityId }]
  );
}

function presence(units: GameState["units"]): ReadonlyMap<TerritoryId, ReadonlySet<FactionId>> {
  const result = new Map<TerritoryId, Set<FactionId>>();
  for (const unit of Object.values(units)) {
    const factions = result.get(unit.territoryId) ?? new Set<FactionId>();
    factions.add(unit.factionId);
    result.set(unit.territoryId, factions);
  }
  return result;
}

function uniqueFactions(items: readonly { readonly factionId: FactionId }[]): readonly FactionId[] {
  return [...new Set(items.map((item) => item.factionId))];
}

function sameSet<Value>(left: ReadonlySet<Value>, right: ReadonlySet<Value>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function sameControl(left: TerritoryControl, right: TerritoryControl): boolean {
  if (left.kind === "controlled" && right.kind === "controlled") {
    return left.factionId === right.factionId;
  }
  if (left.kind === "contested" && right.kind === "contested") {
    return sameSet(new Set(left.factionIds), new Set(right.factionIds));
  }
  return false;
}

export function initialGameState(scenario: Scenario): GameState {
  const control: Record<TerritoryId, TerritoryControl> = {};
  for (const territory of scenario.territories) {
    control[territory.id] = territory.initialControl;
  }
  const cityControl: Record<CityId, FactionId> = {};
  for (const city of scenario.cities) {
    if (city.initialController !== undefined) {
      cityControl[city.id] = city.initialController;
    }
  }
  const units: Record<UnitId, UnitState> = {};
  for (const unit of scenario.units) {
    units[unit.id] = {
      factionId: unit.factionId,
      id: unit.id,
      territoryId: unit.territoryId,
      ...(unit.cityId === undefined ? {} : { cityId: unit.cityId })
    };
  }
  return { cityControl, control, turnNumber: 1, units };
}
