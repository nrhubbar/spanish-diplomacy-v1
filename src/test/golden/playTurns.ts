import type { GameState, Scenario, TurnOutcome } from "../../main/engine/types";
import { playComputerGame } from "../../sim/engine";

/** Plays an all-computer game on a numeric seed, through the balance harness's own loop. */
export function playTurns(scenario: Scenario, seed: number, turns: number, onTurn: (state: GameState, outcomes: readonly TurnOutcome[]) => void): void {
  playComputerGame(scenario, seed, turns, ({ result }) => { onTurn(result.finalState, result.outcomes); });
}
