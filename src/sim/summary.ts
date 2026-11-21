import { earlyWinTurn, type GameLine } from "./game";
import { type Distribution, distribution, type Interval, pairedDifference, round, wilson } from "./stats";

/** Turns per bar of the game-length histogram. */
export const lengthBucket = 6;
/** A game with this many quiet turns in a row (no territory changing hands) is stalled: Revision 7's S2 freeze. */
export const stallQuietTurns = 5;
/** First-turn routes listed per faction. */
export const topRouteCount = 10;

export interface FactionWins {
  /** Wins credited, a shared victory crediting each of its k winners 1/k. */
  readonly wins: number;
  /** Share of decided games (H7's measure), with its 95 percent interval. */
  readonly shareOfDecided: Interval | null;
  /** Share of all games, freezes included. */
  readonly shareOfGames: Interval | null;
}

export interface ColumnResults {
  readonly battles: number;
  /** Share of every battle in the run fought at this column. */
  readonly share: number;
  readonly results: Readonly<Record<string, number>>;
}

export interface RouteCount {
  /** Games in which the faction gave this order on turn 1. */
  readonly games: number;
  readonly route: string;
  readonly share: number;
}

/** Every metric for one cell: one variant (H3). */
export interface RunMetrics {
  readonly battles: {
    readonly byColumn: Readonly<Record<string, ColumnResults>>;
    /** Mean battles on each turn, over the games still running on it. */
    readonly byTurn: readonly number[];
    readonly perTurn: number;
    readonly total: number;
  };
  readonly decided: number;
  readonly decidedRate: Interval | null;
  readonly firstTurn: Readonly<Record<string, { readonly meanOrders: number; readonly topRoutes: readonly RouteCount[] }>>;
  readonly freezeRate: Interval | null;
  /** Games that reached the turn limit with no winner. */
  readonly freezes: number;
  /** Games with `stallQuietTurns` or more quiet turns in a row, decided or not (Revision 7's S2). */
  readonly stalled: number;
  readonly stalledRate: Interval | null;
  readonly games: number;
  readonly length: {
    /** Turns to a decision, decided games only. */
    readonly decided: Distribution | null;
    readonly histogram: readonly { readonly from: number; readonly games: number; readonly to: number }[];
  };
  readonly losses: Readonly<Record<string, { readonly men: number; readonly menPerGame: number; readonly units: number; readonly unitsPerGame: number }>>;
  readonly sanity: {
    /** S3: objectives walked away from with no loss and no retreat. */
    readonly abandonments: number;
    /** S3 checks made (faction-turns holding an objective); 0 would mean S3 was never tested. */
    readonly objectiveChecks: number;
    /** S1: games won before turn 4. */
    readonly earlyWins: number;
    readonly earlyWinRate: Interval | null;
    /** The longest quiet stretch (no territory changing hands) per game. */
    readonly longestQuiet: Distribution | null;
  };
  /** Decided games with more than one winner. */
  readonly sharedVictories: number;
  readonly wins: Readonly<Record<string, FactionWins>>;
}

function credit(line: GameLine, factionId: string): number {
  return line.winners.includes(factionId) ? 1 / line.winners.length : 0;
}

function sortedRecord<Value>(entries: Iterable<readonly [string, Value]>): Record<string, Value> {
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Orders games by seed, so a summary never depends on which worker finished first. */
export function bySeed(lines: readonly GameLine[]): readonly GameLine[] {
  return [...lines].sort((a, b) => a.seed - b.seed);
}

/** Summarizes one cell's games. Pure and order-independent. */
export function summarize(input: readonly GameLine[], factionIds: readonly string[], turnLimit: number): RunMetrics {
  const lines = bySeed(input);
  const games = lines.length;
  const decidedLines = lines.filter((line) => line.end === "decided");
  const decided = decidedLines.length;
  const freezes = games - decided;
  const stalled = lines.filter((line) => line.longestQuiet >= stallQuietTurns).length;
  const earlyWins = decidedLines.filter((line) => line.turns < earlyWinTurn).length;

  const wins = Object.fromEntries(factionIds.map((id) => {
    const credited = lines.reduce((sum, line) => sum + credit(line, id), 0);
    return [id, { shareOfDecided: wilson(credited, decided), shareOfGames: wilson(credited, games), wins: round(credited) }];
  }));

  const histogram: { from: number; games: number; to: number }[] = [];
  for (let from = 1; from <= turnLimit; from += lengthBucket) {
    const to = Math.min(turnLimit, from + lengthBucket - 1);
    histogram.push({ from, games: decidedLines.filter((line) => line.turns >= from && line.turns <= to).length, to });
  }

  const columns = new Map<string, Map<string, number>>();
  const turnTotals: number[] = [];
  const turnGames: number[] = [];
  let totalBattles = 0;
  let totalTurns = 0;
  for (const line of lines) {
    for (const [column, results] of Object.entries(line.battles)) {
      const tally = columns.get(column) ?? new Map<string, number>();
      columns.set(column, tally);
      for (const [result, count] of Object.entries(results)) tally.set(result, (tally.get(result) ?? 0) + count);
    }
    line.battlesByTurn.forEach((count, index) => {
      turnTotals[index] = (turnTotals[index] ?? 0) + count;
      turnGames[index] = (turnGames[index] ?? 0) + 1;
      totalBattles += count;
    });
    totalTurns += line.battlesByTurn.length;
  }
  const byColumn = sortedRecord([...columns].map(([column, results]) => {
    const battles = [...results.values()].reduce((sum, count) => sum + count, 0);
    return [column, { battles, results: sortedRecord(results), share: round(battles / Math.max(1, totalBattles)) }] as const;
  }));

  const losses = Object.fromEntries(factionIds.map((id) => {
    const men = lines.reduce((sum, line) => sum + (line.losses[id]?.men ?? 0), 0);
    const units = lines.reduce((sum, line) => sum + (line.losses[id]?.units ?? 0), 0);
    return [id, { men, menPerGame: round(men / Math.max(1, games)), units, unitsPerGame: round(units / Math.max(1, games)) }];
  }));

  const firstTurn = Object.fromEntries(factionIds.map((id) => {
    const routeGames = new Map<string, number>();
    let orders = 0;
    for (const line of lines) {
      const routes = line.firstTurnRoutes[id] ?? [];
      orders += routes.length;
      for (const route of new Set(routes)) routeGames.set(route, (routeGames.get(route) ?? 0) + 1);
    }
    const topRoutes = [...routeGames]
      .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
      .slice(0, topRouteCount)
      .map(([route, count]) => ({ games: count, route, share: round(count / games) }));
    return [id, { meanOrders: round(orders / Math.max(1, games)), topRoutes }];
  }));

  return {
    battles: {
      byColumn,
      byTurn: turnTotals.map((total, index) => round(total / (turnGames[index] ?? 1))),
      perTurn: round(totalBattles / Math.max(1, totalTurns)),
      total: totalBattles
    },
    decided,
    decidedRate: wilson(decided, games),
    firstTurn,
    freezeRate: wilson(freezes, games),
    freezes,
    games,
    length: { decided: distribution(decidedLines.map((line) => line.turns)), histogram },
    losses,
    sanity: {
      abandonments: lines.reduce((sum, line) => sum + line.abandonments, 0),
      earlyWinRate: wilson(earlyWins, games),
      earlyWins,
      longestQuiet: distribution(lines.map((line) => line.longestQuiet)),
      objectiveChecks: lines.reduce((sum, line) => sum + line.objectiveChecks, 0)
    },
    sharedVictories: decidedLines.filter((line) => line.winners.length > 1).length,
    stalled,
    stalledRate: wilson(stalled, games),
    wins
  };
}

/** A paired comparison of two cells played on the same seeds (H4). */
export interface Comparison {
  /** The cell compared against. */
  readonly against: string;
  /** Variant minus baseline, per seed, with its 95 percent interval. */
  readonly decidedRate: Interval | null;
  readonly freezeRate: Interval | null;
  /** Seeds both cells played; only these are compared. */
  readonly pairs: number;
  readonly stalledRate: Interval | null;
  readonly subject: string;
  /** Turns played (the limit for a freeze), variant minus baseline. */
  readonly turns: Interval | null;
  /** Each faction's win credit per game, variant minus baseline. */
  readonly winShare: Readonly<Record<string, Interval | null>>;
}

/** Compares `subject` with `against` seed by seed; seeds played by only one side are left out. */
export function compare(
  subjectName: string,
  subject: readonly GameLine[],
  againstName: string,
  against: readonly GameLine[],
  factionIds: readonly string[]
): Comparison {
  const baseline = new Map(against.map((line) => [line.seed, line]));
  const pairs = bySeed(subject).flatMap((line) => {
    const other = baseline.get(line.seed);
    return other === undefined ? [] : [[line, other] as const];
  });
  const differences = (measure: (line: GameLine) => number) => pairedDifference(pairs.map(([a, b]) => measure(a) - measure(b)));
  return {
    against: againstName,
    decidedRate: differences((line) => (line.end === "decided" ? 1 : 0)),
    freezeRate: differences((line) => (line.end === "freeze" ? 1 : 0)),
    pairs: pairs.length,
    stalledRate: differences((line) => (line.longestQuiet >= stallQuietTurns ? 1 : 0)),
    subject: subjectName,
    turns: differences((line) => line.turns),
    winShare: Object.fromEntries(factionIds.map((id) => [id, differences((line) => credit(line, id))]))
  };
}
