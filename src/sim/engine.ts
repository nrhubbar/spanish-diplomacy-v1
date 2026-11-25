/**
 * The harness's only door into the game. Every import from `src/main/**` lives here, so a
 * change to the engine, the computer player or the scenario folder is repointed in one file.
 */
import { unitKindIn, unitTypeIn } from "../main/engine/air/pieces";
import { holdings, inPoints } from "../main/engine/carry";
import { incomeFor } from "../main/engine/economy/income";
import { upkeepBill, upkeepLines } from "../main/engine/economy/upkeep";
import { initialGameState } from "../main/engine/resolution";
import { canFight } from "../main/engine/units/fighting";
import type { BuildProject, FactionId, GameState, Order, Resources, Scenario, ScenarioId, TurnOutcome, TurnResolutionResult, UnitId } from "../main/engine/types";
import { isMoveOrder } from "../main/engine/types/orders";
import { linkWorks } from "../main/engine/types/state";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry, normalizeSourcePath, type PackageSources } from "../main/scenarios/registry";
import { applyCommand, createGame } from "../main/game/service";
import type { GameId, PlayerId } from "../main/game/types";

export type { FactionId, GameState, Order, PackageSources, Resources, Scenario, TurnOutcome, TurnResolutionResult, UnitId };

/**
 * Where scenario packages come from. The app's own glob of shipped packages, so a moved
 * scenario folder is followed without touching the harness.
 */
export function scenarioSources(): readonly PackageSources[] {
  return [builtInSources];
}

/**
 * The scenario a run plays when none is named: the only playable package in `sources`. With
 * none, or more than one, the caller must name one. The harness holds no scenario ids.
 */
export function defaultScenarioId(sources: readonly PackageSources[]): string {
  const ids = createScenarioRegistry(...sources).list().map((summary) => summary.id as string);
  const [only] = ids;
  if (ids.length !== 1 || only === undefined) {
    throw new Error(`Name a scenario with --scenario; the playable ones are: ${ids.length === 0 ? "none" : ids.join(", ")}.`);
  }
  return only;
}

/** A raw scenario document transformed before validation, for example by a variant patch. */
export type DocumentTransform = (document: unknown) => unknown;

function documentId(document: unknown): unknown {
  return typeof document === "object" && document !== null && "id" in document ? document.id : undefined;
}

/**
 * Loads one scenario through the real loader. A transform rewrites its raw `scenario.json`
 * first, so a patched scenario is validated and indexed exactly as a shipped one is.
 */
export function loadScenario(sources: readonly PackageSources[], scenarioId: string, transform?: DocumentTransform): Scenario {
  const matches = sources.flatMap((source) =>
    Object.entries(source.scenarios).filter(([, document]) => documentId(document) === scenarioId).map(([path]) => normalizeSourcePath(path))
  );
  const path = matches[0];
  if (path === undefined) throw new Error(`Unknown scenario "${scenarioId}".`);
  const rewritten = sources.map((source) => ({
    ...source,
    scenarios: Object.fromEntries(Object.entries(source.scenarios).flatMap(([key, document]) => {
      if (normalizeSourcePath(key) !== path) return [[key, document]];
      return [[key, transform === undefined ? document : transform(structuredClone(document))]];
    }))
  }));
  const registry = createScenarioRegistry(...rewritten);
  const problem = registry.problems.find((error) => error.message.includes(path));
  if (problem !== undefined) throw problem;
  return registry.require(scenarioId as ScenarioId).scenario;
}

/** One resolved turn, as the harness reads it. */
export interface PlayedTurn {
  /** The board before the turn resolved; units destroyed in it are still here. */
  readonly before: GameState;
  readonly result: TurnResolutionResult;
  readonly turn: number;
}

/**
 * Plays one all-computer game through the real game service: the same seeds per
 * faction and turn, the same history the computer player reads, and the same validation as a
 * game in the app. Calls `onTurn` after each turn and stops at a victory or the turn limit.
 */
export function playComputerGame(scenario: Scenario, seed: number, turnLimit: number, onTurn: (turn: PlayedTurn) => void): void {
  const seats = Object.fromEntries(scenario.factions.map((faction) => [faction.id, { kind: "computer" as const }]));
  let before = initialGameState(scenario);
  let record = createGame(scenario, { gameId: "sim" as GameId, rollScheme: "numeric-1", scenarioVersion: "", seats, seed: String(seed), seedChosen: true, timerMinutes: 0 }, 0);
  for (let turn = 1; turn <= turnLimit; turn += 1) {
    const next = applyCommand(scenario, record, "sim" as PlayerId, { kind: "advance", turnNumber: record.state.turnNumber }, 0);
    if (!next.ok || next.record.report === undefined) throw new Error("The turn did not resolve.");
    record = next.record;
    const { report } = next.record;
    onTurn({ before, result: report, turn });
    if (record.status === "ended") return;
    before = report.finalState;
  }
}

/** The scenario's territory ids, from its index: the level that units stand in and S2 and S3 judge. */
export function territoryIdsOf(scenario: Scenario): ReadonlySet<string> {
  return new Set<string>(scenario.index.territories.keys());
}

/** Each faction's objective territories, which it must not walk away from (S3). Every id must be a territory. */
export function objectivesOf(scenario: Scenario): ReadonlyMap<string, ReadonlySet<string>> {
  const territories = territoryIdsOf(scenario);
  return new Map(scenario.factions.map((faction) => {
    const unknown = faction.objectiveTerritoryIds.filter((id) => !territories.has(id));
    if (unknown.length > 0) throw new Error(`Faction "${faction.id}" has objectives that are not territories: ${unknown.join(", ")}.`);
    return [faction.id, new Set<string>(faction.objectiveTerritoryIds)];
  }));
}

/**
 * Whether a unit can hold ground, for S3. Aircraft cannot (D17): they never fight a ground battle
 * and rebase or die when their airfield's territory falls, so one parked in an objective does not
 * hold it. Nor can a unit that cannot fight (D27.1, `canFight`): a lone general or truck neither
 * takes nor keeps ground, so it does not hold an objective either.
 */
export function holdsGround(scenario: Scenario, state: PlayedTurn["before"], unitId: string): boolean {
  return unitKindIn(scenario, state.raised, unitId as UnitId) !== "air" && canFight(scenario, state.raised, unitId as UnitId);
}

/** Who holds a territory in a state, as a comparable key. Territory level only: never a sub-territory or a city. */
export function territoryControlKey(state: PlayedTurn["before"], territoryId: string): string {
  return JSON.stringify(state.control[territoryId as keyof typeof state.control] ?? null);
}

/** A battle's odds column as a stable key; the d20 rules may name columns differently. */
export function battleColumn(outcome: Extract<TurnOutcome, { kind: "battle" }>): string {
  return String(outcome.column);
}

/** A submitted order as a short route key, `from>to`. Order kinds beyond moves will prefix their kind. */
export function orderRoute(order: TurnResolutionResult["submittedOrders"][number]): string {
  return isMoveOrder(order) ? `${order.from}>${order.to}` : order.kind;
}

/** A battle's result as a stable key: its grade. */
export function battleResultKey(outcome: Extract<TurnOutcome, { kind: "battle" }>): string {
  return outcome.grade;
}

/** The id of a unit's type, whether it came with the scenario, was raised in play or is a replacement general. */
export function unitTypeIdOf(scenario: Scenario, state: GameState, unitId: UnitId): string {
  const type = unitTypeIn(scenario, state.raised, unitId);
  if (type === undefined) throw new Error(`Unit "${unitId}" has no type; re-check the harness's inventory reading.`);
  return type.id;
}

/** What a build project makes, as a key that no other project shares: `building:barracks`, `link:new-rail`. */
export function projectKey(project: BuildProject): string {
  switch (project.kind) {
    case "building": return `building:${project.buildingId}`;
    case "development": return `development:${project.developmentId}`;
    case "improvement": return `improvement:${project.improvement}`;
    case "link": return `link:${project.work}`;
  }
}

/** Everything that can stand in a sub-territory, in scenario order, as project keys. */
export function siteKeys(scenario: Scenario): readonly string[] {
  return [
    ...scenario.buildings.map((building) => projectKey({ buildingId: building.id, kind: "building" })),
    ...scenario.development.map((track) => projectKey({ developmentId: track.id, kind: "development" })),
    ...(["port", "rail"] as const).map((improvement) => projectKey({ improvement, kind: "improvement" }))
  ];
}

/** The works a link may take, as project keys. They stand on a link, which no side holds. */
export function linkKeys(): readonly string[] {
  return linkWorks.map((work) => `link:${work}`);
}

/** What a faction really has, in points: its whole points less its carry. */
export function heldPoints(state: GameState, factionId: FactionId): Resources {
  return inPoints(holdings(state, factionId));
}

/** The income a board pays a faction, before and after raid cuts, by the engine's own function. */
export function boardIncome(scenario: Scenario, state: GameState, factionId: FactionId): { readonly gross: Resources; readonly paid: Resources } {
  return incomeFor(scenario, state, factionId);
}

/**
 * The upkeep of the units standing on a board, in points, by the engine's own function. Training
 * is left out: `upkeepLines` also counts what will finish next turn, which is next turn's bill.
 */
export function boardUpkeep(scenario: Scenario, state: GameState, factionId: FactionId): Resources {
  return inPoints(upkeepBill(upkeepLines(scenario, { ...state, training: [] }, factionId, [])));
}
