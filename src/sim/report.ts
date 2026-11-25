import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { earlyWinTurn, type GameLine } from "./game";
import { byMeasure, flows, type Inventory, type InventoryColumns, type Measure, measureColumns, stocks } from "./inventory";
import type { Seats, Summary } from "./run";
import { type Distribution, distribution, round } from "./stats";
import { type RunMetrics, stallQuietTurns } from "./summary";
import type { GameTiming, RunTiming, TimingLine } from "./timings";

/**
 * Turns a `--record inventory` run into tables: one JSON for a report to read, and a CSV per
 * table. It reads only what the run wrote, so `--report DIR` can write them again.
 */

/** What a run wrote. */
export interface RecordedRun {
  readonly lines: readonly GameLine[];
  readonly summary: Summary;
  readonly timings: readonly TimingLine[];
}

/** One game's line with its inventory. */
type RecordedLine = GameLine & { readonly inventory: Inventory };

type Means = Readonly<Record<string, readonly number[]>>;

export interface SideReport {
  /** Means over every game of each stock at the game's end, by measure and column. */
  readonly final: Means;
  /** Means over the games still running on each turn, by measure, then turn (0 first), then column. */
  readonly perTurn: Readonly<Record<Measure, readonly (readonly number[])[]>>;
  /** Means over every game of each flow's sum over its turns (turn 0 left out), by measure and column. */
  readonly totals: Means;
}

export interface CellReport {
  readonly id: string;
  readonly columns: InventoryColumns;
  /** Wall-clock milliseconds per game on its worker thread, and per turn played. Not deterministic. */
  readonly milliseconds: { readonly perGame: Distribution | null; readonly perTurn: Distribution | null };
  /** The personas its factions play, where any is given one. */
  readonly seats?: Seats;
  readonly outcomes: Pick<RunMetrics, "decided" | "decidedRate" | "freezeRate" | "freezes" | "games" | "length" | "sharedVictories" | "stalled" | "stalledRate" | "wins"> & {
    readonly earlyWinRate: RunMetrics["sanity"]["earlyWinRate"];
    readonly earlyWins: number;
    /** Turns played, freezes included. */
    readonly turns: Distribution | null;
    /** Decided games by victory condition. */
    readonly victories: Readonly<Record<string, number>>;
  };
  /** Games that reached each turn, turn 0 first: what the per-turn means are over. */
  readonly running: readonly number[];
  readonly sides: Readonly<Record<string, SideReport>>;
}

/** `report.json`. */
export interface Report {
  readonly format: "spanish-diplomacy-sim-report/1";
  readonly scenarioId: string;
  readonly seeds: string;
  readonly turnLimit: number;
  readonly games: number;
  readonly factions: readonly string[];
  /** Which measures are read at a turn's end and which happen during it, and the columns each has. */
  readonly measures: { readonly columns: typeof measureColumns; readonly flows: readonly Measure[]; readonly stocks: readonly Measure[] };
  readonly cells: readonly CellReport[];
  readonly run: RunTiming | null;
}

/** A finished run's files, read back. */
export function readRun(dir: string, readText: (path: string) => string): RecordedRun {
  const jsonLines = (file: string): unknown[] => readText(join(dir, file)).split("\n").filter((line) => line !== "").map((line) => JSON.parse(line) as unknown);
  return {
    lines: jsonLines("games.jsonl") as GameLine[],
    summary: JSON.parse(readText(join(dir, "summary.json"))) as Summary,
    timings: jsonLines("timings.jsonl") as TimingLine[]
  };
}

function recorded(lines: readonly GameLine[]): readonly RecordedLine[] {
  return lines.map((line) => {
    if (line.inventory === undefined) throw new Error(`Seed ${line.seed} of "${line.variant}" has no inventory: run with --record inventory.`);
    return { ...line, inventory: line.inventory };
  });
}

/** Adds rows up, column by column. */
function sumRows(rows: readonly (readonly number[])[], width: number): readonly number[] {
  return Array.from({ length: width }, (_, at) => rows.reduce((sum, row) => sum + (row[at] ?? 0), 0));
}

/** The mean of rows, column by column; zeros for no rows. */
export function meanRows(rows: readonly (readonly number[])[], width: number): readonly number[] {
  return sumRows(rows, width).map((sum) => round(sum / Math.max(1, rows.length)));
}

/** A flow over a game: the sum of its turns, turn 0 (the opening board) left out. */
function totalOf(line: RecordedLine, side: string, measure: Measure): readonly number[] {
  return sumRows((line.inventory.sides[side]?.[measure] ?? []).slice(1), line.inventory.columns[measureColumns[measure]].length).map(round);
}

/** A stock at a game's end. */
function finalOf(line: RecordedLine, side: string, measure: Measure): readonly number[] {
  return line.inventory.sides[side]?.[measure].at(-1) ?? [];
}

function sideReport(lines: readonly RecordedLine[], columns: InventoryColumns, side: string, turns: number): SideReport {
  const width = (measure: Measure) => columns[measureColumns[measure]].length;
  const over = (picked: readonly Measure[], read: (line: RecordedLine, measure: Measure) => readonly number[]): Means =>
    Object.fromEntries(picked.map((measure) => [measure, meanRows(lines.map((line) => read(line, measure)), width(measure))]));
  return {
    final: over(stocks, (line, measure) => finalOf(line, side, measure)),
    perTurn: byMeasure((measure) => Array.from({ length: turns }, (_, turn) => meanRows(lines.flatMap((line) => {
      const row = line.inventory.sides[side]?.[measure][turn];
      return row === undefined ? [] : [row];
    }), width(measure)))),
    totals: over(flows, (line, measure) => totalOf(line, side, measure))
  };
}

function gameTimings(timings: readonly TimingLine[]): readonly GameTiming[] {
  return timings.flatMap((line) => (line.kind === "game" ? [line] : []));
}

export function buildReport(run: RecordedRun): Report {
  const { summary } = run;
  const lines = recorded(run.lines);
  const timed = gameTimings(run.timings);
  return {
    format: "spanish-diplomacy-sim-report/1",
    scenarioId: summary.scenarioId,
    seeds: summary.seeds,
    turnLimit: summary.turnLimit,
    games: summary.games,
    factions: summary.factions,
    measures: { columns: measureColumns, flows, stocks },
    cells: summary.cells.flatMap((cell): CellReport[] => {
      const own = lines.filter((line) => line.variant === cell.variant);
      const [first] = own;
      if (first === undefined) return [];
      const { metrics } = cell;
      const turns = Math.max(...own.map((line) => line.turns)) + 1;
      const ownTimes = timed.filter((game) => game.variant === cell.variant);
      const victories = own.flatMap((line) => line.victory ?? []);
      return [{
        id: cell.id,
        ...(cell.seats === undefined ? {} : { seats: cell.seats }),
        columns: first.inventory.columns,
        milliseconds: {
          perGame: distribution(ownTimes.map((game) => game.milliseconds)),
          perTurn: distribution(ownTimes.map((game) => game.milliseconds / game.turns))
        },
        outcomes: {
          games: metrics.games,
          decided: metrics.decided,
          decidedRate: metrics.decidedRate,
          freezes: metrics.freezes,
          freezeRate: metrics.freezeRate,
          stalled: metrics.stalled,
          stalledRate: metrics.stalledRate,
          earlyWins: metrics.sanity.earlyWins,
          earlyWinRate: metrics.sanity.earlyWinRate,
          sharedVictories: metrics.sharedVictories,
          victories: Object.fromEntries([...new Set(victories)].sort().map((id) => [id, victories.filter((victory) => victory === id).length])),
          wins: metrics.wins,
          length: metrics.length,
          turns: distribution(own.map((line) => line.turns))
        },
        running: Array.from({ length: turns }, (_, turn) => own.filter((line) => line.turns >= turn).length),
        sides: Object.fromEntries(Object.keys(first.inventory.sides).map((side) => [side, sideReport(own, first.inventory.columns, side, turns)]))
      }];
    }),
    run: run.timings.find((line) => line.kind === "run") ?? null
  };
}

type Cell = number | string;
type Row = Readonly<Record<string, Cell>>;

function field(value: Cell | undefined): string {
  const text = value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

/** Rows as CSV text. The header is every key in order of first appearance; a row without one leaves it blank. */
export function csv(rows: readonly Row[]): string {
  const header = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [header, ...rows.map((row) => header.map((key) => row[key]))].map((values) => `${values.map(field).join(",")}\n`).join("");
}

/** A row per side, turn and column of `group`; `fields` name the measures, and a measure without that column leaves its field blank. */
function perTurnRows(report: Report, group: keyof InventoryColumns, name: string, fields: Readonly<Record<string, Measure>>): readonly Row[] {
  return report.cells.flatMap((cell) => Object.entries(cell.sides).flatMap(([side, { perTurn }]) =>
    cell.running.flatMap((games, turn) => cell.columns[group].map((column): Row => ({
      variant: cell.id,
      side,
      turn,
      games,
      [name]: column,
      ...Object.fromEntries(Object.entries(fields).map(([label, measure]): [string, Cell] => {
        const at = cell.columns[measureColumns[measure]].indexOf(column);
        return [label, perTurn[measure][turn]?.[at] ?? ""];
      }))
    })))));
}

function gameRow(line: GameLine): Row {
  return { variant: line.variant, seed: line.seed, end: line.end, turns: line.turns, winners: line.winners.join("+"), victory: line.victory ?? "" };
}

/** Every table of a run, by file name. */
export function reportTables(run: RecordedRun, report: Report): Readonly<Record<string, string>> {
  const lines = recorded(run.lines);
  const labelled = (line: RecordedLine, prefix: string, measure: Measure, values: readonly number[]): [string, Cell][] =>
    line.inventory.columns[measureColumns[measure]].map((column, at) => [`${prefix}${measure}:${column}`, values[at] ?? ""]);
  return {
    "buildings.csv": csv(perTurnRows(report, "projects", "project", { standing: "standing", underWay: "buildsUnderWay", waiting: "buildsWaiting", ordered: "buildsOrdered", refused: "buildsRefused" })),
    "economy.csv": csv(perTurnRows(report, "resources", "resource", { held: "held", income: "income", upkeep: "upkeep", unpaid: "unpaid" })),
    "finals.csv": csv(lines.flatMap((line) => Object.keys(line.inventory.sides).map((side): Row => ({
      ...gameRow(line),
      side,
      won: line.winners.includes(side) ? round(1 / line.winners.length) : 0,
      ...Object.fromEntries(stocks.flatMap((measure) => labelled(line, "", measure, finalOf(line, side, measure)))),
      ...Object.fromEntries(flows.flatMap((measure) => labelled(line, "total-", measure, totalOf(line, side, measure))))
    })))),
    "games.csv": csv(lines.map((line): Row => ({
      ...gameRow(line),
      earlyWin: line.end === "decided" && line.turns < earlyWinTurn ? 1 : 0,
      stalled: line.longestQuiet >= stallQuietTurns ? 1 : 0,
      longestQuiet: line.longestQuiet,
      battles: line.battlesByTurn.reduce((sum, count) => sum + count, 0)
    }))),
    "land.csv": csv(perTurnRows(report, "counts", "count", { mean: "counts" })),
    "timings.csv": csv(gameTimings(run.timings).map(({ milliseconds, seed, turns, variant, worker }): Row => ({ variant, seed, turns, milliseconds, millisecondsPerTurn: round(milliseconds / turns), worker }))),
    "units.csv": csv(perTurnRows(report, "unitTypes", "type", { onMap: "units", training: "training", paused: "paused", ordered: "recruitsOrdered", refused: "recruitsRefused" }))
  };
}

/** Writes `report.json` and the CSV tables beside the run's other files. */
export function writeReport(dir: string, run: RecordedRun, report: Report): void {
  writeFileSync(join(dir, "report.json"), `${JSON.stringify(report, null, 1)}\n`);
  for (const [file, text] of Object.entries(reportTables(run, report))) writeFileSync(join(dir, file), text);
}

const seconds = (milliseconds: number): string => `${(milliseconds / 1000).toFixed(1)} s`;

const contended = "worker threads share the machine, so game times are longer than one game alone";

/** The console lines a recorded run adds: how long it took, and where the tables are. */
export function formatReport(report: Report, dir: string): string {
  const { run } = report;
  return [
    ...(run === null ? [] : [`time: ${seconds(run.totalMilliseconds)} in all, ${seconds(run.gameMilliseconds)} of games on ${run.workers} worker threads (${run.cores} cores); ${contended}`]),
    ...report.cells.flatMap((cell) => (cell.milliseconds.perGame === null ? [] : [`  ${cell.id}: a game takes ${seconds(cell.milliseconds.perGame.median)} (median), ${seconds(cell.milliseconds.perGame.max)} at most; ${cell.outcomes.turns?.median ?? 0} turns (median)`])),
    `tables: report.json and *.csv in ${dir}`
  ].map((line) => `${line}\n`).join("");
}
