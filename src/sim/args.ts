import { defaultTurnLimit } from "./run";

export const defaultGames = 200;
export const defaultOutDir = "build/sim";

export interface CliOptions {
  readonly help: boolean;
  readonly outDir: string;
  /** The run folder's name; the CLI picks a time-stamped one when absent. */
  readonly run?: string;
  /** Absent: the only shipped scenario (`defaultScenarioId`). */
  readonly scenarioId?: string;
  readonly seeds: readonly number[];
  readonly turnLimit: number;
  /** Variant patch files, in the order given. */
  readonly variantFiles: readonly string[];
  /** Worker threads; the CLI picks one per spare core when absent. */
  readonly workers?: number;
}

export const usage = `Usage: npm run sim -- [options]

  --games N          games per cell (default ${defaultGames}), seeds from --first-seed
  --first-seed S     first seed (default 1)
  --seeds LIST       explicit seeds, for example 1-50,77 (overrides --games and --first-seed)
  --turns N          turn limit; a game still running after it is a freeze (default ${defaultTurnLimit})
  --variant FILE     a JSON patch variant, played on the same seeds as the baseline (repeatable)
  --scenario ID      scenario id (default: the only shipped scenario)
  --workers N        worker threads (default: one per core, less one)
  --run NAME         run folder name under the output folder (default: a time stamp)
  --out DIR          output folder (default ${defaultOutDir})
  --help             show this help
`;

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

function positiveInteger(flag: string, raw: string): number {
  if (!/^[1-9][0-9]*$/.test(raw)) throw new UsageError(`${flag} needs a positive whole number, not "${raw}".`);
  return Number(raw);
}

/** Parses a seed list such as `1-50,77`. Seeds are positive whole numbers, kept in the order given. */
export function parseSeeds(raw: string): readonly number[] {
  const seeds: number[] = [];
  for (const part of raw.split(",")) {
    const match = /^([1-9][0-9]*)(?:-([1-9][0-9]*))?$/.exec(part.trim());
    if (match === null) throw new UsageError(`--seeds: "${part}" is not a seed or a range such as 1-50.`);
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (to < from) throw new UsageError(`--seeds: the range "${part}" runs backwards.`);
    for (let seed = from; seed <= to; seed += 1) seeds.push(seed);
  }
  const unique = [...new Set(seeds)];
  if (unique.length !== seeds.length) throw new UsageError("--seeds: a seed is listed twice.");
  return unique;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  let games = defaultGames;
  let firstSeed = 1;
  let seeds: readonly number[] | undefined;
  let turnLimit = defaultTurnLimit;
  let scenarioId: string | undefined;
  let workers: number | undefined;
  let run: string | undefined;
  let outDir = defaultOutDir;
  let help = false;
  const variantFiles: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    const [flag = "", inline] = arg.startsWith("--") && arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    if (flag === "--help" || flag === "-h") {
      help = true;
      continue;
    }
    const value = (): string => {
      if (inline !== undefined) return inline;
      index += 1;
      const next = argv[index];
      if (next === undefined || next.startsWith("--")) throw new UsageError(`${flag} needs a value.`);
      return next;
    };
    switch (flag) {
      case "--games": games = positiveInteger(flag, value()); break;
      case "--first-seed": firstSeed = positiveInteger(flag, value()); break;
      case "--seeds": seeds = parseSeeds(value()); break;
      case "--turns": turnLimit = positiveInteger(flag, value()); break;
      case "--variant": variantFiles.push(value()); break;
      case "--scenario": scenarioId = value(); break;
      case "--workers": workers = positiveInteger(flag, value()); break;
      case "--out": outDir = value(); break;
      case "--run": {
        const name = value();
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new UsageError(`--run: "${name}" must be letters, digits, dots, hyphens and underscores.`);
        run = name;
        break;
      }
      default: throw new UsageError(`Unknown option "${arg}". Try --help.`);
    }
  }
  return {
    help,
    outDir,
    ...(run === undefined ? {} : { run }),
    ...(scenarioId === undefined ? {} : { scenarioId }),
    seeds: seeds ?? Array.from({ length: games }, (_, offset) => firstSeed + offset),
    turnLimit,
    variantFiles,
    ...(workers === undefined ? {} : { workers })
  };
}
