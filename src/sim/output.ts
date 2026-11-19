import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameLine } from "./game";
import type { Summary } from "./run";
import type { Interval } from "./stats";

/** Writes `summary.json` and `games.jsonl` into `dir`, creating it. Returns the two paths. */
export function writeRun(dir: string, summary: Summary, lines: readonly GameLine[]): { readonly games: string; readonly summary: string } {
  mkdirSync(dir, { recursive: true });
  const paths = { games: join(dir, "games.jsonl"), summary: join(dir, "summary.json") };
  writeFileSync(paths.summary, `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(paths.games, lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
  return paths;
}

/** A folder name from a moment, `YYYYMMDD-HHMMSS` in UTC. Names folders only; never enters a summary. */
export function runStamp(moment: Date): string {
  return moment.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

const percent = (value: number): string => `${(value * 100).toFixed(1)}%`;
const share = (interval: Interval | null): string =>
  interval === null ? "n/a" : `${percent(interval.value)} [${percent(interval.low)}, ${percent(interval.high)}]`;
const signed = (value: number, digits: number): string => `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
const difference = (interval: Interval | null, scale: number, digits: number): string =>
  interval === null
    ? "n/a"
    : `${signed(interval.value * scale, digits)} [${signed(interval.low * scale, digits)}, ${signed(interval.high * scale, digits)}]`;

/** The console summary (Q-HARN-7): a few ASCII lines per cell and per comparison. */
export function formatSummary(summary: Summary, dir: string): string {
  const out: string[] = [
    `sim: ${summary.scenarioId}, seeds ${summary.seeds}, turn limit ${summary.turnLimit}, ${summary.games} games -> ${dir}`
  ];
  if (summary.blunderControl === "pending") out.push("note: blunders are not in the computer player yet; both settings play alike.");
  for (const cell of summary.cells) {
    const { metrics } = cell;
    const median = metrics.length.decided?.median;
    out.push(
      `${cell.id}: ${metrics.games} games, decided ${share(metrics.decidedRate)}, freezes ${share(metrics.freezeRate)}`
        + (median === undefined ? "" : `, median length ${median}`),
      `  wins of decided: ${summary.factions.map((id) => `${id} ${share(metrics.wins[id]?.shareOfDecided ?? null)}`).join(", ")}`,
      `  battles per turn ${metrics.battles.perTurn}, abandonments ${metrics.sanity.abandonments}, early wins ${metrics.sanity.earlyWins}`
    );
  }
  for (const comparison of summary.comparisons) {
    out.push(
      `${comparison.subject} vs ${comparison.against} (${comparison.pairs} seeds): freezes ${difference(comparison.freezeRate, 100, 1)} pts,`
        + ` turns ${difference(comparison.turns, 1, 2)}`,
      `  win share (pts): ${summary.factions.map((id) => `${id} ${difference(comparison.winShare[id] ?? null, 100, 1)}`).join(", ")}`
    );
  }
  return `${out.join("\n")}\n`;
}
