import { join } from "node:path";
import { type CliOptions, parseArgs, usage } from "./args";
import { defaultScenarioId, type PackageSources } from "./engine";
import { formatSummary, runStamp, writeRun } from "./output";
import { parseVariantFile, PatchError } from "./patch";
import { type PoolWorker, runPool } from "./pool";
import { buildReport, formatReport, readRun, writeReport } from "./report";
import {
  baselineName,
  buildSummary,
  type GameTask,
  lineupVariant,
  orderLines,
  type PlayedGame,
  prepare,
  type Prepared,
  type RunPlan,
  type Seats,
  tasksOf,
  type Variant
} from "./run";
import { timingLines, writeTimings } from "./timings";

/** What a worker thread is started with. */
export interface WorkerSetup {
  readonly plan: RunPlan;
  /** Which worker thread this is, 1 first. */
  readonly worker: number;
}

/** The outside world the CLI talks to; tests replace every part. */
export interface CliIo {
  readonly cores: number;
  readonly now: () => Date;
  readonly readText: (path: string) => string;
  /** The scenario packages to play; with exactly one, it is the default scenario. */
  readonly sources: readonly PackageSources[];
  readonly spawn: (setup: WorkerSetup) => PoolWorker<GameTask, PlayedGame>;
  readonly stderr: (text: string) => void;
  readonly stdout: (text: string) => void;
}

/** Reads every variant file, and makes a variant of every lineup; names must be unique and must not be the baseline's. */
export function readVariants(files: readonly string[], readText: (path: string) => string, lineups: readonly Seats[] = []): readonly Variant[] {
  const read = files.map((file) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readText(file));
    } catch (error) {
      throw new PatchError(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return parseVariantFile(parsed, file);
  });
  const variants: readonly Variant[] = [...read, ...lineups.map(lineupVariant)];
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
    ...(options.record === undefined ? {} : { record: options.record }),
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
  let prepared: Prepared;
  try {
    options = parseArgs(argv);
    if (options.help) {
      io.stdout(usage);
      return 0;
    }
    if (options.report !== undefined) {
      const run = readRun(options.report, io.readText);
      const report = buildReport(run);
      writeReport(options.report, run, report);
      io.stdout(formatReport(report, options.report));
      return 0;
    }
    plan = planOf(options, readVariants(options.variantFiles, io.readText, options.lineups), io.sources);
    prepared = prepare(io.sources, plan);
  } catch (error) {
    // Everything before the first game is input: arguments, variant files, lineups, scenario data.
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  const tasks = tasksOf(plan);
  const workers = Math.min(tasks.length, options.workers ?? Math.max(1, io.cores - 1));
  const dir = join(options.outDir, options.run ?? runStamp(io.now()));
  io.stderr(`sim: ${tasks.length} games on ${workers} worker threads\n`);
  let reported = 0;
  let spawned = 0;
  const began = io.now().getTime();
  const played = await runPool(tasks, workers, () => io.spawn({ plan, worker: (spawned += 1) }), (done, total) => {
    const step = Math.floor((done * 10) / total);
    if (step > reported) {
      reported = step;
      io.stderr(`sim: ${done}/${total}\n`);
    }
  });
  const totalMilliseconds = io.now().getTime() - began;
  const ordered = orderLines(plan, played.map((game) => game.line));
  const summary = buildSummary(plan, prepared.factionIds, ordered, prepared.seats);
  writeRun(dir, summary, ordered);
  io.stdout(formatSummary(summary, dir));
  if (plan.record !== undefined) {
    const timings = timingLines(plan, played, { cores: io.cores, totalMilliseconds, workers });
    writeTimings(dir, timings);
    const run = { lines: ordered, summary, timings };
    const report = buildReport(run);
    writeReport(dir, run, report);
    io.stdout(formatReport(report, dir));
  }
  return 0;
}
