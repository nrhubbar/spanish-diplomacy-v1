import type { BattleDice } from "../main/engine/dice";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import {
  type BattleOutcome,
  type CityId,
  type FactionId,
  type FactionModifier,
  type GameState,
  type MoveOrder,
  type Order,
  type PlayerSubmission,
  type Refusal,
  type Scenario,
  type ScenarioId,
  type TerritoryId,
  type TurnResolutionResult,
  type UnitDefinition,
  type UnitId,
  type UnitState,
  type UnitTypeDefinition,
  type UnitTypeId,
  type ValidationResult
} from "../main/engine/types";
import { builtInModuleRegistry } from "../main/engine/modules";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry, type ScenarioRegistry } from "../main/scenarios/registry";
import { createLocalHost, type LocalHost } from "../main/game/localHost";
import { openingClocks } from "../main/game/clock";
import { playerView } from "../main/game/projection";
import { applyCommand, createGame } from "../main/game/service";
import type { GameCommand, GameId, GameRecord, PlayerId, PlayerView, Seat } from "../main/game/types";
import { type Feedback, feedbackText } from "../main/presentation/feedback";
import { refusalText } from "../main/presentation/refusals";
import { clickMapTerritory } from "../main/state/gameSlice";
import { pushView } from "../main/state/paneSlice";
import { type InGameSession, isInGame } from "../main/state/session";
import { sessionFromView } from "../main/state/sessionView";
import { createAppStore } from "../main/state/store";
import { fixtureSources } from "./fixtures/scenarios/fixtureSources";

export const spainId = "spanish-civil-war-1936" as ScenarioId;
export const tinyId = "tiny-front" as ScenarioId;

let sharedRegistry: ScenarioRegistry | undefined;
let shipped: ScenarioRegistry | undefined;

/** Registry with every shipped package, as shipped, plus test fixtures. */
export function shippedRegistry(): ScenarioRegistry {
  shipped ??= createScenarioRegistry(builtInSources, fixtureSources);
  return shipped;
}

/**
 * Spain without its starting aircraft and generals (m3r1-air-generals): the Milestone 2 rule,
 * report and UI tests count Spain's ground armies, so they keep the Milestone 2 board.
 */
export function groundForcesOnly(scenario: Scenario): Scenario {
  const ground = (unit: UnitDefinition): boolean => scenario.index.unitTypes.get(unit.type)?.kind === "ground";
  const units = scenario.units.filter(ground);
  return { ...scenario, index: { ...scenario.index, units: new Map(units.map((unit) => [unit.id, unit])) }, units };
}

/** Registry with every shipped package plus test fixtures; Spain has only its ground forces (`groundForcesOnly`). */
export function testRegistry(): ScenarioRegistry {
  if (sharedRegistry === undefined) {
    const registry = shippedRegistry();
    const pinned = { ...registry.require(spainId), scenario: groundForcesOnly(registry.require(spainId).scenario) };
    sharedRegistry = { ...registry, list: () => registry.list(), loadAssets: (id) => registry.loadAssets(id), peekAssets: (id) => registry.peekAssets(id), require: (id) => (id === spainId ? pinned : registry.require(id)) };
  }
  return sharedRegistry;
}

/** Spain with its ground forces only. */
export function spain(): Scenario {
  return testRegistry().require(spainId).scenario;
}

/** Spain as shipped, with its starting aircraft and generals. */
export function spainWithAir(): Scenario {
  return shippedRegistry().require(spainId).scenario;
}

let unpartitioned: Scenario | undefined;

/** A faction modifier on the Spanish board for the M24 tests, whatever the shipped data holds. */
const popularResistance: FactionModifier = { attack: 0, defence: 3, factionId: "republic" as FactionId, id: "popular-resistance", name: "Popular resistance", when: "holds-controlled-city" };

/**
 * Spain with the `none` partition module: control follows armies (M6, M7) and nothing is
 * contested-ground only. For tests of the Milestone 2 rules (M6-M27) on the Spanish board,
 * which the `provinces` module replaces (P2-P7, C1). It fights on the tiny front's plain d20 table
 * (a die of 3n-1 reads row n), so these tests don't move with Spain's numbers.
 */
export function spainM2(): Scenario {
  if (unpartitioned !== undefined) return unpartitioned;
  const scenario = spain();
  const none = builtInModuleRegistry.require("partition", "none");
  const { d20 } = tiny();
  unpartitioned = {
    ...scenario,
    d20: { ...d20, factionModifiers: [popularResistance] },
    modules: scenario.modules.map((module) => (module.area === "partition" ? none : module)),
    rules: { ...scenario.rules, partition: "none" }
  };
  return unpartitioned;
}

export function tiny(): Scenario {
  return testRegistry().require(tinyId).scenario;
}

export const faction = (id: string): FactionId => id as FactionId;
export const territory = (id: string): TerritoryId => id as TerritoryId;
export const unit = (id: string): UnitId => id as UnitId;
export const city = (id: string): CityId => id as CityId;

export function move(factionId: string, unitId: string, from: string, to: string): MoveOrder {
  return { factionId: faction(factionId), from: territory(from), kind: "move", to: territory(to), unitId: unit(unitId) };
}

/** Strength given to synthetic test armies whose ids are not in the scenario. */
export const syntheticStrength = 100;

export function withUnits(scenario: Scenario, units: readonly (readonly [string, string, string])[]): GameState {
  const base = initialGameState(scenario);
  const record: Record<UnitId, UnitState> = {};
  for (const [id, factionId, territoryId] of units) {
    record[unit(id)] = {
      factionId: faction(factionId),
      fatigue: 0,
      id: unit(id),
      morale: { demoralized: false, quietTurns: 0 },
      strength: scenario.index.units.get(unit(id))?.strength ?? syntheticStrength,
      territoryId: territory(territoryId)
    };
  }
  return { ...base, units: record };
}

/** The army's state, failing the test when it is absent. */
export function armyIn(state: GameState, id: string): UnitState {
  const found = state.units[unit(id)];
  if (found === undefined) throw new Error(`No army "${id}" in this state.`);
  return found;
}

export function testStore(preloadedState?: Parameters<typeof createAppStore>[0]["preloadedState"], registry: ScenarioRegistry = testRegistry()) {
  const client = testHost(registry);
  const session = preloadedState?.game?.session;
  if (session !== undefined && isInGame(session)) client.adopt(recordOf(session, registry.require(session.game.scenarioId).scenario, preloadedState?.timer?.minutes ?? 0), session.phase === "planning" ? session.factionId : undefined);
  return createAppStore({ client, registry, ...(preloadedState === undefined ? {} : { preloadedState }) });
}

/** A map click on a territory as the planning screen makes it (U3): select it, and open Territory Info. */
export function clickTerritoryIn(store: ReturnType<typeof testStore>, id: string): void {
  store.dispatch(clickMapTerritory(territory(id)));
  store.dispatch(pushView({ id: territory(id), kind: "territory" }));
}

/** One army for `battlefield`. Synthetic ids get a definition of the given type and strength. */
export interface ArmySpec {
  readonly demoralized?: boolean;
  readonly faction: string;
  readonly fullStrength?: number;
  readonly id: string;
  readonly strength?: number;
  readonly territory: string;
  readonly type?: string;
}

/**
 * A scenario and state holding exactly the given armies. Armies whose ids the scenario lacks
 * are added to it (type "foot" by default, 100 men at full strength), so they can fight.
 */
export function battlefield(
  base: Scenario,
  armies: readonly ArmySpec[],
  options: { readonly state?: Partial<GameState>; readonly types?: readonly UnitTypeDefinition[] } = {}
): { readonly scenario: Scenario; readonly state: GameState } {
  const unitTypes = [...base.unitTypes, ...(options.types ?? [])];
  const known = new Map(base.units.map((definition) => [definition.id, definition]));
  const definitions: UnitDefinition[] = armies.map((spec) => {
    const existing = known.get(unit(spec.id));
    const fullStrength = spec.fullStrength ?? existing?.fullStrength ?? syntheticStrength;
    return {
      factionId: faction(spec.faction),
      formationKind: "regiment",
      fullStrength,
      id: unit(spec.id),
      name: existing?.name ?? `Army ${spec.id}`,
      sources: [],
      strength: fullStrength,
      territoryId: territory(spec.territory),
      type: (spec.type ?? existing?.type ?? base.unitTypes[0]?.id ?? "foot") as UnitTypeId
    };
  });
  const scenario: Scenario = {
    ...base,
    index: {
      ...base.index,
      unitTypes: new Map(unitTypes.map((type) => [type.id, type])),
      units: new Map([...base.units, ...definitions].map((definition) => [definition.id, definition]))
    },
    unitTypes,
    units: [...base.units.filter((definition) => !definitions.some((added) => added.id === definition.id)), ...definitions]
  };
  const start = initialGameState(base);
  const units: Record<UnitId, UnitState> = {};
  for (const spec of armies) {
    const fullStrength = spec.fullStrength ?? known.get(unit(spec.id))?.fullStrength ?? syntheticStrength;
    units[unit(spec.id)] = {
      factionId: faction(spec.faction),
      fatigue: 0,
      id: unit(spec.id),
      morale: { demoralized: spec.demoralized ?? false, quietTurns: 0 },
      strength: spec.strength ?? fullStrength,
      territoryId: territory(spec.territory)
    };
  }
  return { scenario, state: { ...start, units, ...options.state } };
}

export const unitType = (id: string, attack: number, defence: number): UnitTypeDefinition =>
  ({ attack, defence, effects: [], id: id as UnitTypeId, kind: "ground", name: id, orders: ["move"], upkeep: {} });

/**
 * Loaded d20s: battle `i` rolls `faces[i]`. Draws after the die (standing-battle tie-breaks)
 * return `rest[i]` when given, else 0, which picks the first tied faction.
 */
export function loadedDice(faces: readonly number[], rest: readonly number[] = []): BattleDice {
  return (index) => {
    const face = faces[index];
    if (face === undefined) throw new Error(`No loaded face for battle ${String(index)}.`);
    let draws = 0;
    return () => {
      draws += 1;
      return draws === 1 ? (face - 0.5) / 20 : rest[index] ?? 0;
    };
  };
}

/** One submission per faction, in first-seen order, so tests can list orders flat. */
export function submissionsOf(orders: readonly MoveOrder[]): readonly PlayerSubmission[] {
  const byFaction = new Map<string, MoveOrder[]>();
  for (const order of orders) byFaction.set(order.factionId, [...(byFaction.get(order.factionId) ?? []), order]);
  return [...byFaction].map(([factionId, factionOrders]) => ({ factionId: faction(factionId), orders: factionOrders }));
}

/** Resolves flat orders with loaded dice (or seed 1 when none are given). */
export function play(scenario: Scenario, state: GameState, orders: readonly MoveOrder[], dice?: BattleDice): TurnResolutionResult {
  return resolveTurn(scenario, state, submissionsOf(orders), 1, dice);
}

export function battlesOf(result: TurnResolutionResult): readonly BattleOutcome[] {
  return result.outcomes.filter((outcome): outcome is BattleOutcome => outcome.kind === "battle");
}

/** A scenario whose units cost nothing a turn (D1), for tests that count what orders and income alone do to a treasury. */
export function withoutUpkeep(scenario: Scenario): Scenario {
  return { ...scenario, unitTypes: scenario.unitTypes.map((type) => ({ ...type, upkeep: {} })) };
}

/** The id test games carry. */
export const testGame = "test-game" as GameId;
export const testPlayer = "this-device" as PlayerId;

/** An in-process host on the numeric dice, so a test's numeric seed plays the same game every time. */
export function testHost(registry: ScenarioRegistry = testRegistry()): LocalHost {
  return createLocalHost({ randomSeed: () => "1", rollScheme: "numeric-1", scenario: (id) => registry.require(id) });
}

/**
 * A record of this session's game: for a screen drawn mid-game and then played on. Its history is
 * the session's own, for every viewer; a test of who saw what gives `turnRecord`s instead.
 */
export function recordOf(session: InGameSession, scenario: Scenario, timerMinutes = 0, seed = "1"): GameRecord {
  const { game } = session;
  const planner = "factionId" in session ? session.factionId : undefined;
  const seats = Object.fromEntries(scenario.factions.map((entry): [FactionId, Seat] =>
    // Whoever is planning has the seat, however little of the setup a test gives.
    [entry.id, entry.id !== planner && (game.assignments[entry.id] ?? "computer") === "computer" ? { kind: "computer" } : { kind: "human", playerId: testPlayer }]));
  const fresh = createGame(scenario, { gameId: game.gameId, rollScheme: "numeric-1", scenarioVersion: "test", seats, seed, seedChosen: true, timerMinutes }, Date.now());
  return {
    ...fresh,
    clocks: openingClocks({ seats, timerMinutes }, game.state.turnNumber, Date.now()),
    orders: Object.fromEntries(scenario.factions.map((entry) => [entry.id, { ended: seats[entry.id]?.kind === "computer" || game.ready.includes(entry.id), orders: [], revision: 0 }])),
    state: game.state,
    turns: game.history.map((turn) => ({ outcomes: turn.outcomes, seen: { byFaction: {}, shared: turn.outcomes.map((_outcome, index) => index) }, turnNumber: turn.turnNumber }))
  };
}

/** What the host sends the player at the screen of a session that holds everything, and the session drawn from it. */
export function projected<S extends InGameSession>(scenario: Scenario, session: S, record: Partial<GameRecord> = {}): { readonly session: S; readonly view: PlayerView } {
  const full: GameRecord = {
    ...recordOf(session, scenario),
    ...("result" in session ? { report: session.result } : {}),
    ...(session.phase === "game-over" ? { status: "ended" as const } : {}),
    ...record
  };
  const view = playerView(scenario, full, testPlayer, session.phase === "planning" ? session.factionId : undefined);
  const drawn = sessionFromView({ session }, view);
  if (drawn.phase !== session.phase) throw new Error(`Projected to ${drawn.phase}, not ${session.phase}.`);
  return { session: drawn as S, view };
}

/** The record after a command, which must be accepted. */
export function commanded(scenario: Scenario, record: GameRecord, command: GameCommand, now = 0): GameRecord {
  const result = applyCommand(scenario, record, testPlayer, command, now);
  if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result.refusal)}`);
  return result.record;
}

/** Ends a faction's turn with these orders. */
export function endedWith(scenario: Scenario, record: GameRecord, factionId: FactionId, orders: readonly Order[]): GameRecord {
  return commanded(scenario, record, { factionId, kind: "end-turn", orders, revision: 1, turnNumber: record.state.turnNumber });
}

/** Saves these orders, then lets the faction's time run out. The game needs a timer. */
export function timedOutWith(scenario: Scenario, record: GameRecord, factionId: FactionId, orders: readonly Order[]): GameRecord {
  const { turnNumber } = record.state;
  const opened = commanded(scenario, record, { factionId, kind: "open", turnNumber });
  const saved = commanded(scenario, opened, { factionId, kind: "save-orders", orders, revision: 1, turnNumber });
  return commanded(scenario, saved, { kind: "expire", turnNumber }, 3_600_000);
}

/** A refusal as the player reads it; undefined for none. */
export function said(scenario: Scenario, refusal: Refusal | undefined): string | undefined {
  return refusal === undefined ? undefined : refusalText(scenario, refusal);
}

/** A verdict as the player reads it: "ok", or the refusal's sentence. */
export function verdictText(scenario: Scenario, verdict: ValidationResult): string {
  return verdict.ok ? "ok" : refusalText(scenario, verdict.refusal);
}

/** What the player is told, in words, if anything. */
export function told(scenario: Scenario, feedback: Feedback | undefined): string | undefined {
  return feedback === undefined ? undefined : feedbackText(scenario, feedback);
}
