import { armyValue, oddsForValues } from "../engine/combat";
import { citiesIn, requireAiProfile, requireFaction, requireTerritory } from "../engine/lookup";
import { holdsWhole } from "../engine/partition/holders";
import type { AiProfile, FactionId, GameState, Scenario, TerritoryId, UnitId, UnitState } from "../engine/types";
import { victoryProgress } from "../engine/victory";
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
   * that can reach it this turn would meet a victory threshold by taking it whole.
   */
  readonly isCritical: (territoryId: TerritoryId) => boolean;
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
  /** Whether any of its armies could enter the territory if it stood empty. */
  readonly reaches: boolean;
}

export function assess(scenario: Scenario, state: GameState, factionId: FactionId): Assessment {
  const objectives = new Set<TerritoryId>(requireFaction(scenario, factionId).objectiveTerritoryIds);
  const profile = requireAiProfile(scenario, factionId);
  const hostile = Object.values(state.units).filter((unit) => unit.factionId !== factionId);
  const attackValues = new Map<UnitId, number>();
  const defenceValues = new Map<UnitId, number>();
  const stakes = new Map<TerritoryId, number>();
  const pressures = new Map<TerritoryId, ReadonlyMap<FactionId, Pressure>>();
  const dangers = new Map<string, number>();
  const reaches = new Map<UnitId, ReadonlySet<TerritoryId>>();
  const criticals = new Map<TerritoryId, boolean>();

  const attackOf = (unit: UnitState): number => cached(attackValues, unit.id, () => armyValue(scenario, unit, "attack"));
  const defenceOf = (unit: UnitState): number => cached(defenceValues, unit.id, () => armyValue(scenario, unit, "defence"));

  // D23: each hostile unit's reach is worked out once, rail and trucks included (`threatReach`).
  const reachOf = (unit: UnitState): ReadonlySet<TerritoryId> => cached(reaches, unit.id, () => threatReach(scenario, state, unit));
  const pressureOn = (territoryId: TerritoryId): ReadonlyMap<FactionId, Pressure> => cached(pressures, territoryId, () => {
    const byFaction = new Map<FactionId, Pressure>();
    for (const unit of hostile) {
      if (!reachOf(unit).has(territoryId)) continue;
      const before = byFaction.get(unit.factionId) ?? { attack: 0, defence: 0, reaches: false };
      // M23: a demoralized army cannot attack, but it may still enter an empty territory.
      byFaction.set(unit.factionId, {
        attack: before.attack + (unit.morale.demoralized ? 0 : attackOf(unit)),
        defence: before.defence + (unit.territoryId === territoryId ? 0 : defenceOf(unit)),
        reaches: true
      });
    }
    return byFaction;
  });

  const danger = (territoryId: TerritoryId, defence: number): number => cached(dangers, `${territoryId}|${String(defence)}`, () => {
    const pressure = [...pressureOn(territoryId)];
    if (defence <= 0) {
      return pressure.some(([, entry]) => entry.reaches) ? 1 : 0;
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
  // The alarm raises a rival's own territories as it nears victory, so the faction attacks the leader.
  const alarms = new Map(progress
    .filter((entry) => entry.factionId !== factionId)
    .map((entry) => {
      // A territory taken often brings two victory cities with it.
      const gap = Math.min(entry.territoryThreshold - entry.territoriesControlled, Math.ceil((entry.cityThreshold - entry.citiesControlled) / 2));
      return [entry.factionId, Math.max(0, profile.victoryAlarm.steps - gap) * profile.victoryAlarm.perStep] as const;
    }));
  const holdsGround = (territoryId: TerritoryId): boolean => {
    const control = state.control[territoryId];
    if (control?.kind === "controlled") return control.factionId === factionId;
    return control?.kind === "contested" && control.factionIds.includes(factionId);
  };
  // D23: a territory whose change of hands alone would decide the game. On the faction's own
  // ground, a rival that can reach it would meet a victory threshold by taking it whole; elsewhere,
  // the faction itself would.
  const decides = (territoryId: TerritoryId, taker: FactionId): boolean => {
    const entry = progress.find((candidate) => candidate.factionId === taker);
    if (entry === undefined) return false;
    const territory = requireTerritory(scenario, territoryId);
    const territoryGain = territory.countsForVictory && !holdsWhole(scenario, state, territoryId, taker) ? 1 : 0;
    const cityGain = citiesIn(scenario, territoryId).filter((city) => city.countsForVictory && state.cityControl[city.id] !== taker).length;
    const short = (held: number, threshold: number, gain: number): boolean => held < threshold && held + gain >= threshold;
    return short(entry.territoriesControlled, entry.territoryThreshold, territoryGain) || short(entry.citiesControlled, entry.cityThreshold, cityGain);
  };
  const isCritical = (territoryId: TerritoryId): boolean => cached(criticals, territoryId, () =>
    holdsGround(territoryId) && progress.some((entry) => entry.factionId !== factionId
      && pressureOn(territoryId).get(entry.factionId)?.reaches === true
      && decides(territoryId, entry.factionId)));
  const alarmFor = (territoryId: TerritoryId): number => {
    if (isCritical(territoryId) || decides(territoryId, factionId)) return profile.victoryAlarm.critical;
    const control = state.control[territoryId];
    return control?.kind === "controlled" && control.factionId !== factionId ? alarms.get(control.factionId) ?? 0 : 0;
  };

  const stake = (territoryId: TerritoryId): number => cached(stakes, territoryId, () => {
    const cities = citiesIn(scenario, territoryId).filter((city) => city.countsForVictory).length;
    const base = (requireTerritory(scenario, territoryId).countsForVictory ? profile.stakes.territory : 0)
      + cities * profile.stakes.city
      + (objectives.has(territoryId) ? profile.stakes.objective : 0);
    return base * (1 + alarmFor(territoryId));
  });

  const relief = (territoryId: TerritoryId): Relief | undefined => {
    const control = state.control[territoryId];
    if (control?.kind !== "controlled" || control.factionId === factionId) return undefined;
    const defence = pressureOn(territoryId).get(control.factionId)?.defence ?? 0;
    return defence > 0 ? { defence, factionId: control.factionId } : undefined;
  };

  const threatOrigins = (territoryId: TerritoryId): ReadonlySet<TerritoryId> =>
    new Set(hostile.filter((unit) => reachOf(unit).has(territoryId)).map((unit) => unit.territoryId));

  return { attackOf, danger, defenceOf, factionId, isCritical, isObjective: (territoryId) => objectives.has(territoryId), profile, relief, stake, threatOrigins };
}

function cached<Key, Value>(cache: Map<Key, Value>, key: Key, compute: () => Value): Value {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const value = compute();
  cache.set(key, value);
  return value;
}
