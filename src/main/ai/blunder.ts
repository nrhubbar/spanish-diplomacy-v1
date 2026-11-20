import type { RandomSource } from "../engine/random";
import type { GameState, Order, Scenario } from "../engine/types";
import { legalMoves } from "./orders/move";

/**
 * H6: a computer player's blunders. Each planned order draws once from the faction's blunder
 * stream (never the tie-break source). A draw below `ai.blunderChance` replaces the order with
 * a uniformly chosen legal alternative for the same unit: another valid destination, or its
 * default order (the order is dropped, so the unit entrenches or rests). The same draw picks the
 * alternative, so every planned order costs exactly one draw. Orders given to sites, not units,
 * keep their draw but never blunder. With a chance of 0, or no stream, nothing changes.
 */
export function applyBlunders(
  scenario: Scenario,
  state: GameState,
  planned: readonly Order[],
  blunder: RandomSource | undefined,
  chance: number
): readonly Order[] {
  if (blunder === undefined || chance <= 0) return planned;
  return planned.flatMap((order): Order[] => {
    const draw = blunder();
    if (draw >= chance || !("unitId" in order)) return [order];
    const unit = state.units[order.unitId];
    if (unit === undefined) return [order];
    const destinations = legalMoves(scenario, state, unit).filter((move) => order.kind !== "move" || move.to !== order.to);
    const alternatives: readonly (Order | undefined)[] = [...destinations, undefined];
    const choice = alternatives[Math.min(alternatives.length - 1, Math.floor((draw / chance) * alternatives.length))];
    return choice === undefined ? [] : [choice];
  });
}
