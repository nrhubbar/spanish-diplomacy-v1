import { armyValue, oddsForValues } from "../engine/combat";
import { territoryIncome } from "../engine/economy/income";
import { citiesIn, requireAiProfile, requireFaction, requireTerritory } from "../engine/lookup";
import { holdsWhole } from "../engine/partition/holders";
import type { AiProfile, FactionId, GameState, Scenario, TerritoryId, UnitId, UnitState, VictoryProgress } from "../engine/types";
import { canFight } from "../engine/units/fighting";
import { victoryProgress } from "../engine/victory";
import { alarmAt, stepsShort } from "./alarm";
import { threatReach } from "./reach";

/**
 * A computer player's reading of the board at the start of a turn, from one faction's point
 * of view. It uses only public information (positions, men, morale, works) and the engine's
 * own battle maths, so it judges odds exactly as the battle rules will. Every answer is
 * cached, because planning asks the same questions many times.
 */
export interface Assessment {
  readonly factionId: FactionId;
  /** E7: the faction's weights, from scenario data (`ai.profiles`). */
  readonly profile: AiProfile;
  /** The army's attack value (M12) at the start of the turn. */
  readonly attackOf: (unit: UnitState) => number;
  /**
   * The chance that the strongest hostile faction around a territory takes it from own
   * armies worth `defence` there, if every hostile army next to it attacked (or, at zero
   * defence, simply walked in). Zero when no hostile army can reach it.
   */
  readonly danger: (territoryId: TerritoryId, defence: number) => number;
  /** The army's defence value (M12) at the start of the turn. */
  readonly defenceOf: (unit: UnitState) => number;
  /**
   * For a territory another faction controls: the defence its armies next door could bring
   * by moving in this turn, which they may do without a fight (M11). Undefined when none can.
   */
  readonly relief: (territoryId: TerritoryId) => Relief | undefined;
  /**
   * D23: whether the territory is victory-critical. The faction holds ground there, and a rival
   * that can reach it this turn would meet a victory threshold by taking it whole. Stakes are
   * raised more widely (`stake`): ground of any holder that would win a rival the game, alone or
   * with one other, and the ground of a rival near victory.
   */
  readonly isCritical: (territoryId: TerritoryId) => boolean;
  /** Own territories that, left empty together with this one of its own, would let a rival two steps short or nearer win by the two. */
  readonly criticalWith: (territoryId: TerritoryId) => readonly TerritoryId[];
  /**
   * The share of own losses and of the danger at home that count when attacking there: 1, less
   * the nearer victory is for a rival holding ground there, since losing the game costs more.
   */
  readonly risk: (territoryId: TerritoryId) => number;
  /** Whether a rival near victory holds the territory whole: any ground taken there spoils it, off its count. */
  readonly spoils: (territoryId: TerritoryId) => boolean;
  /** The share of the territory's stake that is the income it pays a rival (`stakes.income`): any ground taken there stops it. */
  readonly deniedShare: (territoryId: TerritoryId) => number;
  /** Whether an attack on `target` strikes a rival that would win by taking `origin`. */
  readonly strikesThreat: (origin: TerritoryId, target: TerritoryId) => boolean;
  /**
   * Where the hostile armies able to reach the territory this turn stand (rail and trucks
   * included), demoralized ones too, since they may still walk into empty ground.
   */
  readonly threatOrigins: (territoryId: TerritoryId) => ReadonlySet<TerritoryId>;
  /** Whether the territory is one of the faction's objectives. */
  readonly isObjective: (territoryId: TerritoryId) => boolean;
  /** What holding the territory is worth to the faction. */
  readonly stake: (territoryId: TerritoryId) => number;
}

/** Armies that could move into a faction's own empty territory to defend it. */
export interface Relief {
  readonly defence: number;
  readonly factionId: FactionId;
}

interface Pressure {
  /** Summed attack values of the faction's armies able to attack the territory, by step, rail, road or sea. */
  readonly attack: number;
  /** Summed defence values of its armies able to reach the territory, all of which could move in. */
  readonly defence: number;
  /** The armies that could enter it. */
  readonly units: ReadonlySet<UnitId>;
}

export function assess(scenario: Scenario, state: GameState, factionId: FactionId): Assessment {
  const objectives = new Set<TerritoryId>(requireFaction(scenario, factionId).objectiveTerritoryIds);
  const profile = requireAiProfile(scenario, factionId);
  // D27.1: only units that can fight take ground, so only they threaten it or relieve it.
  const hostile = Object.values(state.units).filter((unit) => unit.factionId !== factionId && canFight(scenario, state.raised, unit.id));
  const attackValues = new Map<UnitId, number>();
  const defenceValues = new Map<UnitId, number>();
  const stakes = new Map<TerritoryId, number>();
  const pressures = new Map<TerritoryId, ReadonlyMap<FactionId, Pressure>>();
  const dangers = new Map<string, number>();
  const reaches = new Map<UnitId, ReadonlySet<TerritoryId>>();
  const winners = new Map<TerritoryId, readonly FactionId[]>();
  const partners = new Map<string, readonly TerritoryId[]>();

  const attackOf = (unit: UnitState): number => cached(attackValues, unit.id, () => armyValue(scenario, unit, "attack"));
  const defenceOf = (unit: UnitState): number => cached(defenceValues, unit.id, () => armyValue(scenario, unit, "defence"));

  // D23: each hostile unit's reach is worked out once, rail and trucks included (`threatReach`).
  const reachOf = (unit: UnitState): ReadonlySet<TerritoryId> => cached(reaches, unit.id, () => threatReach(scenario, state, unit));
  const pressureOn = (territoryId: TerritoryId): ReadonlyMap<FactionId, Pressure> => cached(pressures, territoryId, () => {
    const byFaction = new Map<FactionId, Pressure>();
    for (const unit of hostile) {
      if (!reachOf(unit).has(territoryId)) continue;
      const before = byFaction.get(unit.factionId) ?? { attack: 0, defence: 0, units: new Set<UnitId>() };
      // M23: a demoralized army cannot attack, but it may still enter an empty territory.
      byFaction.set(unit.factionId, {
        attack: before.attack + (unit.morale.demoralized ? 0 : attackOf(unit)),
        defence: before.defence + (unit.territoryId === territoryId ? 0 : defenceOf(unit)),
        units: new Set([...before.units, unit.id])
      });
    }
    return byFaction;
  });

  const danger = (territoryId: TerritoryId, defence: number): number => cached(dangers, `${territoryId}|${String(defence)}`, () => {
    const pressure = [...pressureOn(territoryId)];
    if (defence <= 0) {
      return pressure.length > 0 ? 1 : 0;
    }
    let worst = 0;
    for (const [attackerFactionId, entry] of pressure) {
      if (entry.attack <= 0) continue;
      worst = Math.max(worst, oddsForValues(scenario, state, {
        attackerFactionId,
        defenderFactionIds: [factionId],
        diggingIn: true,
        territoryId
      }, entry.attack, defence).takeChance);
    }
    return worst;
  });

  const progress = victoryProgress(scenario, state);
  const rivals = progress.filter((entry) => entry.factionId !== factionId);
  // The alarm raises a rival's own ground as it nears victory, so the faction attacks the leader.
  const alarms = new Map(rivals.map((entry) => [entry.factionId, alarmAt(profile, stepsShort(entry))] as const));
  const holdersOf = (territoryId: TerritoryId): readonly FactionId[] => {
    const control = state.control[territoryId];
    return control?.kind === "controlled" ? [control.factionId] : control?.kind === "contested" ? control.factionIds : [];
  };
  /** The alarm of the rival nearest victory with ground there, whole or contested. */
  const leaderAlarm = (territoryId: TerritoryId): number =>
    Math.max(0, ...holdersOf(territoryId).map((holder) => alarms.get(holder) ?? 0));
  /** Whether taking these territories whole, together, would carry a faction to a victory threshold. */
  const meetsWith = (entry: VictoryProgress, taken: readonly TerritoryId[]): boolean => {
    const territories = taken.filter((id) => requireTerritory(scenario, id).countsForVictory && !holdsWhole(scenario, state, id, entry.factionId)).length;
    const cities = taken.flatMap((id) => citiesIn(scenario, id)).filter((city) => city.countsForVictory && state.cityControl[city.id] !== entry.factionId).length;
    const short = (held: number, threshold: number, gain: number): boolean => held < threshold && held + gain >= threshold;
    return short(entry.territoriesControlled, entry.territoryThreshold, territories) || short(entry.citiesControlled, entry.cityThreshold, cities);
  };
  // D23: a territory whose change of hands alone would decide the game for the faction itself.
  const own = progress.find((entry) => entry.factionId === factionId);
  const wins = (territoryId: TerritoryId): boolean => own !== undefined && meetsWith(own, [territoryId]);
  const reachersOf = (territoryId: TerritoryId, rival: FactionId): ReadonlySet<UnitId> => pressureOn(territoryId).get(rival)?.units ?? new Set();
  /** D23: the rivals that can reach the territory this turn and would meet a victory threshold by taking it whole. */
  const winnersOf = (territoryId: TerritoryId): readonly FactionId[] => cached(winners, territoryId, () => rivals
    .filter((entry) => reachersOf(territoryId, entry.factionId).size > 0 && meetsWith(entry, [territoryId]))
    .map((entry) => entry.factionId));
  /**
   * The alarm of a rival two steps short or nearer that could take the territory and one other in
   * the same turn, with an army for each, and win by the two together though by neither alone.
   */
  const pairAlarm = (territoryId: TerritoryId): number => Math.max(0, ...pairRivals(territoryId).map((entry) => alarmAt(profile, stepsShort(entry))));
  const nearRivals = rivals.filter((entry) => stepsShort(entry) <= 2);
  /** Whether a rival could take both territories this turn, an army for each, and win by the two together though by neither alone. */
  const winsWith = (entry: VictoryProgress, territoryId: TerritoryId, other: TerritoryId): boolean => {
    if (other === territoryId) return false;
    const here = reachersOf(territoryId, entry.factionId);
    const there = reachersOf(other, entry.factionId);
    // One army cannot take both: the two need different armies.
    if (here.size === 0 || there.size === 0 || (here.size === 1 && there.size === 1 && [...here].every((id) => there.has(id)))) return false;
    return meetsWith(entry, [territoryId, other]) && !meetsWith(entry, [territoryId]) && !meetsWith(entry, [other]);
  };
  /** The territories a rival two steps short or nearer could pair with this one to win. */
  const partnersOf = (entry: VictoryProgress, territoryId: TerritoryId): readonly TerritoryId[] => cached(partners, `${entry.factionId}|${territoryId}`, () => scenario.territories
    .map(({ id }) => id)
    .filter((id) => winsWith(entry, territoryId, id)));
  const pairRivals = (territoryId: TerritoryId): readonly VictoryProgress[] => nearRivals.filter((entry) => partnersOf(entry, territoryId).length > 0);
  /** Own ground that, left empty together with this territory of its own, would let a rival two steps short or nearer win by the two. */
  const criticalWith = (territoryId: TerritoryId): readonly TerritoryId[] => holdersOf(territoryId).includes(factionId)
    ? [...new Set(nearRivals.flatMap((entry) => partnersOf(entry, territoryId)))].filter((id) => holdersOf(id).includes(factionId))
    : [];
  const isCritical = (territoryId: TerritoryId): boolean => holdersOf(territoryId).includes(factionId) && winnersOf(territoryId).length > 0;
  const alarmFor = (territoryId: TerritoryId): number => {
    if (wins(territoryId) || winnersOf(territoryId).length > 0) return profile.victoryAlarm.critical;
    return Math.max(leaderAlarm(territoryId), pairAlarm(territoryId));
  };

  /** What holding the territory is worth for itself, before any alarm. */
  const ownWorth = (territoryId: TerritoryId): number => {
    const cities = citiesIn(scenario, territoryId).filter((city) => city.countsForVictory).length;
    return (requireTerritory(scenario, territoryId).countsForVictory ? profile.stakes.territory : 0)
      + cities * profile.stakes.city
      + (objectives.has(territoryId) ? profile.stakes.objective : 0);
  };
  /** `stakes.income`: what stopping a rival's income there is worth, before any alarm; nothing on own or contested ground. */
  const denied = (territoryId: TerritoryId): number => {
    const weight = profile.stakes.income ?? 0;
    const control = state.control[territoryId];
    return weight === 0 || control?.kind !== "controlled" || control.factionId === factionId ? 0 : weight * territoryIncome(scenario, state, territoryId);
  };
  const stake = (territoryId: TerritoryId): number => cached(stakes, territoryId, () => (ownWorth(territoryId) + denied(territoryId)) * (1 + alarmFor(territoryId)));

  const relief = (territoryId: TerritoryId): Relief | undefined => {
    const control = state.control[territoryId];
    if (control?.kind !== "controlled" || control.factionId === factionId) return undefined;
    const defence = pressureOn(territoryId).get(control.factionId)?.defence ?? 0;
    return defence > 0 ? { defence, factionId: control.factionId } : undefined;
  };

  const threatOrigins = (territoryId: TerritoryId): ReadonlySet<TerritoryId> =>
    new Set(hostile.filter((unit) => reachOf(unit).has(territoryId)).map((unit) => unit.territoryId));

  return {
    attackOf,
    criticalWith,
    danger,
    defenceOf,
    deniedShare: (territoryId) => {
      const income = denied(territoryId);
      return income === 0 ? 0 : income / (ownWorth(territoryId) + income);
    },
    factionId,
    isCritical,
    isObjective: (territoryId) => objectives.has(territoryId),
    profile,
    relief,
    risk: (territoryId) => Math.max(profile.victoryAlarm.riskFloor, 1 / (1 + leaderAlarm(territoryId))),
    spoils: (territoryId) => state.control[territoryId]?.kind === "controlled" && leaderAlarm(territoryId) > 0,
    stake,
    strikesThreat: (origin, target) => [...winnersOf(origin), ...pairRivals(origin).map((entry) => entry.factionId)].some((rival) => holdersOf(target).includes(rival)),
    threatOrigins
  };
}

function cached<Key, Value>(cache: Map<Key, Value>, key: Key, compute: () => Value): Value {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  cache.set(key, value);
  return value;
}
