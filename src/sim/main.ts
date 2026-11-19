import { join } from "node:path";
import { type CliOptions, parseArgs, usage } from "./args";
import { defaultScenarioId, type PackageSources } from "./engine";
import type { GameLine } from "./game";
import { formatSummary, runStamp, writeRun } from "./output";
import { parseVariantFile, PatchError } from "./patch";
import { type PoolWorker, runPool } from "./pool";
import {
  baselineName,
  buildSummary,
  defaultBlunderMode,
  type GameTask,
  orderLines,
  prepare,
  type RunPlan,
  tasksOf,
  type Variant
} from "./run";

/** What a worker thread is started with. */
export interface WorkerSetup {
  readonly plan: RunPlan;
}

/** The outside world the CLI talks to; tests replace every part. */
export interface CliIo {
  readonly cores: number;
  readonly now: () => Date;
  readonly readText: (path: string) => string;
  /** The scenario packages to play; with exactly one, it is the default scenario. */
  readonly sources: readonly PackageSources[];
  readonly spawn: (setup: WorkerSetup) => PoolWorker<GameTask, GameLine>;
  readonly stderr: (text: string) => void;
  readonly stdout: (text: string) => void;
}

/** Reads every variant file; names must be unique and must not be the baseline's. */
export function readVariants(files: readonly string[], readText: (path: string) => string): readonly Variant[] {
  const variants = files.map((file) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readText(file));
    } catch (error) {
      throw new PatchError(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return parseVariantFile(parsed, file);
  });
  const names = new Set<string>([baselineName]);
  for (const variant of variants) {
    if (names.has(variant.name)) throw new PatchError(`Variant name "${variant.name}" is used twice (or is the baseline's).`);
    names.add(variant.name);
  }
  return variants;
}

/** The run plan, with the defaults the options leave open filled in. */
export function planOf(options: CliOptions, variants: readonly Variant[], sources: readonly PackageSources[]): RunPlan {
  return {
    blunders: options.blunders ?? defaultBlunderMode(),
    scenarioId: options.scenarioId ?? defaultScenarioId(sources),
    seeds: options.seeds,
    turnLimit: options.turnLimit,
    variants
  };
}

/** Runs the CLI. Returns the process exit code: 0 done, 2 bad arguments or data. */
export async function runCli(argv: readonly string[], io: CliIo): Promise<number> {
  let options: CliOptions;
  let plan: RunPlan;
  let factionIds: readonly string[];
  try {
    options = parseArgs(argv);
    if (options.help) {
      io.stdout(usage);
      return 0;
    }
    plan = planOf(options, readVariants(options.variantFiles, io.readText), io.sources);
    factionIds = prepare(io.sources, plan);
  } catch (error) {
    // Everything before the first game is input: arguments, variant files, scenario data.
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  const tasks = tasksOf(plan);
  const workers = Math.min(tasks.length, options.workers ?? Math.max(1, io.cores - 1));
  const dir = join(options.outDir, options.run ?? runStamp(io.now()));
  io.stderr(`sim: ${tasks.length} games on ${workers} worker threads\n`);
  let reported = 0;
  const lines = await runPool(tasks, workers, () => io.spawn({ plan }), (done, total) => {
    const step = Math.floor((done * 10) / total);
    if (step > reported) {
      reported = step;
      io.stderr(`sim: ${done}/${total}\n`);
    }
  });
  const ordered = orderLines(plan, lines);
  const summary = buildSummary(plan, factionIds, ordered);
  writeRun(dir, summary, ordered);
  io.stdout(formatSummary(summary, dir));
  return 0;
}
