import { territoriesWithin } from "../engine/air/pieces";
import { oddsForValues } from "../engine/combat";
import { oddsFor } from "../engine/combat/odds";
import { lastColumn } from "../engine/combat/values";
import { type BattleOdds, battleOdds } from "../engine/d20/odds";
import { fightingValue } from "../engine/d20/rules";
import { projectedHoldings } from "../engine/economy/upkeep";
import { inPoints } from "../engine/carry";
import { requireUnitType } from "../engine/lookup";
import { unitBasics } from "../engine/recruitment/rules";
import type { CombatRole, D20Rules, FactionId, GameState, Order, RecruitOrder, ResourceId, Resources, Scenario, TerritoryId, UnitTypeDefinition } from "../engine/types";
import { carriesOf, typeCanFight } from "../engine/units/fighting";
import type { Assessment } from "./assessment";
import { expectedLosses, partialGround } from "./attacks";

/**
 * D6, N8: what a recruit is worth to the computer player: how much better one more unit of a type
 * makes the battles its site would fight, read from the odds table, for its price. Attack and roll
 * bonuses (guns, tanks, Ground Support) count in the attacks it could join, defence where enemies
 * next door threaten the site. Price counts the upkeep of the turns ahead, and each resource by how
 * scarce it is. The same odds and weights judge the attacks themselves (`attacks.ts`).
 */

/** A battle a recruit site's units would fight, as the odds table sees it. */
export interface SiteBattle {
  /** Steps from the site to the battle: none where it defends. */
  readonly distance: number;
  /** The value of the strongest enemies there, in the other role. */
  readonly enemy: number;
  /** The faction's own value near the site, what is in training and ordered included. */
  readonly own: number;
  /** The faction's role in it. */
  readonly role: CombatRole;
  /** The situational modifiers on the roll: works, barricades, the amphibious penalty. */
  readonly roll: number;
  /** What the ground is worth to the faction. */
  readonly stake: number;
}

/** What the battles a recruit site feeds look like. */
export interface SiteBattles {
  readonly battles: readonly SiteBattle[];
  /** The own units like the type near enough to join the same battle, in training and ordered this turn included. */
  readonly count: (type: UnitTypeDefinition) => number;
  /** The own defence standing at the site, what is in training and ordered there included. */
  readonly defence: number;
  /** Of that defence, what stands there by the next turn. */
  readonly ready: number;
  /** Whether own units near the site can attack without it: a gun alone attacks nothing. */
  readonly led: boolean;
}

/** What every site's battles are read from, worked out once a turn. */
export interface RecruitBoard {
  readonly assessment: Assessment;
  /** Every own unit on the map or in training: its type, its place and its values. */
  readonly own: readonly Placed[];
  readonly scenario: Scenario;
  readonly state: GameState;
  /** Other factions' stacks, by territory and faction. */
  readonly stacks: ReadonlyMap<TerritoryId, ReadonlyMap<FactionId, { readonly attack: number; readonly defence: number }>>;
  /** The situational modifiers of an attack there, remembered per attacker. */
  readonly rolls: Map<string, number>;
}

interface Placed {
  readonly attack: number;
  readonly defence: number;
  readonly territoryId: TerritoryId;
  /** Turns until it stands there: 0 for a unit on the map. */
  readonly turns: number;
  readonly type: UnitTypeDefinition;
}

const valueOf = (type: UnitTypeDefinition, role: CombatRole): number => (type.kind === "ground" ? type[role] : 0);
const placed = (type: UnitTypeDefinition, territoryId: TerritoryId, turns: number): Placed => ({ attack: valueOf(type, "attack"), defence: valueOf(type, "defence"), territoryId, turns, type });
const attacksAlone = (type: UnitTypeDefinition): boolean => typeCanFight(type) && !type.effects.some((effect) => effect.kind === "cannot-attack-alone");
const supportsBattles = (type: UnitTypeDefinition): boolean => type.effects.some((effect) => effect.kind === "battle-support");

export function recruitBoard(scenario: Scenario, state: GameState, assessment: Assessment): RecruitBoard {
  const own: Placed[] = [];
  const stacks = new Map<TerritoryId, Map<FactionId, { attack: number; defence: number }>>();
  for (const unit of Object.values(state.units)) {
    const type = unitBasics(scenario, state, unit.id)?.type;
    if (type === undefined) continue;
    const values = type.kind === "ground"
      // M23: a demoralized enemy cannot attack this turn; the own side's units recover.
      ? { attack: unit.factionId !== assessment.factionId && unit.morale.demoralized ? 0 : fightingValue(scenario, state.raised, unit, "attack"), defence: fightingValue(scenario, state.raised, unit, "defence") }
      : { attack: 0, defence: 0 };
    if (unit.factionId === assessment.factionId) own.push({ ...values, territoryId: unit.territoryId, turns: 0, type });
    else if (typeCanFight(type)) {
      const there = stacks.get(unit.territoryId) ?? new Map<FactionId, { attack: number; defence: number }>();
      const before = there.get(unit.factionId) ?? { attack: 0, defence: 0 };
      stacks.set(unit.territoryId, there.set(unit.factionId, { attack: before.attack + values.attack, defence: before.defence + values.defence }));
    }
  }
  for (const item of state.training) if (item.factionId === assessment.factionId) own.push(placed(requireUnitType(scenario, item.typeId), item.territoryId, item.turnsLeft));
  return { assessment, own, rolls: new Map(), scenario, stacks, state };
}

/** The situational modifiers of one faction's attack on a territory. */
function rollOf({ rolls, scenario, state }: RecruitBoard, attackerFactionId: FactionId, defenderFactionIds: readonly FactionId[], territoryId: TerritoryId): number {
  const key = `${attackerFactionId}|${territoryId}`;
  const known = rolls.get(key);
  if (known !== undefined) return known;
  const roll = oddsForValues(scenario, state, { attackerFactionId, defenderFactionIds, diggingIn: true, territoryId }, 1, 1).rollModifier;
  rolls.set(key, roll);
  return roll;
}

/**
 * The battles near a site: an attack with the units there and next door on each stack other factions
 * have within the profile's offensive reach (on any stack, where none is in reach), and the defence of
 * the site against each faction next door. Only units that can fight count.
 */
export function siteBattles(board: RecruitBoard, site: TerritoryId, ordered: readonly RecruitOrder[]): SiteBattles {
  const { assessment, scenario, stacks } = board;
  const near = territoriesWithin(scenario, site, 1);
  const all = [...board.own, ...ordered.map((order) => {
    const type = requireUnitType(scenario, order.unitTypeId);
    return placed(type, order.territoryId, type.recruit?.trainingTurns ?? 0);
  })];
  const distances = territoriesWithin(scenario, site, scenario.territories.length);
  const mass = all.filter((unit) => near.has(unit.territoryId));
  const attack = mass.reduce((sum, unit) => sum + unit.attack, 0);
  const here = mass.filter((unit) => unit.territoryId === site);
  const defence = here.reduce((sum, unit) => sum + unit.defence, 0);
  const ready = here.reduce((sum, unit) => sum + (unit.turns <= 1 ? unit.defence : 0), 0);
  const targets = [...stacks].flatMap(([territoryId, there]): SiteBattle[] => {
    const distance = distances.get(territoryId);
    if (distance === undefined) return [];
    const enemy = [...there.values()].reduce((sum, stack) => sum + stack.defence, 0);
    return [{ distance: Math.max(1, distance), enemy, own: attack, role: "attack", roll: rollOf(board, assessment.factionId, [...there.keys()], territoryId), stake: assessment.stake(territoryId) }];
  });
  const inReach = targets.filter((battle) => battle.distance <= assessment.profile.offensive.reach);
  const threats = new Map<FactionId, number>();
  for (const [id, distance] of near) {
    if (distance === 0) continue;
    for (const [factionId, stack] of stacks.get(id) ?? []) threats.set(factionId, (threats.get(factionId) ?? 0) + stack.attack);
  }
  const defences = [...threats].map(([factionId, enemy]): SiteBattle =>
    ({ distance: 0, enemy, own: defence, role: "defence", roll: rollOf(board, factionId, [assessment.factionId], site), stake: assessment.stake(site) }));
  return {
    battles: [...(inReach.length > 0 ? inReach : targets), ...defences],
    count: (type) => {
      const reach = type.air === undefined ? near : territoriesWithin(scenario, site, type.air.range);
      // Ground Support is capped over a battle whatever flies it (`air.supportMax`); other bonuses count their own type.
      const alike = (other: UnitTypeDefinition): boolean => (supportsBattles(type) ? supportsBattles(other) : other.id === type.id);
      return all.filter((unit) => reach.has(unit.territoryId) && alike(unit.type)).length;
    },
    defence,
    ready,
    led: mass.some((unit) => attacksAlone(unit.type))
  };
}

type Outcome = Pick<BattleOdds, "expected" | "gainChance" | "takeChance">;

/** A ratio at which the odds table moves a step: a new column, or a penalty less below even odds. */
interface OddsStep {
  readonly attack: number;
  readonly defence: number;
}

/** The longest odds the smoothing tells apart, against either side. */
const longestOdds = 16;

/** The steps of the odds table, the worst for the attacker first (`oddsFor`). */
const oddsSteps: readonly OddsStep[] = [
  ...Array.from({ length: longestOdds - 1 }, (_, index): OddsStep => ({ attack: 1, defence: longestOdds - index })),
  ...Array.from({ length: lastColumn }, (_, index): OddsStep => ({ attack: index + 1, defence: 1 }))
].filter((step, index, all) => {
  const before = all[index - 1];
  const level = ({ attack, defence }: OddsStep): number => { const odds = oddsFor(attack, defence); return odds.column - odds.halvings; };
  return before === undefined || level(step) !== level(before);
});

const outcomeMemo = new WeakMap<D20Rules, Map<string, Outcome>>();

/** The odds at one step of the table with a modifier on the roll, remembered for each table. */
function outcomeAt(rules: D20Rules, step: number, roll: number): Outcome {
  const memo = outcomeMemo.get(rules) ?? new Map<string, Outcome>();
  outcomeMemo.set(rules, memo);
  const key = `${String(step)}|${String(roll)}`;
  const known = memo.get(key);
  if (known !== undefined) return known;
  const { attack, defence } = oddsSteps[step] ?? { attack: 1, defence: 1 };
  const outcome = battleOdds(rules, attack, defence, [{ kind: "odds-overflow", roll }]);
  memo.set(key, outcome);
  return outcome;
}

/**
 * The odds for a ratio of attack to defence, smoothed between the table's steps. The table moves
 * only when a side doubles or so, so most single units change nothing in it; smoothed, each counts
 * its share of the way to the next column, as a force built over several turns would.
 */
export function smoothOdds(rules: D20Rules, ratio: number, roll: number): Outcome {
  const above = oddsSteps.findIndex((step) => step.attack / step.defence > ratio);
  if (above === 0) return outcomeAt(rules, 0, roll);
  if (above < 0) return outcomeAt(rules, oddsSteps.length - 1, roll);
  const ratioOf = (step: number): number => (oddsSteps[step]?.attack ?? 1) / (oddsSteps[step]?.defence ?? 1);
  const share = (ratio - ratioOf(above - 1)) / (ratioOf(above) - ratioOf(above - 1));
  const [from, to] = [outcomeAt(rules, above - 1, roll), outcomeAt(rules, above, roll)];
  const mix = (low: number, high: number): number => low + (high - low) * share;
  return {
    expected: {
      attackerDemoralized: mix(from.expected.attackerDemoralized, to.expected.attackerDemoralized),
      attackerLoss: mix(from.expected.attackerLoss, to.expected.attackerLoss),
      defenderDemoralized: mix(from.expected.defenderDemoralized, to.expected.defenderDemoralized),
      defenderLoss: mix(from.expected.defenderLoss, to.expected.defenderLoss)
    },
    gainChance: mix(from.gainChance, to.gainChance),
    takeChance: mix(from.takeChance, to.takeChance)
  };
}

/** The roll points one more unit of the type adds to a side in a role that has `count` units that add as it does, up to each effect's most. */
export function nextRollBonus(scenario: Scenario, type: UnitTypeDefinition, count: number, role: CombatRole = "attack"): number {
  return type.effects.reduce((sum, effect) => {
    if (effect.kind === "battle-support") return sum + (role === "attack" && count < (scenario.air?.supportMax ?? Number.POSITIVE_INFINITY) ? effect.roll : 0);
    if (effect.kind !== "roll-bonus-per-points" || effect.role !== role) return sum;
    const bonus = (units: number): number => Math.min(effect.max, Math.floor((units * type[effect.role]) / effect.per) * effect.bonus);
    return sum + bonus(count + 1) - bonus(count);
  }, 0);
}

/**
 * What a battle is worth to the faction if it brought `value` more and `bonus` more on the roll: the
 * chance of the ground at its stake, part of it at `partialGround`, and what each side would lose, by
 * the profile's weights. Both sides' losses are counted on what stands there now, so a unit is worth
 * what it changes for the others; its own men are in its price.
 */
function battleWorth({ assessment, scenario }: RecruitBoard, battle: SiteBattle, value: number, bonus: number): number {
  const { demoralizedShare, enemyLoss, ownLoss } = assessment.profile.computer;
  const own = Math.max(1, battle.own + value);
  const enemy = Math.max(1, battle.enemy);
  const attacking = battle.role === "attack";
  const odds = smoothOdds(scenario.d20, attacking ? own / enemy : enemy / own, battle.roll + (attacking ? bonus : -bonus));
  const losses = expectedLosses({ ...odds, attack: attacking ? battle.own : enemy, defence: attacking ? enemy : battle.own }, demoralizedShare);
  const ground = battle.stake * (odds.takeChance + partialGround * (odds.gainChance - odds.takeChance));
  return attacking
    ? ground + enemyLoss * losses.defender - ownLoss * losses.attacker
    : -ground + enemyLoss * losses.attacker - ownLoss * losses.defender;
}

/** Territories a unit of the type covers in a turn: two with transport or on horseback. */
const paceOf = (type: UnitTypeDefinition): number => (carriesOf(type) > 0 || type.effects.some((effect) => effect.kind === "mobile") ? 2 : 1);

/**
 * The marginal gain of one more unit of the type at a site: in the attack it would help most, and in
 * the defence of the site against the faction that threatens it most, each less for the turns until
 * it can fight there.
 */
export function marginalGain(board: RecruitBoard, type: UnitTypeDefinition, near: SiteBattles): number {
  const { scenario } = board;
  const count = near.count(type);
  const best = { attack: 0, defence: 0 };
  for (const battle of near.battles) {
    if (battle.role === "attack" && (type.air === undefined ? !near.led && !attacksAlone(type) : battle.distance > type.air.range)) continue;
    const marching = type.air === undefined ? Math.max(0, Math.ceil(battle.distance / paceOf(type)) - 1) : 0;
    const delay = (type.recruit?.trainingTurns ?? 0) + marching;
    const gain = battleWorth(board, battle, valueOf(type, battle.role), nextRollBonus(scenario, type, count, battle.role)) - battleWorth(board, battle, 0, 0);
    best[battle.role] = Math.max(best[battle.role], gain / (1 + board.assessment.profile.recruits.delayDrag * delay));
  }
  return best.attack + best.defence;
}

/**
 * What the faction can spend on recruits over the profile's `upkeepHorizon`: its stock less what is
 * planned, and its income less its army's upkeep in each turn of it. At least a point, so a resource that runs out is dear.
 */
export function recruitSupply(scenario: Scenario, state: GameState, assessment: Assessment, planned: readonly Order[]): Resources {
  const { factionId, profile } = assessment;
  const supply = inPoints(projectedHoldings(scenario, state, factionId, planned, profile.recruits.upkeepHorizon));
  return Object.fromEntries(scenario.resources.map(({ id }) => [id, Math.max(1, supply[id] ?? 0)]));
}

/** A type's price with the upkeep of the horizon's turns, each resource as a share of the faction's supply of it. */
export function priceOf(type: UnitTypeDefinition, supply: Resources, horizon: number): number {
  const amounts: readonly (readonly [string, number])[] = [
    ...Object.entries(type.recruit?.cost ?? {}),
    ...Object.entries(type.upkeep).map(([id, amount]) => [id, amount * horizon] as const)
  ];
  return amounts.reduce((sum, [id, amount]) => sum + amount / Math.max(1, supply[id as ResourceId] ?? 0), 0);
}

/** What one more unit of the type is worth at a site for its price; nothing for a type that can't be recruited. */
export function worthOf(board: RecruitBoard, type: UnitTypeDefinition, supply: Resources, near: SiteBattles): number {
  if (type.recruit === undefined) return 0;
  return marginalGain(board, type, near) / Math.max(0.001, priceOf(type, supply, board.assessment.profile.recruits.upkeepHorizon));
}
