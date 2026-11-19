import { battleColumn, objectivesOf, orderRoute, playComputerGame, type Scenario, type TurnOutcome } from "./engine";

/** A game won before this turn is an early win (S1). */
export const earlyWinTurn = 4;

/** One faction's losses in one game. */
export interface FactionLosses {
  /** Men lost in battle. */
  readonly men: number;
  /** Units that left the board: destroyed, surrendered or disbanded. */
  readonly units: number;
}

/** One game, as one line of `games.jsonl`. Every key is sorted the same way for every game. */
export interface GameLine {
  /** Battles by odds column, then by result: `battles[column][result]`. */
  readonly battles: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Battles fought on each turn, turn 1 first. */
  readonly battlesByTurn: readonly number[];
  readonly blunders: boolean;
  /** "decided" when a faction won, "freeze" when the turn limit came first. */
  readonly end: "decided" | "freeze";
  /** S3: a faction left every objective it held with no loss and no retreat. */
  readonly abandonments: number;
  /** Turn-1 orders per faction, as `from>to` routes in submission order. */
  readonly firstTurnRoutes: Readonly<Record<string, readonly string[]>>;
  readonly losses: Readonly<Record<string, FactionLosses>>;
  /** The longest run of turns in which no territory changed hands. */
  readonly longestQuiet: number;
  readonly seed: number;
  /** Turns played: the winning turn, or the turn limit. */
  readonly turns: number;
  readonly variant: string;
  /** The victory condition, when decided. */
  readonly victory?: string;
  /** Winning factions, in the engine's order; empty for a freeze. */
  readonly winners: readonly string[];
}

/** What a game is played under. */
export interface GameSetup {
  readonly blunders: boolean;
  readonly scenario: Scenario;
  readonly turnLimit: number;
  readonly variant: string;
}

function retreatedUnits(outcomes: readonly TurnOutcome[]): ReadonlySet<string> {
  return new Set(outcomes.flatMap((outcome): string[] => {
    if (outcome.kind === "battle") return outcome.retreats.map((retreat) => retreat.unitId);
    return outcome.kind === "bounced-move" && outcome.retreatedTo !== undefined ? [outcome.order.unitId] : [];
  }));
}

/** Plays one seeded all-computer game and records everything the summary needs. */
export function playGame(setup: GameSetup, seed: number): GameLine {
  const { scenario } = setup;
  const factionIds = scenario.factions.map((faction) => faction.id as string);
  const objectives = objectivesOf(scenario);
  const battles: Record<string, Record<string, number>> = {};
  const battlesByTurn: number[] = [];
  const losses = Object.fromEntries(factionIds.map((id) => [id, { men: 0, units: 0 }]));
  let firstTurnRoutes: Record<string, string[]> = {};
  let abandonments = 0;
  let quiet = 0;
  let longestQuiet = 0;
  let turns = 0;
  let winners: readonly string[] = [];
  let victory: string | undefined;

  playComputerGame(scenario, seed, setup.turnLimit, ({ before, result, turn }) => {
    turns = turn;
    const after = result.finalState;
    const factionOf = (unitId: string): string | undefined => before.units[unitId as keyof typeof before.units]?.factionId;
    let fought = 0;
    for (const outcome of result.outcomes) {
      if (outcome.kind !== "battle") continue;
      fought += 1;
      const column = (battles[battleColumn(outcome)] ??= {});
      column[outcome.result] = (column[outcome.result] ?? 0) + 1;
      for (const loss of outcome.losses) {
        const owner = factionOf(loss.unitId);
        const tally = owner === undefined ? undefined : losses[owner];
        if (tally !== undefined) tally.men += loss.men;
      }
    }
    battlesByTurn.push(fought);
    for (const unit of Object.values(before.units)) {
      const tally = losses[unit.factionId];
      if (!(unit.id in after.units) && tally !== undefined) tally.units += 1;
    }
    if (turn === 1) {
      firstTurnRoutes = Object.fromEntries(factionIds.map((id) => [id, [] as string[]]));
      for (const order of result.submittedOrders) firstTurnRoutes[order.factionId]?.push(orderRoute(order));
    }
    quiet = result.controlChanges.length === 0 ? quiet + 1 : 0;
    longestQuiet = Math.max(longestQuiet, quiet);

    // Driven out is not abandoned: an army that retreated (M21) left under fire.
    const retreated = retreatedUnits(result.outcomes);
    for (const factionId of factionIds) {
      const held = objectives.get(factionId) ?? new Set<string>();
      const holds = (units: typeof before.units) =>
        Object.values(units).some((unit) => unit.factionId === factionId && held.has(unit.territoryId));
      const count = (units: typeof before.units) => Object.values(units).filter((unit) => unit.factionId === factionId).length;
      const lostUnits = count(after.units) < count(before.units);
      const drivenOut = Object.values(before.units).some((unit) => unit.factionId === factionId && retreated.has(unit.id));
      if (holds(before.units) && !holds(after.units) && !lostUnits && !drivenOut) abandonments += 1;
    }
    if (result.victory !== undefined) {
      winners = [...result.victory.factionIds];
      victory = result.victory.condition;
    }
  });

  return {
    abandonments,
    battles,
    battlesByTurn,
    blunders: setup.blunders,
    end: winners.length > 0 ? "decided" : "freeze",
    firstTurnRoutes,
    longestQuiet,
    losses,
    seed,
    turns,
    variant: setup.variant,
    ...(victory === undefined ? {} : { victory }),
    winners
  };
}
