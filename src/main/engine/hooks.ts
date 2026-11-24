import type { MoveRoute } from "./movement/routes";
import type { TurnScratch } from "./phases/draft";
import type {
  CombatModifier,
  FactionId,
  GameState,
  Order,
  ResourceId,
  Resources,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitTypeId,
  ValidationResult
} from "./types";

/**
 * Cross-area rule hooks. Some numbers take inputs from several slices: a battle's roll
 * modifiers, a move's allowance, whether works can grow, whether an aircraft flies, income,
 * replenishment and recruiting. A module answers for its own area through `RuleModule.hooks`;
 * the engine collects the answers of every selected module, in area order, and the
 * rules call the collectors. With no hooks registered every collector is neutral.
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
  /** R11: the battle's index in the turn while it resolves; its air battle rolls on the `air-battle` stream of that index. */
  readonly battleIndex?: number;
  readonly defenderFactionIds: readonly FactionId[];
  /** R11: the defending units, whose AA joins the air battle; absent means the defenders' units in the territory. */
  readonly defenderUnitIds?: readonly UnitId[];
  readonly diggingIn: boolean;
  /** A planning estimate's attackers whose way there is already chosen; the hooks infer the others'. */
  readonly plannedRoutes?: ReadonlyMap<UnitId, MoveRoute>;
  /** The turn's scratch while a turn resolves (bombers on support, generals on the move); absent for planning estimates. */
  readonly scratch?: TurnScratch;
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

/** M1, M9, C1: an order being validated against the start-of-turn state. */
export interface OrderHookContext extends HookContext {
  readonly order: Order;
}

/** M1, M9: an order of one kind, for the module that owns that kind. */
export interface OrderValidationContext<K extends Order["kind"] = Order["kind"]> extends HookContext {
  readonly order: Extract<Order, { readonly kind: K }>;
}

/**
 * M1, M9: a module's validators, one per order kind it owns (Move for the movement modules,
 * Recruit and Replenish for recruitment, Build for economy, Withdraw for partition, air missions
 * and Sack for air). An order kind no selected module owns is "not available in this scenario".
 */
export type OrderValidators = {
  readonly [K in Order["kind"]]?: (context: OrderValidationContext<K>) => ValidationResult;
};

/** M9: an order kind no module of the scenario's ruleset handles. */
export const unavailableOrderReason = "This order is not available in this scenario.";

/** M21, P6: an army that must leave `from` for `to`, a territory its faction held at the start of the turn. */
export interface RetreatContext extends HookContext {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly to: TerritoryId;
  /** R1: the army retreating, so the path leaves from its own pocket. */
  readonly unitId?: UnitId;
}

/** R5, $4, D28.1: what buildings change about a Replenish order. */
export interface ReplenishBonus {
  /** Hospital: more of establishment restored per turn, on top of `replenishShare`. */
  readonly capShare: number;
  /** Depot: the share taken off the price, per resource (Funds). */
  readonly discount: Readonly<Partial<Record<ResourceId, number>>>;
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
  /** R5, D28.1: a higher per-turn cap (Hospital) and a lower price (Depot). */
  readonly replenishBonus?: (context: ReplenishContext) => ReplenishBonus;
  /** R2, R3: reasons the type is locked here; empty when nothing blocks it. */
  readonly recruitRequirements?: (context: RecruitContext) => readonly string[];
  /**
   * M1, M9: the module's own order kinds, validated against the start-of-turn state. The engine
   * runs the validators of every selected module that owns the order's kind, in area order.
   */
  readonly validateOrder?: OrderValidators;
  /**
   * C1: a module's veto on an order another module (or it) has already found valid, such as a
   * move out of contested ground. Undefined means the module has no view on this order.
   */
  readonly orderVerdict?: (context: OrderHookContext) => ValidationResult | undefined;
  /** P6: false when the army has no path from `from` to `to` (through its own sub-territories). */
  readonly retreatAllowed?: (context: RetreatContext) => boolean;
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
    if (bonus === undefined) return sum;
    const discount: Partial<Record<ResourceId, number>> = { ...sum.discount };
    for (const [resource, share] of Object.entries(bonus.discount) as [ResourceId, number][]) discount[resource] = (discount[resource] ?? 0) + share;
    return { capShare: sum.capShare + bonus.capShare, discount };
  }, { capShare: 0, discount: {} });
}

export function hookedRecruitRequirements(context: RecruitContext): readonly string[] {
  return hooksOf(context.scenario).flatMap((hooks) => hooks.recruitRequirements?.(context) ?? []);
}

/**
 * M1, M9: the owning modules' validation of an order: the first refusal in area order, else
 * acceptance; undefined when no selected module owns the order's kind.
 */
export function hookedValidateOrder(context: OrderHookContext): ValidationResult | undefined {
  // Each validator is typed for its own kind; the lookup by `order.kind` keeps them matched.
  const owners = hooksOf(context.scenario).flatMap((hooks) => {
    const validate = hooks.validateOrder?.[context.order.kind] as ((owned: OrderHookContext) => ValidationResult) | undefined;
    return validate === undefined ? [] : [validate];
  });
  if (owners.length === 0) return undefined;
  for (const validate of owners) {
    const result = validate(context);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * The modules' verdict on an order: the first refusal in area order, else acceptance when any
 * module accepts it, else undefined (no module has a view).
 */
export function hookedOrderVerdict(context: OrderHookContext): ValidationResult | undefined {
  const verdicts = hooksOf(context.scenario).flatMap((hooks) => hooks.orderVerdict?.(context) ?? []);
  return verdicts.find((verdict) => !verdict.ok) ?? verdicts.find((verdict) => verdict.ok);
}

/** P6: every module must allow the retreat. */
export function hookedRetreatAllowed(context: RetreatContext): boolean {
  return hooksOf(context.scenario).every((hooks) => hooks.retreatAllowed?.(context) ?? true);
}
