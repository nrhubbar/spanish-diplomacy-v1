import { antiAirRoll } from "../engine/air/groundSupport";
import { territoriesWithin } from "../engine/air/pieces";
import { oddsForValues } from "../engine/combat";
import { oddsFor } from "../engine/combat/odds";
import { lastColumn } from "../engine/combat/values";
import { type BattleOdds, battleOdds } from "../engine/d20/odds";
import { fightingValue } from "../engine/d20/rules";
import { projectedHoldings } from "../engine/economy/upkeep";
import { inPoints } from "../engine/carry";
import { neighborsOf, requireUnitType } from "../engine/lookup";
import { recruitableTypes, unitBasics } from "../engine/recruitment/rules";
import type { CombatRole, D20Rules, FactionId, GameState, Order, RecruitOrder, ResourceId, Resources, Scenario, TerritoryId, UnitTypeDefinition } from "../engine/types";
import { carriesOf, isTruckType, typeCanFight } from "../engine/units/fighting";
import { defendedBy, fliesOver, noSupport, raidGain, raidsSpared, type RaidTarget, supportFrom, type SupportOdds } from "./airWorth";
import type { Assessment } from "./assessment";
import { expectedLosses, partialGround } from "./attacks";
import { motorReach } from "./reach";

/**
 * D6, N8: what a recruit is worth to the computer player: how much better one more unit of a type
 * makes the battles its site would fight, read from the odds table, for its price. Attack and roll
 * bonuses (guns, tanks, Ground Support) count in the attacks it could join, defence where enemies
 * next door threaten the site. Aircraft and anti-air also count raids (`airWorth.ts`), and trucks the
 * battles they carry foot to, turn after turn. Price counts the upkeep of the turns ahead, and each resource by
 * how scarce it is. The same odds and weights judge the attacks themselves (`attacks.ts`).
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
  /** The chance that the attacker's Ground Support flies to this battle: 1 for the faction's own attacks, which it chooses. */
  readonly flown: number;
  /** R11: that Ground Support after the air battle, with one more unit of the type at the site. */
  readonly support: (type?: UnitTypeDefinition) => SupportOdds;
  readonly territoryId: TerritoryId;
}

/** What the battles a recruit site feeds look like. */
export interface SiteBattles {
  /** Every own unit on the map, in training or ordered this turn. */
  readonly all: readonly Placed[];
  /** U3: the best AA at the site, what is in training and ordered there included. */
  readonly antiAir: number;
  readonly battles: readonly SiteBattle[];
  /** The own units of the type near enough to join the same battle, in training and ordered this turn included. */
  readonly count: (type: UnitTypeDefinition) => number;
  /** The own defence standing at the site, what is in training and ordered there included. */
  readonly defence: number;
  /** Of that defence, what stands there by the next turn. */
  readonly ready: number;
  /** M1: the foot at the site, after this turn's planned orders, that no transport there carries, the strongest attackers first. */
  readonly foot: readonly Placed[];
  /** Whether own units near the site can attack without it: a gun alone attacks nothing. */
  readonly led: boolean;
  /** The share of the type's worth the profile counts (`shareKept`), for the force the faction has and has ordered. */
  readonly kept: (type: UnitTypeDefinition) => number;
  /** The types of the own fighters that could fly Patrol over the site. */
  readonly patrols: readonly UnitTypeDefinition[];
  readonly site: TerritoryId;
}

/** What every site's battles are read from, worked out once a turn. */
export interface RecruitBoard {
  /** Other factions' aircraft on the map. */
  readonly aircraft: readonly (Placed & { readonly factionId: FactionId })[];
  /** Other factions' best AA, by territory. */
  readonly antiAir: ReadonlyMap<TerritoryId, number>;
  readonly assessment: Assessment;
  /** Every own unit on the map or in training: its type, its place and its values. */
  readonly own: readonly Placed[];
  /** What resources are worth in combat points: what they would buy the faction of the type that gives it most for its price. */
  readonly points: (amounts: Resources) => number;
  /** What raids are read from, remembered: the targets in range of a site, and the raids its territory can expect. */
  readonly raidTargets: Map<string, readonly RaidTarget[]>;
  readonly raidThreat: Map<TerritoryId, number>;
  readonly scenario: Scenario;
  readonly state: GameState;
  /** Other factions' stacks, by territory and faction. */
  readonly stacks: ReadonlyMap<TerritoryId, ReadonlyMap<FactionId, { readonly attack: number; readonly defence: number }>>;
  /** The situational modifiers of an attack there, remembered per attacker. */
  readonly rolls: Map<string, number>;
}

/** A unit on the board or on its way there. */
export interface Placed {
  readonly attack: number;
  readonly defence: number;
  readonly territoryId: TerritoryId;
  /** Where it stands once this turn's planned orders are done. */
  readonly next: TerritoryId;
  /** Turns until it stands there: 0 for a unit on the map. */
  readonly turns: number;
  readonly type: UnitTypeDefinition;
}

const valueOf = (type: UnitTypeDefinition, role: CombatRole): number => (type.kind === "ground" ? type[role] : 0);
const placed = (type: UnitTypeDefinition, territoryId: TerritoryId, turns: number): Placed => ({ attack: valueOf(type, "attack"), defence: valueOf(type, "defence"), next: territoryId, territoryId, turns, type });
const attacksAlone = (type: UnitTypeDefinition): boolean => typeCanFight(type) && !type.effects.some((effect) => effect.kind === "cannot-attack-alone");

/** Units that fight and need carrying (M1). */
export const isFootType = (type: UnitTypeDefinition): boolean => typeCanFight(type) && carriesOf(type) === 0 && !type.effects.some((effect) => effect.kind === "mobile");

/** The price share at the faction's supply that its best-valued fighting type asks for a combat point, turned round: combat points for a whole supply. */
function pointsFor(scenario: Scenario, state: GameState, assessment: Assessment): RecruitBoard["points"] {
  let known: { readonly rate: number; readonly supply: Resources } | undefined;
  return (amounts) => {
    if (known === undefined) {
      const supply = recruitSupply(scenario, state, assessment, []);
      const rates = recruitableTypes(scenario)
        .filter((type) => attacksAlone(type) && (type.recruit?.factionIds?.includes(assessment.factionId) ?? true))
        .map((type) => (valueOf(type, "attack") + valueOf(type, "defence")) / 2 / Math.max(leastPrice, priceOf(type, supply, assessment.profile.recruits.upkeepHorizon)));
      known = { rate: Math.max(0, ...rates), supply };
    }
    return known.rate * shareOf(Object.entries(amounts), known.supply);
  };
}

export function recruitBoard(scenario: Scenario, state: GameState, assessment: Assessment, planned: readonly Order[] = []): RecruitBoard {
  const bound = new Map(planned.flatMap((order) => (order.kind === "move" || order.kind === "withdraw" ? [[order.unitId, order.to] as const] : [])));
  const own: Placed[] = [];
  const aircraft: (Placed & { readonly factionId: FactionId })[] = [];
  const antiAir = new Map<TerritoryId, number>();
  const stacks = new Map<TerritoryId, Map<FactionId, { attack: number; defence: number }>>();
  for (const unit of Object.values(state.units)) {
    const type = unitBasics(scenario, state, unit.id)?.type;
    if (type === undefined) continue;
    const values = type.kind === "ground"
      // M23: a demoralized enemy cannot attack this turn; the own side's units recover.
      ? { attack: unit.factionId !== assessment.factionId && unit.morale.demoralized ? 0 : fightingValue(scenario, state.raised, unit, "attack"), defence: fightingValue(scenario, state.raised, unit, "defence") }
      : { attack: 0, defence: 0 };
    const here: Placed = { ...values, next: bound.get(unit.id) ?? unit.territoryId, territoryId: unit.territoryId, turns: 0, type };
    if (unit.factionId === assessment.factionId) {
      own.push(here);
      continue;
    }
    if (type.air !== undefined) aircraft.push({ ...here, factionId: unit.factionId });
    antiAir.set(unit.territoryId, Math.max(antiAir.get(unit.territoryId) ?? 0, antiAirRoll(type)));
    if (typeCanFight(type)) {
      const there = stacks.get(unit.territoryId) ?? new Map<FactionId, { attack: number; defence: number }>();
      const before = there.get(unit.factionId) ?? { attack: 0, defence: 0 };
      stacks.set(unit.territoryId, there.set(unit.factionId, { attack: before.attack + values.attack, defence: before.defence + values.defence }));
    }
  }
  for (const item of state.training) if (item.factionId === assessment.factionId) own.push(placed(requireUnitType(scenario, item.typeId), item.territoryId, item.turnsLeft));
  return { aircraft, antiAir, assessment, own, points: pointsFor(scenario, state, assessment), raidTargets: new Map(), raidThreat: new Map(), rolls: new Map(), scenario, stacks, state };
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

/** The share of a faction's Ground Support a site can expect: these aircraft fly one mission a turn, over any of the faction's ground in their reach beside that faction's stacks, by its stake. */
function frontShare({ assessment, scenario, stacks, state }: RecruitBoard, factionId: FactionId, fliers: readonly Placed[], site: TerritoryId): number {
  const fronts = scenario.territories.filter(({ id }) => {
    const control = state.control[id];
    return id !== site && control?.kind === "controlled" && control.factionId === assessment.factionId
      && neighborsOf(scenario, id).some((neighbor) => stacks.get(neighbor.territoryId)?.has(factionId) === true)
      && fliers.some((unit) => fliesOver(scenario, unit.type, "support", unit.territoryId, id));
  });
  const here = assessment.stake(site);
  const total = fronts.reduce((sum, { id }) => sum + assessment.stake(id), here);
  return total > 0 ? here / total : 0;
}

/**
 * The battles near a site: an attack with the units there and next door on each stack other factions
 * have within the profile's offensive reach (on any stack, where none is in reach), and the defence of
 * the site against each faction next door. Only units that can fight count.
 */
export function siteBattles(board: RecruitBoard, site: TerritoryId, ordered: readonly RecruitOrder[]): SiteBattles {
  const { aircraft, assessment, scenario, stacks } = board;
  const least = assessment.profile.air.supportChance;
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
  const antiAir = Math.max(0, ...here.map((unit) => antiAirRoll(unit.type)));
  const patrols = all.filter((unit) => fliesOver(scenario, unit.type, "patrol", unit.territoryId, site)).map((unit) => unit.type);
  // M1: a truck ordered now finds at the site what stands there once this turn's orders are done.
  const staying = all.filter((unit) => unit.next === site);
  const foot = staying.filter((unit) => isFootType(unit.type)).sort((a, b) => b.attack - a.attack || a.turns - b.turns);
  const targets = [...stacks].flatMap(([territoryId, there]): SiteBattle[] => {
    const distance = distances.get(territoryId);
    if (distance === undefined) return [];
    const enemy = [...there.values()].reduce((sum, stack) => sum + stack.defence, 0);
    // R11: the faction's own aircraft in reach, and as planning reads it only the defenders' AA against them.
    const against = { antiAir: board.antiAir.get(territoryId) ?? 0, patrols: [] };
    const fliers = all.filter((unit) => fliesOver(scenario, unit.type, "support", unit.territoryId, territoryId)).map((unit) => unit.type);
    const support = (type?: UnitTypeDefinition): SupportOdds =>
      supportFrom(scenario, assessment.factionId, type !== undefined && fliesOver(scenario, type, "support", site, territoryId) ? [...fliers, type] : fliers, against, least);
    return [{ distance: Math.max(1, distance), enemy, own: attack, role: "attack", roll: rollOf(board, assessment.factionId, [...there.keys()], territoryId), stake: assessment.stake(territoryId), flown: 1, support, territoryId }];
  });
  const inReach = targets.filter((battle) => battle.distance <= assessment.profile.offensive.reach);
  const threats = new Map<FactionId, number>();
  for (const [id, distance] of near) {
    if (distance === 0) continue;
    for (const [factionId, stack] of stacks.get(id) ?? []) threats.set(factionId, (threats.get(factionId) ?? 0) + stack.attack);
  }
  const defences = [...threats].map(([factionId, enemy]): SiteBattle => {
    const fliers = aircraft.filter((unit) => unit.factionId === factionId && fliesOver(scenario, unit.type, "support", unit.territoryId, site));
    const support = (type?: UnitTypeDefinition): SupportOdds => supportFrom(scenario, factionId, fliers.map((unit) => unit.type), defendedBy({ antiAir, patrols }, type), least);
    return { distance: 0, enemy, own: defence, role: "defence", roll: rollOf(board, factionId, [assessment.factionId], site), stake: assessment.stake(site), flown: frontShare(board, factionId, fliers, site), support, territoryId: site };
  });
  return {
    all,
    antiAir,
    battles: [...(inReach.length > 0 ? inReach : targets), ...defences],
    count: (type) => mass.filter((unit) => unit.type.id === type.id).length,
    defence,
    foot: foot.slice(staying.reduce((sum, unit) => sum + carriesOf(unit.type), 0)),
    ready,
    led: mass.some((unit) => attacksAlone(unit.type)),
    kept: (type) => shareKept(board, type, all),
    patrols,
    site
  };
}

/** Whether a type brings anything to a battle: it fights, or its Ground Support does. */
const joinsBattles = (type: UnitTypeDefinition): boolean => typeCanFight(type) || type.effects.some((effect) => effect.kind === "battle-support");

/**
 * The share of a type's worth the profile counts: its `typeWorth`, less what `variety` takes for the
 * units like it the faction already has (on the map, in training and ordered). With `r` the type's
 * units against an even split of the force over every type that joins battles and the faction may
 * recruit (1 at the even split, 0 with none of it), it loses `variety * r / (1 + r)`: nothing for a
 * type it has none of, half of `variety` at the even split, and always less than all of it.
 */
function shareKept({ assessment, scenario }: RecruitBoard, type: UnitTypeDefinition, force: readonly Placed[]): number {
  const { typeWorth, variety } = assessment.profile.recruits;
  const taste = typeWorth?.[type.id] ?? 1;
  if (variety === undefined) return taste;
  const types = scenario.unitTypes.filter((other) => joinsBattles(other) && other.recruit !== undefined
    && (other.recruit.factionIds?.includes(assessment.factionId) ?? true) && (typeWorth?.[other.id] ?? 1) > 0);
  const total = force.filter((unit) => joinsBattles(unit.type)).length;
  const alike = force.filter((unit) => unit.type.id === type.id).length;
  const spread = total === 0 ? 0 : (alike * types.length) / total;
  return taste * (1 - (variety * spread) / (1 + spread));
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

/** The roll points the men of one more unit of the type add to a side in a role that has `count` of them, up to each effect's most. Ground Support is the battle's (`SiteBattle.support`). */
export function nextRollBonus(type: UnitTypeDefinition, count: number, role: CombatRole = "attack"): number {
  return type.effects.reduce((sum, effect) => {
    if (effect.kind !== "roll-bonus-per-points" || effect.role !== role) return sum;
    const bonus = (units: number): number => Math.min(effect.max, Math.floor((units * type[effect.role]) / effect.per) * effect.bonus);
    return sum + bonus(count + 1) - bonus(count);
  }, 0);
}

/**
 * What a battle is worth to the faction if it brought `value` more and `bonus` more on the roll, with
 * the attacker's Ground Support at its odds.
 */
function battleWorth(board: RecruitBoard, battle: SiteBattle, value: number, bonus: number, support: SupportOdds): number {
  const sign = battle.role === "attack" ? 1 : -1;
  const flown = support === noSupport ? 0 : battle.flown;
  return support.reduce((sum, { chance, roll }) => sum + flown * chance * worthAtRoll(board, battle, value, bonus + sign * roll), 0)
    + (flown < 1 ? (1 - flown) * worthAtRoll(board, battle, value, bonus) : 0);
}

/**
 * What a battle is worth to the faction if it brought `value` more and `bonus` more on the roll: the
 * chance of the ground at its stake, part of it at `partialGround`, and what each side would lose, by
 * the profile's weights. Both sides' losses are counted on what stands there now, so a unit is worth
 * what it changes for the others; its own men are in its price.
 */
function worthAtRoll({ assessment, scenario }: RecruitBoard, battle: SiteBattle, value: number, bonus: number): number {
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

/** Turns on the road to a battle, at a pace: none for the step that attacks. */
const marching = (distance: number, pace: number): number => Math.max(0, Math.ceil(distance / pace) - 1);

/** What a gain is worth after the turns until it counts. */
const delayed = (board: RecruitBoard, gain: number, delay: number): number => gain / (1 + board.assessment.profile.recruits.delayDrag * delay);

/**
 * M1, R5: what one more truck at a site adds, over the turns of the profile's horizon that it serves:
 * each of those turns, the attack its foot could join with it less the one they could join without.
 * A truck takes foot two territories a turn, where a Motor road leads towards the battle, and foot
 * alone march one. Only foot nothing there carries count, enough to fill the truck, each with a
 * better attack to join for being carried.
 */
function truckGain(board: RecruitBoard, type: UnitTypeDefinition, near: SiteBattles): number {
  const { assessment, scenario, state } = board;
  const riders = near.foot.slice(0, carriesOf(type));
  const attacks = near.battles.filter((battle) => battle.role === "attack");
  if (!near.led || riders.length < carriesOf(type) || attacks.every((battle) => battle.distance < 2)) return 0;
  const stops = motorReach(scenario, state, assessment.factionId, near.site);
  const roads = attacks.map((battle) => battle.distance > 1 && stops.some((stop) => territoriesWithin(scenario, stop, battle.distance - 2).has(battle.territoryId)));
  const gains = riders.map((rider) => {
    const shares = attacks.map((battle) => battleWorth(board, battle, 0, 0, noSupport) - battleWorth(board, battle, -rider.attack, 0, noSupport));
    const joined = (pace: (at: number) => number): number => Math.max(0, ...attacks.map((battle, at) => delayed(board, shares[at] ?? 0, marching(battle.distance, pace(at)))));
    const gain = joined((at) => (roads[at] === true ? paceOf(type) : 1)) - joined(() => 1);
    return gain * Math.max(0, assessment.profile.recruits.upkeepHorizon - Math.max(rider.turns, type.recruit?.trainingTurns ?? 0));
  });
  return gains.every((gain) => gain > 0) ? gains.reduce((sum, gain) => sum + gain, 0) : 0;
}

/**
 * The marginal gain of one more unit of the type at a site: in the attack it would help most, and in
 * the defence of the site against the faction that threatens it most, each less for the turns until
 * it can fight there, and the raids its AA spares the site. An aircraft flies one mission a turn, so
 * it counts the best of its missions: Ground Support, Patrol over the site, or raids.
 */
export function marginalGain(board: RecruitBoard, type: UnitTypeDefinition, near: SiteBattles): number {
  if (isTruckType(type)) return truckGain(board, type, near);
  const count = near.count(type);
  const best = { attack: 0, defence: 0 };
  for (const battle of near.battles) {
    if (battle.role === "attack" && type.air === undefined && !near.led && !attacksAlone(type)) continue;
    const delay = (type.recruit?.trainingTurns ?? 0) + (type.air === undefined ? marching(battle.distance, paceOf(type)) : 0);
    const points = nextRollBonus(type, count, battle.role);
    // Ground units count in an attack without Ground Support, which may fly elsewhere; an aircraft counts what it adds to it. A defence faces the enemy's.
    const [before, after] = battle.role === "attack" && type.air === undefined ? [noSupport, noSupport] : [battle.support(), battle.support(type)];
    const value = valueOf(type, battle.role);
    if (value === 0 && points === 0 && before === after) continue;
    const gain = battleWorth(board, battle, value, points, after) - battleWorth(board, battle, 0, 0, before);
    best[battle.role] = Math.max(best[battle.role], delayed(board, gain, delay));
  }
  const spared = raidsSpared(board, type, near);
  return type.air === undefined ? best.attack + best.defence + spared : Math.max(best.attack, best.defence + spared, raidGain(board, type, near));
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

/** The least a price counts for, so a type that costs next to nothing is not worth without end. */
const leastPrice = 0.001;

/** Amounts of resources, each as a share of a supply of it. */
const shareOf = (amounts: readonly (readonly [string, number])[], supply: Resources): number =>
  amounts.reduce((sum, [id, amount]) => sum + amount / Math.max(1, supply[id as ResourceId] ?? 0), 0);

/** A type's price with the upkeep of the horizon's turns, each resource as a share of the faction's supply of it. */
export function priceOf(type: UnitTypeDefinition, supply: Resources, horizon: number): number {
  return shareOf([
    ...Object.entries(type.recruit?.cost ?? {}),
    ...Object.entries(type.upkeep).map(([id, amount]) => [id, amount * horizon] as const)
  ], supply);
}

/** What one more unit of the type is worth at a site for its price, as far as the profile counts it; nothing for a type that can't be recruited. */
export function worthOf(board: RecruitBoard, type: UnitTypeDefinition, supply: Resources, near: SiteBattles): number {
  if (type.recruit === undefined) return 0;
  return near.kept(type) * (marginalGain(board, type, near) / Math.max(leastPrice, priceOf(type, supply, board.assessment.profile.recruits.upkeepHorizon)));
}
