import { blunderChancePointer, loadScenario, type PackageSources, type Scenario } from "./engine";
import { type GameLine, playGame } from "./game";
import { applyPatch, type PatchOperation } from "./patch";
import { type Comparison, compare, type RunMetrics, summarize } from "./summary";

/** The harness's default turn limit (tasks 3.3): a game still running after it is a freeze. */
export const defaultTurnLimit = 66;
export const baselineName = "baseline";

export type BlunderMode = "with" | "without" | "both";

/** A named patch over the scenario document (H4). The baseline's patch is empty. Plain data, so it crosses to worker threads. */
export interface Variant {
  readonly description?: string;
  readonly name: string;
  readonly patch: readonly PatchOperation[];
}

/** Everything a run is asked to do. */
export interface RunPlan {
  readonly blunders: BlunderMode;
  readonly scenarioId: string;
  readonly seeds: readonly number[];
  readonly turnLimit: number;
  /** Variants played beside the baseline, on the same seeds. */
  readonly variants: readonly Variant[];
}

/** One variant under one blunder setting; every cell plays every seed. */
export interface Cell {
  readonly blunders: boolean;
  readonly id: string;
  readonly variant: Variant;
}

export interface GameTask {
  readonly cell: number;
  readonly seed: number;
}

/** H6: "scenario" once the blunder chance is in scenario data, "pending" until then. */
export type BlunderControl = "pending" | "scenario";

/**
 * Whether a blunder-chance pointer reaches the game. The seam is passed explicitly (callers
 * pass `blunderChancePointer`), so the "pending" case stays reachable with `undefined`.
 */
export function blunderControl(pointer: string | undefined): BlunderControl {
  return pointer === undefined ? "pending" : "scenario";
}

/**
 * The default blunder setting. While blunders are pending, both settings would play alike,
 * so the harness plays only "without"; once they reach the game, every report carries both.
 */
export function defaultBlunderMode(control: BlunderControl = blunderControl(blunderChancePointer)): BlunderMode {
  return control === "pending" ? "without" : "both";
}

/**
 * The patch that turns blunders off: the scenario's blunder chance set to 0. JSON Patch `add`
 * sets the member whether or not the scenario states it. Empty with blunders on or while pending.
 */
export function blunderPatch(blunders: boolean, pointer: string | undefined): readonly PatchOperation[] {
  return blunders || pointer === undefined ? [] : [{ op: "add", path: pointer, value: 0 }];
}

export function blunderSettings(mode: BlunderMode): readonly boolean[] {
  if (mode === "both") return [true, false];
  return [mode === "with"];
}

export function cellId(variant: string, blunders: boolean): string {
  return `${variant}/${blunders ? "with" : "without"}-blunders`;
}

export function cellsOf(plan: RunPlan): readonly Cell[] {
  const variants: readonly Variant[] = [{ name: baselineName, patch: [] }, ...plan.variants];
  return variants.flatMap((variant) => blunderSettings(plan.blunders).map((blunders) => ({ blunders, id: cellId(variant.name, blunders), variant })));
}

/** Games in cell order, seeds ascending within each cell. */
export function tasksOf(plan: RunPlan): readonly GameTask[] {
  return cellsOf(plan).flatMap((_, cell) => plan.seeds.map((seed) => ({ cell, seed })));
}

/** Builds a cell's scenario: the variant's patch, then the blunder setting's (H6). */
export function cellScenario(sources: readonly PackageSources[], plan: RunPlan, cell: Cell): Scenario {
  const patch = [...cell.variant.patch, ...blunderPatch(cell.blunders, blunderChancePointer)];
  return loadScenario(sources, plan.scenarioId, patch.length === 0 ? undefined : (document) => applyPatch(document, patch));
}

/** Plays tasks, loading each cell's scenario once. Shared by worker threads and the smoke test. */
export function createTaskRunner(sources: readonly PackageSources[], plan: RunPlan): (task: GameTask) => GameLine {
  const cells = cellsOf(plan);
  const scenarios = new Map<number, Scenario>();
  return (task) => {
    const cell = cells[task.cell];
    if (cell === undefined) throw new Error(`Unknown cell ${task.cell}.`);
    let scenario = scenarios.get(task.cell);
    if (scenario === undefined) {
      scenario = cellScenario(sources, plan, cell);
      scenarios.set(task.cell, scenario);
    }
    return playGame({ blunders: cell.blunders, scenario, turnLimit: plan.turnLimit, variant: cell.variant.name }, task.seed);
  };
}

/** Writes seed lists compactly: `1-200`, or `1-5,9`. */
export function seedRanges(seeds: readonly number[]): string {
  const sorted = [...new Set(seeds)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let previous = start;
  for (const seed of [...sorted.slice(1), undefined]) {
    if (seed !== undefined && previous !== undefined && seed === previous + 1) {
      previous = seed;
      continue;
    }
    if (start !== undefined && previous !== undefined) ranges.push(start === previous ? `${start}` : `${start}-${previous}`);
    start = seed;
    previous = seed;
  }
  return ranges.join(",");
}

export interface CellSummary {
  readonly blunders: boolean;
  readonly id: string;
  readonly metrics: RunMetrics;
  readonly variant: string;
  readonly variantDescription?: string;
}

/** `summary.json`. Deterministic: the same plan and seeds always give the same bytes. */
export interface Summary {
  /**
   * H6: whether the blunder setting reaches the game yet. "pending" until the computer
   * player's blunder chance exists in scenario data; until then both settings play alike.
   */
  readonly blunderControl: BlunderControl;
  readonly blunders: BlunderMode;
  readonly cells: readonly CellSummary[];
  /** Every variant against the baseline, and each blunder setting against the other. */
  readonly comparisons: readonly Comparison[];
  readonly factions: readonly string[];
  readonly format: "spanish-diplomacy-sim/1";
  readonly games: number;
  readonly scenarioId: string;
  readonly seeds: string;
  readonly turnLimit: number;
}

export function buildSummary(plan: RunPlan, factionIds: readonly string[], lines: readonly GameLine[]): Summary {
  const cells = cellsOf(plan);
  const linesOf = (cell: Cell) => lines.filter((line) => line.variant === cell.variant.name && line.blunders === cell.blunders);
  const comparisons: Comparison[] = [];
  for (const cell of cells) {
    if (cell.variant.name !== baselineName) {
      const base = cells.find((other) => other.variant.name === baselineName && other.blunders === cell.blunders);
      if (base !== undefined) comparisons.push(compare(cell.id, linesOf(cell), base.id, linesOf(base), factionIds));
    }
  }
  for (const cell of cells) {
    const without = cells.find((other) => other.variant.name === cell.variant.name && !other.blunders);
    if (cell.blunders && without !== undefined) comparisons.push(compare(cell.id, linesOf(cell), without.id, linesOf(without), factionIds));
  }
  return {
    blunderControl: blunderControl(blunderChancePointer),
    blunders: plan.blunders,
    cells: cells.map((cell) => ({
      blunders: cell.blunders,
      id: cell.id,
      metrics: summarize(linesOf(cell), factionIds, plan.turnLimit),
      variant: cell.variant.name,
      ...(cell.variant.description === undefined ? {} : { variantDescription: cell.variant.description })
    })),
    comparisons,
    factions: factionIds,
    format: "spanish-diplomacy-sim/1",
    games: lines.length,
    scenarioId: plan.scenarioId,
    seeds: seedRanges(plan.seeds),
    turnLimit: plan.turnLimit
  };
}

/** Sorts game lines into `games.jsonl` order: cell order, then seed. */
export function orderLines(plan: RunPlan, lines: readonly GameLine[]): readonly GameLine[] {
  const order = new Map(cellsOf(plan).map((cell, index) => [cell.id, index]));
  const rank = (line: GameLine) => order.get(cellId(line.variant, line.blunders)) ?? order.size;
  return [...lines].sort((a, b) => rank(a) - rank(b) || a.seed - b.seed);
}

export interface RunResult {
  readonly lines: readonly GameLine[];
  readonly summary: Summary;
}

/**
 * Validates every cell's scenario up front, before any game is played, and returns every
 * faction id across all cells (a variant may add one), in order of first appearance.
 */
export function prepare(sources: readonly PackageSources[], plan: RunPlan): readonly string[] {
  const scenarios = cellsOf(plan).map((cell) => cellScenario(sources, plan, cell));
  return [...new Set(scenarios.flatMap((scenario) => scenario.factions.map((faction) => faction.id as string)))];
}

/** Runs a whole plan on this thread: the smoke test's path, and the core every worker shares. */
export function runInProcess(sources: readonly PackageSources[], plan: RunPlan): RunResult {
  const factionIds = prepare(sources, plan);
  const run = createTaskRunner(sources, plan);
  const lines = orderLines(plan, tasksOf(plan).map(run));
  return { lines, summary: buildSummary(plan, factionIds, lines) };
}
