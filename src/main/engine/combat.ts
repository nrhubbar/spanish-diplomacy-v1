import { citiesIn, requireUnitDefinition, requireUnitState, requireUnitType } from "./lookup";
import type {
  BattleResult,
  BattleSide,
  CombatModifier,
  CombatRole,
  CombatRules,
  FactionId,
  FactionModifier,
  GameState,
  ModifierCondition,
  Scenario,
  TerritoryId,
  UnitId,
  UnitState
} from "./types";

/**
 * Battle arithmetic for the m2-strength ruleset: army values, odds, modifiers, and the
 * outcome distribution read from the scenario's `combat` block. Pure and roll-free; battle
 * resolution (dice, results, retreats) builds on these. Rule ids refer to the spec
 * (`project/specs/scenario-package.md`).
 */

/** The faces of the battle die. */
export const dieFaces = [1, 2, 3, 4, 5, 6] as const;

/** Highest odds column (6:1) and highest table row (modified roll 6). */
export const lastColumn = 6;
export const lastRow = 6;

/** M16: results in which the attacker succeeds and claims the territory. */
export const successfulResults = [
  "defender-demoralized",
  "defender-exchange",
  "defender-eliminated"
] as const satisfies readonly BattleResult[];

export function isSuccessful(result: BattleResult): boolean {
  return successfulResults.some((candidate) => candidate === result);
}

/**
 * M12 (C4, C5, C6): type value times strength over full strength, times the demoralization
 * factor when demoralized, rounded once to the nearest whole number (halves round up), and
 * never below 1.
 */
export function armyValue(scenario: Scenario, unit: UnitState, role: CombatRole): number {
  const definition = requireUnitDefinition(scenario, unit.id);
  const type = requireUnitType(scenario, definition.type);
  const base = role === "attack" ? type.attack : type.defence;
  const morale = unit.morale.demoralized ? scenario.combat.demoralizationFactor : 1;
  return Math.max(1, Math.round(((base * unit.strength) / definition.fullStrength) * morale));
}

/**
 * M12: one side of a battle. Each army fights from its `territoryId` in the given state, so
 * pass start-of-turn states for armies that moved. The side's value is the sum of its armies'
 * rounded values.
 */
export function battleSide(scenario: Scenario, units: readonly UnitState[], role: CombatRole): BattleSide {
  const armies = units.map((unit) => ({
    factionId: unit.factionId,
    from: unit.territoryId,
    unitId: unit.id,
    value: armyValue(scenario, unit, role)
  }));
  return { armies, value: armies.reduce((sum, army) => sum + army.value, 0) };
}

/** M13: the odds of one battle, always rounded in the defender's favour. */
export interface Odds {
  /** Table column: 0 below 1:1, otherwise the odds up to 6:1. */
  readonly column: number;
  /** Below 1:1, how many times the rounded odds halve from 1:1 (1:2 and 1:3 are 1; 1:4 to 1:7 are 2). */
  readonly halvings: number;
  /** The rounded odds as players read them: "3:1", "8:1", or "1:3". */
  readonly label: string;
  /** Steps beyond 6:1, each added to the roll. */
  readonly overflow: number;
}

/**
 * M13: at or above 1:1 the odds are floor(attack / defence):1; below it they are
 * 1:ceil(defence / attack). Both sides must be positive whole numbers.
 */
export function oddsFor(attack: number, defence: number): Odds {
  requireSideValue(attack, "attack");
  requireSideValue(defence, "defence");
  if (attack >= defence) {
    const ratio = Math.floor(attack / defence);
    return {
      column: Math.min(ratio, lastColumn),
      halvings: 0,
      label: `${String(ratio)}:1`,
      overflow: Math.max(0, ratio - lastColumn)
    };
  }
  const against = Math.ceil(defence / attack);
  return { column: 0, halvings: halvingsOf(against), label: `1:${String(against)}`, overflow: 0 };
}

/** M14: the roll modifiers the odds themselves produce (overflow above 6:1, halving below 1:1). */
export function oddsModifiers(combat: CombatRules, odds: Odds): readonly CombatModifier[] {
  const modifiers: CombatModifier[] = [];
  if (odds.overflow > 0) {
    modifiers.push({ kind: "odds-overflow", roll: odds.overflow });
  }
  const penalty = odds.halvings * combat.belowOneToOne.rollPenalty;
  if (penalty > 0) {
    modifiers.push({ halvings: odds.halvings, kind: "odds-halving", roll: -penalty });
  }
  return modifiers;
}

/**
 * Who fights where, for the modifiers that depend on the situation. Head-on meeting battles
 * (M20) take no situational modifiers at all, so they need no context.
 */
export interface BattleContext {
  readonly attackerFactionId: FactionId;
  readonly defenderFactionIds: readonly FactionId[];
  /** Whether the territory's works count: false for empty-territory entries (M19). */
  readonly diggingIn: boolean;
  readonly territoryId: TerritoryId;
}

/**
 * M14, M22, M24: the dug-in bonus, when the defenders include the faction the works belong
 * to, and every faction modifier whose condition holds in the start-of-turn state.
 */
export function situationalModifiers(scenario: Scenario, state: GameState, context: BattleContext): readonly CombatModifier[] {
  const modifiers: CombatModifier[] = [];
  const works = state.fortification[context.territoryId];
  if (context.diggingIn && works !== undefined && works.level > 0 && context.defenderFactionIds.includes(works.factionId)) {
    modifiers.push({ kind: "dug-in", level: works.level, roll: -works.level });
  }
  for (const modifier of scenario.combat.factionModifiers) {
    if (!conditions[modifier.when](scenario, state, modifier.factionId, context.territoryId)) {
      continue;
    }
    if (modifier.attack > 0 && modifier.factionId === context.attackerFactionId) {
      modifiers.push(factionModifier(modifier, "attack", modifier.attack));
    }
    if (modifier.defence > 0 && context.defenderFactionIds.includes(modifier.factionId)) {
      modifiers.push(factionModifier(modifier, "defence", -modifier.defence));
    }
  }
  return modifiers;
}

/** The net change to the attacker's die roll. */
export function rollModifier(modifiers: readonly CombatModifier[]): number {
  return modifiers.reduce((sum, modifier) => sum + modifier.roll, 0);
}

/** M15: the table row for a die: the die plus the modifier, clamped to rows 0 to 6. */
export function tableRow(die: number, modifier: number): number {
  return Math.min(lastRow, Math.max(0, die + modifier));
}

/** M15: the result in a column and row of the scenario's table. */
export function tableResult(combat: CombatRules, column: number, row: number): BattleResult {
  const result = combat.table[column]?.[row];
  if (result === undefined) {
    throw new Error(`Invariant violated: no table entry at column ${String(column)}, row ${String(row)}.`);
  }
  return result;
}

/** One face of the die and what it produces. */
export interface DieFace {
  readonly die: number;
  readonly result: BattleResult;
  readonly row: number;
}

/** Everything about a battle that is known before the die is rolled. */
export interface BattleOdds {
  readonly attack: number;
  /** Probability of each result, in [0, 1]; the values sum to 1. */
  readonly chances: Readonly<Record<BattleResult, number>>;
  readonly column: number;
  readonly defence: number;
  /** One entry per die face, 1 to 6. */
  readonly faces: readonly DieFace[];
  /** Situational modifiers first, then the odds modifiers. */
  readonly modifiers: readonly CombatModifier[];
  readonly oddsLabel: string;
  readonly rollModifier: number;
  /** Chance the attacker succeeds: defender demoralized, exchange, or eliminated. */
  readonly takeChance: number;
}

/** M13-M16: odds, modifiers, and the full outcome distribution for given side values. */
export function battleOdds(
  combat: CombatRules,
  attack: number,
  defence: number,
  situational: readonly CombatModifier[]
): BattleOdds {
  const odds = oddsFor(attack, defence);
  const modifiers = [...situational, ...oddsModifiers(combat, odds)];
  const modifier = rollModifier(modifiers);
  const faces = dieFaces.map((die): DieFace => {
    const row = tableRow(die, modifier);
    return { die, result: tableResult(combat, odds.column, row), row };
  });
  const chance = (result: BattleResult): number => faces.filter((face) => face.result === result).length / faces.length;
  const chances: Record<BattleResult, number> = {
    "attacker-attrition": chance("attacker-attrition"),
    "attacker-demoralized": chance("attacker-demoralized"),
    "attacker-eliminated": chance("attacker-eliminated"),
    "both-demoralized": chance("both-demoralized"),
    "defender-demoralized": chance("defender-demoralized"),
    "defender-eliminated": chance("defender-eliminated"),
    "defender-exchange": chance("defender-exchange")
  };
  return {
    attack,
    chances,
    column: odds.column,
    defence,
    faces,
    modifiers,
    oddsLabel: odds.label,
    rollModifier: modifier,
    takeChance: faces.filter((face) => isSuccessful(face.result)).length / faces.length
  };
}

/** The face a rolled die shows. */
export function faceFor(odds: BattleOdds, die: number): DieFace {
  const face = odds.faces.find((candidate) => candidate.die === die);
  if (face === undefined) {
    throw new Error(`Invariant violated: ${String(die)} is not a face of the die.`);
  }
  return face;
}

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

type ConditionCheck = (scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId) => boolean;

/** M24: when each faction-modifier condition holds, judged from the start-of-turn state. */
const conditions: Readonly<Record<ModifierCondition, ConditionCheck>> = {
  "holds-controlled-city": (scenario, state, factionId, territoryId) =>
    citiesIn(scenario, territoryId).some((city) => state.cityControl[city.id] === factionId)
};

function factionModifier(modifier: FactionModifier, role: CombatRole, roll: number): CombatModifier {
  return { factionId: modifier.factionId, kind: "faction", modifierId: modifier.id, name: modifier.name, role, roll };
}

/** How many times `against` can be halved and stay at or above 1, so 1:2 is one halving. */
function halvingsOf(against: number): number {
  let halvings = 0;
  while (2 ** (halvings + 1) <= against) {
    halvings += 1;
  }
  return halvings;
}

function requireSideValue(value: number, side: CombatRole): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invariant violated: the ${side} value must be a positive whole number, not ${String(value)}.`);
  }
}
