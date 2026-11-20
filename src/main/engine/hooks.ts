import type {
  CombatModifier,
  FactionId,
  GameState,
  Resources,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitTypeId
} from "./types";

/**
 * Cross-area rule hooks. Some numbers take inputs from several slices: a battle's roll
 * modifiers, a move's allowance, whether works can grow, whether an aircraft flies, income,
 * replenishment and recruiting. A module answers for its own area through `RuleModule.hooks`;
 * the engine collects the answers of every selected module, in area order, and both the d6 and
 * the d20 rules call the collectors. With no hooks registered every collector is neutral.
 */

/** What every hook sees: the scenario and the start-of-turn state. */
export interface HookContext {
  readonly scenario: Scenario;
  readonly state: GameState;
}

/** D3-D7: a battle about to be fought, or estimated. */
export interface CombatHookContext extends HookContext {
  readonly attackerFactionId: FactionId;
  readonly attackerUnitIds?: readonly UnitId[];
  readonly defenderFactionIds: readonly FactionId[];
  readonly diggingIn: boolean;
  readonly territoryId: TerritoryId;
}

/** M22, T4: whether a holder's works may grow this turn. */
export interface DigInContext extends HookContext {
  readonly factionId: FactionId;
  readonly territoryId: TerritoryId;
}

/** M1: an army about to move. */
export interface AllowanceContext extends HookContext {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly unitIds: readonly UnitId[];
}

/** M5, T4: a sea leg between two territories. */
export interface SeaContext extends HookContext {
  readonly from: TerritoryId;
  readonly to: TerritoryId;
}

/** U2: an aircraft about to fly. */
export interface GroundedContext extends HookContext {
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** $2, U3: a faction's income before the hooks change it. */
export interface IncomeContext extends HookContext {
  readonly factionId: FactionId;
  readonly income: Resources;
}

/** R5: a unit replenishing in a territory. */
export interface ReplenishContext extends HookContext {
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** R2, R3: a unit type a faction wants to recruit at a capital. */
export interface RecruitContext extends HookContext {
  readonly factionId: FactionId;
  readonly subTerritoryId: SubTerritoryId;
  readonly territoryId: TerritoryId;
  readonly unitTypeId: UnitTypeId;
}

/** R5, $4, D7: extra replenishment, as shares of establishment. */
export interface ReplenishBonus {
  readonly capShare: number;
  readonly rateShare: number;
}

export interface RuleHooks {
  /** D4, D5, D7: roll modifiers to add (general, trait, barricades, unit bonuses, weather, amphibious, air support, buildings). */
  readonly combatModifiers?: (context: CombatHookContext) => readonly CombatModifier[];
  /** M1: change to the army's allowance in territories (trucks +1, terrain and weather -1). */
  readonly allowanceDelta?: (context: AllowanceContext) => number;
  /** T4: false stops the works growing (Snow, Severe cold). */
  readonly canDigIn?: (context: DigInContext) => boolean;
  /** U2: true grounds the aircraft (Mud and Snow without a paved airfield). */
  readonly grounded?: (context: GroundedContext) => boolean;
  /** U3: change to the faction's income (raid cuts, negative). */
  readonly incomeDelta?: (context: IncomeContext) => Resources;
  /** R5, D7: extra replenishment (Hospital, Depot). */
  readonly replenishBonus?: (context: ReplenishContext) => ReplenishBonus;
  /** R2, R3: reasons the type is locked here; empty when nothing blocks it. */
  readonly recruitRequirements?: (context: RecruitContext) => readonly string[];
  /** M5, T4: true closes the sea between the two territories this turn (winter Rain on a coastal zone). */
  readonly seaClosed?: (context: SeaContext) => boolean;
}

const hooksOf = (scenario: Scenario): readonly RuleHooks[] => scenario.modules.flatMap((module) => (module.hooks === undefined ? [] : [module.hooks]));

export function hookedCombatModifiers(context: CombatHookContext): readonly CombatModifier[] {
  return hooksOf(context.scenario).flatMap((hooks) => hooks.combatModifiers?.(context) ?? []);
}

export function hookedAllowanceDelta(context: AllowanceContext): number {
  return hooksOf(context.scenario).reduce((sum, hooks) => sum + (hooks.allowanceDelta?.(context) ?? 0), 0);
}

export function hookedCanDigIn(context: DigInContext): boolean {
  return hooksOf(context.scenario).every((hooks) => hooks.canDigIn?.(context) ?? true);
}

export function hookedGrounded(context: GroundedContext): boolean {
  return hooksOf(context.scenario).some((hooks) => hooks.grounded?.(context) ?? false);
}

/** The income after every hook's change, never below zero. */
export function hookedIncome(context: IncomeContext): Resources {
  const total: Record<string, number> = { ...context.income };
  for (const hooks of hooksOf(context.scenario)) {
    for (const [resource, delta] of Object.entries(hooks.incomeDelta?.(context) ?? {})) total[resource] = Math.max(0, (total[resource] ?? 0) + delta);
  }
  return total;
}

export function hookedReplenishBonus(context: ReplenishContext): ReplenishBonus {
  return hooksOf(context.scenario).reduce<ReplenishBonus>((sum, hooks) => {
    const bonus = hooks.replenishBonus?.(context);
    return bonus === undefined ? sum : { capShare: sum.capShare + bonus.capShare, rateShare: sum.rateShare + bonus.rateShare };
  }, { capShare: 0, rateShare: 0 });
}

export function hookedRecruitRequirements(context: RecruitContext): readonly string[] {
  return hooksOf(context.scenario).flatMap((hooks) => hooks.recruitRequirements?.(context) ?? []);
}

/** M5, T4: any one hook closes the sea. */
export function hookedSeaClosed(context: SeaContext): boolean {
  return hooksOf(context.scenario).some((hooks) => hooks.seaClosed?.(context) ?? false);
}
