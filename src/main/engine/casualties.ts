import { isGroundUnit } from "./air/pieces";
import type { FactionId, GameState, Scenario, TurnOutcome, UnitId } from "./types";

/**
 * The men each faction lost this turn, counted from what the turn reports: battles (a unit that
 * breaks up loses all its men), surrenders, units disbanded by an impossible move, and cold. Each
 * kind is listed on purpose: men who leave any other way, such as on a Disband order, are not
 * casualties. A unit surrenders once, however many outcomes report it, and one that a battle
 * destroyed has no men left to surrender. Only ground units have men to lose.
 */
export function turnCasualties(scenario: Scenario, start: Pick<GameState, "raised" | "units">, outcomes: readonly TurnOutcome[]): ReadonlyMap<FactionId, number> {
  const fallen: { readonly men: number; readonly unitId: UnitId }[] = [];
  const destroyed = new Set<UnitId>();
  const gone = new Map<UnitId, number>();
  for (const outcome of outcomes) {
    switch (outcome.kind) {
      case "battle":
        fallen.push(...outcome.losses);
        for (const loss of outcome.losses) if (loss.destroyed) destroyed.add(loss.unitId);
        for (const [unitId, men] of Object.entries(outcome.surrenderedMen ?? {}) as [UnitId, number][]) gone.set(unitId, men);
        break;
      case "frostbite":
        fallen.push(outcome);
        break;
      case "path-surrender":
        gone.set(outcome.unitId, outcome.men);
        break;
      case "disbanded-move":
      case "invalid-order":
        gone.set(outcome.order.unitId, outcome.men);
        break;
      default:
    }
  }
  for (const unitId of destroyed) gone.delete(unitId);
  const totals = new Map<FactionId, number>();
  for (const { men, unitId } of [...fallen, ...[...gone].map(([id, left]) => ({ men: left, unitId: id }))]) {
    const factionId = start.units[unitId]?.factionId;
    if (factionId === undefined || men === 0 || !isGroundUnit(scenario, start.raised, unitId)) continue;
    totals.set(factionId, (totals.get(factionId) ?? 0) + men);
  }
  return totals;
}

/** The running totals after a turn, ready to spread into its final state; nothing while nobody has lost a man. */
export function casualtiesAfter(scenario: Scenario, start: GameState, outcomes: readonly TurnOutcome[]): Pick<GameState, "casualties"> {
  const turn = turnCasualties(scenario, start, outcomes);
  if (start.casualties === undefined && turn.size === 0) return {};
  const totals: Record<FactionId, number> = { ...start.casualties };
  for (const [factionId, men] of turn) totals[factionId] = (totals[factionId] ?? 0) + men;
  return { casualties: totals };
}
