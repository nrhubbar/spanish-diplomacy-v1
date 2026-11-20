import { type Casualties, applySideEffect, resultEffects } from "./battleResults";
import type { Armies, Combatant } from "./board";
import { type BattleOdds, battleOdds, battleSide, type DieFace, faceFor } from "./combat";
import type { GradedBattle } from "./d20/battle";
import type {
  ArmyLoss,
  D6BattleOutcome,
  BattleSide,
  BattleSite,
  CombatModifier,
  CombatRole,
  FactionId,
  Retreat,
  Scenario,
  UnitId
} from "./types";

/** Who fights one battle, with what values, under which situational modifiers (M12, M14). */
export interface Engagement {
  readonly attackerFactionId: FactionId;
  readonly attackers: readonly Combatant[];
  readonly defenders: readonly Combatant[];
  /** Defence values, except the standing entrant of an entry battle, which uses its attack (M19). */
  readonly defenderRole: CombatRole;
  readonly situational: readonly CombatModifier[];
}

/** A battle once its die is rolled: the sides, the odds, the face, and each side's casualties. */
export interface FoughtBattle {
  readonly attacker: BattleSide;
  readonly attackerCasualties: Casualties;
  readonly defender: BattleSide;
  readonly defenderCasualties: Casualties;
  readonly engagement: Engagement;
  readonly face: DieFace;
  readonly index: number;
  readonly odds: BattleOdds;
}

/**
 * M12-M16: fights one battle with the die rolled from its own stream (M26), and works out what
 * its result does to each side, from the armies' current states. Applying the casualties, and
 * deciding who moves where, is the caller's: several battles in one territory share the
 * defenders (M17).
 */
export function fight(scenario: Scenario, armies: Armies, engagement: Engagement, index: number, die: number): FoughtBattle {
  const attacker = sideOf(scenario, engagement.attackers, "attack");
  const defender = sideOf(scenario, engagement.defenders, engagement.defenderRole);
  const odds = battleOdds(scenario.combat, attacker.value, defender.value, engagement.situational);
  const face = faceFor(odds, die);
  const effects = resultEffects[face.result];
  return {
    attacker,
    attackerCasualties: applySideEffect(scenario, effects.attacker, attacker, "attack", armies, defender.value),
    defender,
    defenderCasualties: applySideEffect(scenario, effects.defender, defender, engagement.defenderRole, armies, attacker.value),
    engagement,
    face,
    index,
    odds
  };
}

/** M12: a side's values, each army fighting from where it came. */
export function sideOf(scenario: Scenario, combatants: readonly Combatant[], role: CombatRole): BattleSide {
  return battleSide(scenario, combatants.map(({ from, unit }) => ({ ...unit, territoryId: from })), role);
}

/** What a battle's outcome reports beyond the roll: each effect once, in the battle that caused it. */
export interface BattleReport {
  readonly demoralizedUnitIds: readonly UnitId[];
  readonly losses: readonly ArmyLoss[];
  readonly retreats: readonly Retreat[];
  readonly surrenderedUnitIds: readonly UnitId[];
}

/** A battle fought in a territory rather than on a road. */
export type TerritorySite = Exclude<BattleSite, { readonly kind: "meeting" }>;

/** A battle whose retreats and surrenders are settled after every battle of its step (M21). */
export interface PendingBattle {
  /** A d6 battle, or a d20 one (`d20/battle.ts`). */
  readonly battle: FoughtBattle | GradedBattle;
  readonly report: BattleReport;
  readonly site: TerritorySite;
}

/** C14: the full record of one battle. */
export function battleOutcome(battle: FoughtBattle, site: BattleSite, report: BattleReport): D6BattleOutcome {
  return {
    attacker: battle.attacker,
    attackerFactionId: battle.engagement.attackerFactionId,
    column: battle.odds.column,
    defender: battle.defender,
    demoralizedUnitIds: report.demoralizedUnitIds,
    die: battle.face.die,
    dice: "d6",
    kind: "battle",
    losses: report.losses,
    modifiers: battle.odds.modifiers,
    oddsLabel: battle.odds.oddsLabel,
    result: battle.face.result,
    retreats: report.retreats,
    row: battle.face.row,
    site,
    surrenderedUnitIds: report.surrenderedUnitIds
  };
}

/** Survivors of a side, by id. */
export function survivorIds(casualties: Casualties): ReadonlySet<UnitId> {
  return new Set(casualties.survivors.map((unit) => unit.id));
}
