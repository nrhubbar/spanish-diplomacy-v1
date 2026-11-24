import { onGroundBoard } from "../air/pieces";
import { requireUnitState } from "../lookup";
import { type BattleEstimate, estimateBattle } from "../d20/estimate";
import type { MoveRoute } from "../movement/routes";
import type { FactionId, GameState, Scenario, TerritoryId, UnitId } from "../types";

export { oddsForValues } from "../d20/estimate";

/** What a move into a territory would meet, judged from the start-of-turn state. */
export type AttackEstimate =
  /** M11 (C10): the destination is the mover's own; it arrives and joins the defence. */
  | { readonly kind: "reinforcement" }
  /** No army of another faction is there; the move is unopposed unless another faction also enters. */
  | { readonly kind: "unopposed" }
  /** D1-D8: the battle it would fight. */
  | BattleEstimate;

/**
 * C15: the odds and the chance to take a territory if `unitIds` of `factionId` attack it,
 * assuming every army there stays and no other faction joins in. Uses each army's current
 * strength and morale, the territory's works, and the scenario's faction modifiers. It does
 * not judge whether the order is legal (a demoralized army cannot attack, M23); validation does.
 * R11: `support` names the faction's aircraft planned on Ground Support over the target; their
 * support counts as the air battle against the defenders' AA may leave it.
 * `plannedRoutes` names the way each attacker takes, where it is already chosen.
 */
export function estimateAttack(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  targetTerritoryId: TerritoryId,
  support: readonly UnitId[] = [],
  plannedRoutes?: ReadonlyMap<UnitId, MoveRoute>
): AttackEstimate {
  const ordered = unitIds.map((id) => requireUnitState(state, id));
  if (ordered.length === 0 || ordered.some((unit) => unit.factionId !== factionId)) {
    throw new Error(`Invariant violated: an attack needs one or more armies of "${factionId}".`);
  }
  // D17, M11: what the ground steps see there: never aircraft; generals too (a lone general is defended ground).
  const present = Object.values(state.units).filter((unit) => unit.territoryId === targetTerritoryId && onGroundBoard(scenario, state.raised, unit.id));
  const control = state.control[targetTerritoryId];
  const own = control?.kind === "controlled" && control.factionId === factionId;
  if (own || present.some((unit) => unit.factionId === factionId)) {
    return { kind: "reinforcement" };
  }
  if (present.length === 0) {
    return { kind: "unopposed" };
  }
  return estimateBattle(scenario, state, factionId, unitIds, targetTerritoryId, support, plannedRoutes);
}
