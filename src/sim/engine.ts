/**
 * The harness's only door into the game. Every import from `src/main/**` lives here, so a
 * change to the engine, the computer player or the scenario folder is repointed in one file.
 */
import { initialGameState } from "../main/engine/resolution";
import type { FactionId, Scenario, ScenarioId, TurnOutcome, TurnResolutionResult, UnitId } from "../main/engine/types";
import { builtInSources } from "../main/scenarios/builtInSources";
import { createScenarioRegistry, normalizeSourcePath, type PackageSources } from "../main/scenarios/registry";
import { advance, nextTurn } from "../main/state/coordinator";
import type { GameRecord, Session } from "../main/state/session";

export type { FactionId, PackageSources, Scenario, TurnOutcome, TurnResolutionResult, UnitId };

/**
 * Where scenario packages come from. The app's own glob of shipped packages, so a moved
 * scenario folder is followed without touching the harness.
 */
export function scenarioSources(): readonly PackageSources[] {
  return [builtInSources];
}

/**
 * H6 seam: the JSON Pointer of the computer player's blunder rate in `scenario.json`. It is
 * owned by `m3r1-contract` and expected at `/ai/blunderRate`; the integrator sets it here when
 * that lands. While it is undefined, blunders are "pending": both settings play alike.
 */
export const blunderRatePointer: string | undefined = undefined;

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
  readonly before: GameRecord["state"];
  readonly result: TurnResolutionResult;
  readonly turn: number;
}

/**
 * Plays one all-computer game through the real submission coordinator: the same seeds per
 * faction and turn, the same history the computer player reads, and the same validation as a
 * game in the app. Calls `onTurn` after each turn and stops at a victory or the turn limit.
 */
export function playComputerGame(scenario: Scenario, seed: number, turnLimit: number, onTurn: (turn: PlayedTurn) => void): void {
  const assignments = Object.fromEntries(scenario.factions.map((faction) => [faction.id, "computer" as const]));
  let before: GameRecord = { assignments, history: [], locked: {}, scenarioId: scenario.id, seed, state: initialGameState(scenario) };
  let session: Session = advance(scenario, before);
  for (let turn = 1; turn <= turnLimit; turn += 1) {
    if (session.phase !== "resolution" && session.phase !== "game-over") throw new Error(`Unexpected phase "${session.phase}".`);
    const { game, result } = session;
    onTurn({ before: before.state, result, turn });
    if (session.phase === "game-over" || turn === turnLimit) return;
    before = game;
    session = nextTurn(scenario, game, result.outcomes);
  }
}

/** Each faction's objective territories, which it must not walk away from (S3). */
export function objectivesOf(scenario: Scenario): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(scenario.factions.map((faction) => [faction.id as string, new Set<string>(faction.objectiveTerritoryIds)]));
}

/** A battle's odds column as a stable key; the d20 rules may name columns differently. */
export function battleColumn(outcome: Extract<TurnOutcome, { kind: "battle" }>): string {
  return String(outcome.column);
}

/** A submitted order as a short route key, `from>to`. Order kinds beyond moves will prefix their kind. */
export function orderRoute(order: TurnResolutionResult["submittedOrders"][number]): string {
  return `${order.from}>${order.to}`;
}
