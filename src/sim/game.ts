import {
  battleColumn,
  battleResultKey,
  holdsGround,
  objectivesOf,
  orderRoute,
  playComputerGame,
  type PlayedTurn,
  type Scenario,
  territoryControlKey,
  territoryIdsOf,
  type TurnOutcome
} from "./engine";

/** A game won before this turn is an early win (S1). */
export const earlyWinTurn = 4;

/** One faction's losses in one game. */
export interface FactionLosses {
  /** Men lost: the drop in men of units still on the board, plus the men of units that left it. */
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
  /** S3 checks made: turns on which a faction held an objective, summed over factions. Never 0 in a real game. */
  readonly objectiveChecks: number;
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

/**
 * S3: units that left under fire. Battle retreats (M21), bounced moves that retreated, and
 * Withdraw orders (C1), which are only possible from contested ground, the alternative to
 * standing and fighting there.
 */
export function retreatedUnits(outcomes: readonly TurnOutcome[]): ReadonlySet<string> {
  return new Set(outcomes.flatMap((outcome): string[] => {
    if (outcome.kind === "battle") return outcome.retreats.map((retreat) => retreat.unitId);
    if (outcome.kind === "withdrew") return [outcome.order.unitId];
    return outcome.kind === "bounced-move" && outcome.retreatedTo !== undefined ? [outcome.order.unitId] : [];
  }));
}

/** A unit as the bookkeeping reads it: owner, place and men. */
export interface Piece {
  readonly factionId: string;
  readonly strength: number;
  readonly territoryId: string;
}

function piecesOf(state: PlayedTurn["before"]): ReadonlyMap<string, Piece> {
  return new Map(Object.values(state.units).map((unit) => [unit.id as string, unit]));
}

/** The pieces that can hold ground (S3): every unit but aircraft. */
function groundPiecesOf(scenario: Scenario, state: PlayedTurn["before"], pieces: ReadonlyMap<string, Piece>): ReadonlyMap<string, Piece> {
  return new Map([...pieces].filter(([id]) => holdsGround(scenario, state, id)));
}

/**
 * Every unit must stand in one of the scenario's territories, or S3 and the losses would be
 * judged against the wrong places and could pass without testing anything.
 */
export function assertInTerritories(pieces: Iterable<readonly [string, Piece]>, territories: ReadonlySet<string>): void {
  for (const [id, piece] of pieces) {
    if (!territories.has(piece.territoryId)) {
      throw new Error(`Unit "${id}" stands in "${piece.territoryId}", which is not a territory of the scenario; re-check the harness's S3 and control reading.`);
    }
  }
}

/**
 * Plays one seeded all-computer game and records everything the summary needs. Losses,
 * control and S3 are read from the board before and after each turn, not from outcome kinds,
 * so they keep their meaning when the turn becomes a phase pipeline. Battles, retreats and
 * turn-1 orders still come from the turn's outcomes (see the spec's re-check list).
 */
export function playGame(setup: GameSetup, seed: number): GameLine {
  const { scenario } = setup;
  const factionIds = scenario.factions.map((faction) => faction.id as string);
  const objectives = objectivesOf(scenario);
  const territories = territoryIdsOf(scenario);
  const battles: Record<string, Record<string, number>> = {};
  const battlesByTurn: number[] = [];
  const losses = Object.fromEntries(factionIds.map((id) => [id, { men: 0, units: 0 }]));
  let firstTurnRoutes: Record<string, string[]> = {};
  let abandonments = 0;
  let objectiveChecks = 0;
  let quiet = 0;
  let longestQuiet = 0;
  let turns = 0;
  let winners: readonly string[] = [];
  let victory: string | undefined;

  playComputerGame(scenario, seed, setup.turnLimit, ({ before, result, turn }) => {
    turns = turn;
    const after = result.finalState;
    const was = piecesOf(before);
    const now = piecesOf(after);
    assertInTerritories([...was, ...now], territories);

    let fought = 0;
    for (const outcome of result.outcomes) {
      if (outcome.kind !== "battle") continue;
      fought += 1;
      const column = (battles[battleColumn(outcome)] ??= {});
      const key = battleResultKey(outcome);
      column[key] = (column[key] ?? 0) + 1;
    }
    battlesByTurn.push(fought);

    // Losses by id: a unit that left the board is lost whole, a unit still on it lost its drop
    // in men. Units that appeared this turn (reinforcements, recruits) are neither.
    const lost = new Set<string>();
    for (const [id, piece] of was) {
      const tally = losses[piece.factionId];
      if (tally === undefined) continue;
      const remaining = now.get(id);
      if (remaining === undefined) {
        lost.add(id);
        tally.units += 1;
        tally.men += piece.strength;
      } else {
        tally.men += Math.max(0, piece.strength - remaining.strength);
      }
    }

    if (turn === 1) {
      firstTurnRoutes = Object.fromEntries(factionIds.map((id) => [id, [] as string[]]));
      for (const order of result.submittedOrders) firstTurnRoutes[order.factionId]?.push(orderRoute(order));
    }
    const changed = [...territories].some((id) => territoryControlKey(before, id) !== territoryControlKey(after, id));
    quiet = changed ? 0 : quiet + 1;
    longestQuiet = Math.max(longestQuiet, quiet);

    // S3. Driven out is not abandoned: an army that retreated (M21) or withdrew (C1) left under
    // fire. Only units that hold ground count, so an aircraft rebased from a lost airfield is not
    // an objective walked away from.
    const retreated = retreatedUnits(result.outcomes);
    const groundWas = groundPiecesOf(scenario, before, was);
    const groundNow = groundPiecesOf(scenario, after, now);
    for (const factionId of factionIds) {
      const held = objectives.get(factionId) ?? new Set<string>();
      const holds = (pieces: ReadonlyMap<string, Piece>) =>
        [...pieces.values()].some((piece) => piece.factionId === factionId && held.has(piece.territoryId));
      if (!holds(groundWas)) continue;
      objectiveChecks += 1;
      const own = [...groundWas].filter(([, piece]) => piece.factionId === factionId).map(([id]) => id);
      const lostUnits = own.some((id) => lost.has(id));
      const drivenOut = own.some((id) => retreated.has(id));
      if (!holds(groundNow) && !lostUnits && !drivenOut) abandonments += 1;
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
    objectiveChecks,
    seed,
    turns,
    variant: setup.variant,
    ...(victory === undefined ? {} : { victory }),
    winners
  };
}
