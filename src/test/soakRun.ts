import { initialGameState } from "../main/engine/resolution";
import type { FactionId, Scenario } from "../main/engine/types";
import { advance, nextTurn } from "../main/state/coordinator";
import type { GameRecord, Session } from "../main/state/session";

export interface SoakResult {
  readonly abandonments: number;
  readonly decided: number;
  readonly earlyWins: number;
  readonly firstTurnChanges: number;
  readonly freezes: number;
  readonly games: number;
  readonly lengths: readonly number[];
  readonly wins: Readonly<Record<string, number>>;
}

/** Plays seeded all-computer games through the real coordinator (Revision 5, section 8.4). */
export function soak(scenario: Scenario, games: number, maxTurns: number, firstSeed = 1): SoakResult {
  const wins: Record<string, number> = {};
  const lengths: number[] = [];
  let decided = 0;
  let earlyWins = 0;
  let freezes = 0;
  let abandonments = 0;
  let firstTurnChanges = 0;
  const objectives = new Map(scenario.factions.map((faction) => [faction.id, new Set(faction.objectiveTerritoryIds)]));
  const holdsObjective = (game: GameRecord, factionId: FactionId) =>
    Object.values(game.state.units).some((unit) => unit.factionId === factionId && objectives.get(factionId)?.has(unit.territoryId));
  const unitCount = (game: GameRecord, factionId: FactionId) => Object.values(game.state.units).filter((unit) => unit.factionId === factionId).length;

  for (let seed = firstSeed; seed < firstSeed + games; seed += 1) {
    const assignments = Object.fromEntries(scenario.factions.map((faction) => [faction.id, "computer" as const]));
    let before: GameRecord = { assignments, history: [], locked: {}, scenarioId: scenario.id, seed, state: initialGameState(scenario) };
    let session: Session = advance(scenario, before);
    let quietTurns = 0;
    let froze = false;
    for (let turn = 1; turn <= maxTurns; turn += 1) {
      if (session.phase !== "resolution" && session.phase !== "game-over") throw new Error(`Unexpected ${session.phase}`);
      const { game, result } = session;
      if (turn === 1) firstTurnChanges += result.controlChanges.length;
      quietTurns = result.controlChanges.length === 0 ? quietTurns + 1 : 0;
      if (quietTurns >= 5) froze = true;
      for (const faction of scenario.factions) {
        const lostUnits = unitCount(game, faction.id) < unitCount(before, faction.id);
        if (holdsObjective(before, faction.id) && !holdsObjective(game, faction.id) && !lostUnits) abandonments += 1;
      }
      if (session.phase === "game-over") {
        decided += 1;
        lengths.push(turn);
        if (turn < 4) earlyWins += 1;
        for (const id of result.victory?.factionIds ?? []) wins[id] = (wins[id] ?? 0) + 1;
        break;
      }
      before = game;
      session = nextTurn(scenario, game, result.outcomes);
      if (turn === maxTurns) lengths.push(maxTurns + 1);
    }
    if (froze) freezes += 1;
  }
  return { abandonments, decided, earlyWins, firstTurnChanges, freezes, games, lengths, wins };
}
