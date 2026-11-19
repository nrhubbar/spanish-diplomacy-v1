import { battleOutcome, type PendingBattle } from "./battle";
import { placeAt, removeArmies, replaceArmies, requireArmy } from "./board";
import { deriveControl, diffCities, diffControl } from "./control";
import { type BattleDice, seededBattleDice } from "./dice";
import { resolveFront } from "./front";
import { resolveMeetings } from "./meeting";
import { classifyMoves, partitionOrders } from "./orders";
import { recoverMorale } from "./morale";
import { type Settled, settleDepartures } from "./retreat";
import { resolveStanding } from "./standing";
import type {
  BattleOutcome,
  BounceCause,
  CityId,
  FactionId,
  GameState,
  NoMoveOutcome,
  PlayerSubmission,
  Retreat,
  Scenario,
  TerritoryControl,
  TerritoryId,
  TurnOutcome,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "./types";
import { evaluateVictory, victoryProgress } from "./victory";
import { initialSystems } from "./initialSystems";
import { digIn } from "./works";

/**
 * Resolves one turn under the `m2-strength` ruleset, in the order of M26. Rule ids refer to
 * `project/specs/scenario-package.md`. Pure: the same scenario, state, orders, and seed always
 * give the same result. `dice` stands in for the seeded battle streams in tests only.
 *
 * Every valid move is reported once: as a reinforcement, an unopposed move, a bounce without a
 * battle, or through the battles its army fought in (a meeting winner may fight twice).
 */
export function resolveTurn(
  scenario: Scenario,
  state: GameState,
  submissions: readonly PlayerSubmission[],
  seed: number,
  dice: BattleDice = seededBattleDice(seed, state.turnNumber)
): TurnResolutionResult {
  const submittedOrders = submissions.flatMap((submission) => submission.orders);
  // 1. Orders (M1, M2, M9, M23).
  const { invalid, rejected, valid } = partitionOrders(scenario, state, submittedOrders);
  const origins = new Map(valid.map((order) => [order.unitId, order.from]));
  let armies = removeArmies(state.units, invalid.map((outcome) => outcome.order.unitId));
  const { advances, reinforcements } = classifyMoves(state.control, armies, valid);

  // 2. Reinforcements arrive (M11).
  armies = replaceArmies(armies, reinforcements.map((order) => placeAt(requireArmy(armies, order.unitId), order.to)));
  // 3. Head-on meeting battles (M20).
  const meetings = resolveMeetings(scenario, armies, advances, dice);
  // 4-5. Battles, results, and occupation (M16-M19).
  const front = resolveFront(scenario, {
    armies: meetings.armies,
    continuing: meetings.continuing,
    dice,
    firstIndex: meetings.battles.length,
    origins,
    start: state
  });
  // 6. Returns, retreats, and surrender (M21).
  const departures = settleDepartures(scenario, state, front.armies, front.leaving);
  // 7. Standing battles in shared territories (M27), and their retreats.
  const standing = resolveStanding(scenario, state, departures.armies, dice, meetings.battles.length + front.battles.length);
  const standingDepartures = settleDepartures(scenario, state, standing.armies, standing.leaving);
  armies = standingDepartures.armies;

  const settled = [...departures.settled, ...standingDepartures.settled];
  const pending = [...front.battles, ...standing.battles];
  const battles = [...meetings.battles, ...pending.map((battle) => withDepartures(battle, settled))];

  // 8. Control (M6, M7).
  const { cityControl, control } = deriveControl(scenario, state, armies);
  // 9. Morale recovery (M23) and digging in (M22).
  const retreated = settled.flatMap((entry) => (entry.kind === "retreated" ? [entry.leaving.unitId] : []));
  const demoralized = battles.flatMap((battle) => battle.demoralizedUnitIds);
  const morale = recoverMorale(scenario, armies, new Set([...origins.keys(), ...retreated, ...demoralized]));
  const foughtIn = new Set(pending.map((battle) => battle.site.territoryId));
  const finalState: GameState = {
    ...state,
    cityControl,
    control,
    fortification: digIn(scenario, state, { armies: morale.armies, control }, foughtIn, new Set(origins.keys())),
    turnNumber: state.turnNumber,
    units: morale.armies
  };
  // 10. Victory (M10).
  const progress = victoryProgress(scenario, finalState);
  const victory = evaluateVictory(progress, scenario.victory.tieBreak);

  const moveOutcomes = new Map<UnitId, TurnOutcome>([
    ...reinforcements.map((order): [UnitId, TurnOutcome] => [order.unitId, { kind: "reinforcement-arrived", order }]),
    ...meetings.bounced.map((outcome): [UnitId, TurnOutcome] => [outcome.order.unitId, outcome]),
    ...front.arrivals.map((outcome): [UnitId, TurnOutcome] => [outcome.order.unitId, outcome]),
    ...settled.flatMap((entry): [UnitId, TurnOutcome][] => {
      const outcome = standoffOutcome(entry);
      return outcome === undefined ? [] : [[entry.leaving.unitId, outcome]];
    })
  ]);
  return {
    cityChanges: diffCities(scenario, state.cityControl, cityControl),
    controlChanges: diffControl(scenario, state.control, control),
    finalState,
    outcomes: [
      ...valid.flatMap((order) => moveOutcomes.get(order.unitId) ?? []),
      ...battles,
      ...invalid,
      ...rejected,
      ...holdOutcomes(scenario, state, submissions),
      ...morale.recovered
    ],
    progress,
    submittedOrders,
    ...(victory === undefined ? {} : { victory })
  };
}

/** M21: retreats and surrenders are reported in the battle that caused them. */
function withDepartures(pending: PendingBattle, settled: readonly Settled[]): BattleOutcome {
  const mine = settled.filter((entry) => "battleIndex" in entry.leaving.report && entry.leaving.report.battleIndex === pending.battle.index);
  const retreats = mine.flatMap((entry): Retreat[] =>
    entry.kind === "retreated" ? [{ from: entry.leaving.from, to: entry.to, unitId: entry.leaving.unitId }] : []);
  const surrenderedUnitIds = mine.flatMap((entry) => (entry.kind === "surrendered" ? [entry.leaving.unitId] : []));
  return battleOutcome(pending.battle, pending.site, { ...pending.report, retreats, surrenderedUnitIds });
}

/** M19, M21: an entry tie bounces without a battle; the move reports where its army ended. */
function standoffOutcome(entry: Settled): TurnOutcome | undefined {
  const { report } = entry.leaving;
  if (!("order" in report)) {
    return undefined;
  }
  const { order } = report;
  const cause: BounceCause = { kind: "standoff", opposingFactionIds: report.opposingFactionIds };
  switch (entry.kind) {
    case "home":
      return { cause, kind: "bounced-move", order };
    case "retreated":
      return { cause, kind: "bounced-move", order, retreatedTo: entry.to };
    case "surrendered":
      return { capturedByFactionId: requireTaker(entry.takenBy), cause, kind: "disbanded-move", order };
  }
}

function requireTaker(factionId: FactionId | undefined): FactionId {
  if (factionId === undefined) {
    throw new Error("Invariant violated: a returning army surrendered without its origin being taken.");
  }
  return factionId;
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
      fatigue: 0,
      id: unit.id,
      morale: { demoralized: false, quietTurns: 0 },
      strength: unit.strength,
      territoryId: unit.territoryId,
      ...(unit.cityId === undefined ? {} : { cityId: unit.cityId })
    };
  }
  return { ...initialSystems(scenario), cityControl, control, fortification: {}, turnNumber: 1, units };
}
