import { type FactionId, type GameState, isMoveOrder, type MoveOrder, type Scenario } from "../engine/types";
import { victoryProgress } from "../engine/victory";
import type { Session } from "./session";

export interface SubmissionStatus {
  readonly abbreviation: string;
  readonly factionId: FactionId;
  readonly name: string;
  readonly ready: boolean;
}

/** Ready flags only; never the content of another faction's orders (M2 section 7.4). */
export function selectSubmissionStatus(scenario: Scenario, session: Session): readonly SubmissionStatus[] {
  if (session.phase === "idle" || session.phase === "setup") return [];
  return scenario.factions.map((faction) => ({
    abbreviation: faction.abbreviation,
    factionId: faction.id,
    name: faction.name,
    ready: session.phase !== "planning" && session.phase !== "handoff"
      ? true
      // T6: a local computer player is always ready.
      : session.game.locked[faction.id] !== undefined || session.game.assignments[faction.id] === "computer"
  }));
}

export interface RevealedOrders {
  readonly factionId: FactionId;
  readonly orders: readonly MoveOrder[];
}

/** Orders become visible only after resolution (B13). */
export function selectRevealedOrders(session: Session): readonly RevealedOrders[] {
  if (session.phase !== "resolution" && session.phase !== "game-over") return [];
  const byFaction = new Map<FactionId, MoveOrder[]>();
  for (const submission of Object.values(session.game.locked)) byFaction.set(submission.factionId, []);
  for (const order of session.result.submittedOrders.filter(isMoveOrder)) {
    byFaction.set(order.factionId, [...(byFaction.get(order.factionId) ?? []), order]);
  }
  return [...byFaction].map(([factionId, orders]) => ({ factionId, orders }));
}

export interface VictoryMeasure {
  /** How many the faction holds now. */
  readonly held: number;
  /** How many it must hold to win. */
  readonly needed: number;
  /** How many count toward victory in this scenario. */
  readonly total: number;
}

export interface VictoryStanding {
  readonly cities: VictoryMeasure;
  readonly factionId: FactionId;
  readonly territories: VictoryMeasure;
}

/**
 * One faction's live standing against the scenario's victory thresholds. Counts come from
 * the engine's `victoryProgress`, so the Briefing always agrees with how victory is judged.
 */
export function selectVictoryStanding(scenario: Scenario, state: GameState, factionId: FactionId): VictoryStanding {
  const entry = victoryProgress(scenario, state).find((candidate) => candidate.factionId === factionId);
  if (entry === undefined) throw new Error(`Unknown faction "${factionId}".`);
  return {
    cities: {
      held: entry.citiesControlled,
      needed: entry.cityThreshold,
      total: scenario.cities.filter((city) => city.countsForVictory).length
    },
    factionId,
    territories: {
      held: entry.territoriesControlled,
      needed: entry.territoryThreshold,
      total: scenario.territories.filter((territory) => territory.countsForVictory).length
    }
  };
}
