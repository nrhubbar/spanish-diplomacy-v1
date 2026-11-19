import { requireUnitState } from "../lookup";
import type { BattleSide, FactionId, GameState, Scenario, TerritoryId, UnitId } from "../types";
import { type BattleOdds, battleOdds, situationalModifiers } from "./odds";
import { battleSide } from "./values";

/** What a move into a territory would meet, judged from the start-of-turn state. */
export type AttackEstimate =
  /** M11 (C10): the destination is the mover's own; it arrives and joins the defence. */
  | { readonly kind: "reinforcement" }
  /** No army of another faction is there; the move is unopposed unless another faction also enters. */
  | { readonly kind: "unopposed" }
  | (BattleOdds & { readonly attacker: BattleSide; readonly defender: BattleSide; readonly kind: "battle" });

/**
 * C15: the odds and the chance to take a territory if `unitIds` of `factionId` attack it,
 * assuming every army there stays and no other faction joins in. Uses each army's current
 * strength and morale, the territory's works, and the scenario's faction modifiers. It does
 * not judge whether the order is legal (a demoralized army cannot attack, M23); validation does.
 */
export function estimateAttack(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  targetTerritoryId: TerritoryId
): AttackEstimate {
  const attackers = unitIds.map((id) => requireUnitState(state, id));
  if (attackers.length === 0 || attackers.some((unit) => unit.factionId !== factionId)) {
    throw new Error(`Invariant violated: an attack needs one or more armies of "${factionId}".`);
  }
  const present = Object.values(state.units).filter((unit) => unit.territoryId === targetTerritoryId);
  const control = state.control[targetTerritoryId];
  const own = control?.kind === "controlled" && control.factionId === factionId;
  if (own || present.some((unit) => unit.factionId === factionId)) {
    return { kind: "reinforcement" };
  }
  if (present.length === 0) {
    return { kind: "unopposed" };
  }
  const attacker = battleSide(scenario, attackers, "attack");
  const defender = battleSide(scenario, present, "defence");
  const situational = situationalModifiers(scenario, state, {
    attackerFactionId: factionId,
    defenderFactionIds: [...new Set(present.map((unit) => unit.factionId))],
    diggingIn: true,
    territoryId: targetTerritoryId
  });
  return {
    ...battleOdds(scenario.combat, attacker.value, defender.value, situational),
    attacker,
    defender,
    kind: "battle"
  };
}
