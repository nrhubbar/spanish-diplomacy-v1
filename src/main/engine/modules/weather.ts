import { removeArmies } from "../board";
import { requireD20, usesD20 } from "../d20/rules";
import type { RuleHooks } from "../hooks";
import type { RuleModule } from "../modules";
import type { Phase } from "../phases/draft";
import type { CombatModifier, FactionId, FrostbiteOutcome, GameState, Scenario, TerritoryId, UnitId } from "../types";
import { weatherEffectsIn, weatherIn } from "../weather";

/**
 * The weather area's modules (T1-T4). The roll itself happens before planning
 * (`engine/weather.ts`, `beforePlanning`), so the start-of-turn state holds the turn's weather.
 * Step 0 here records it in the turn report, the hooks give its effects to the other areas,
 * and the step-9 part takes frostbite.
 */

/** Q-WX-6, D3: the d20 modifiers are the d6 ones times 3, so the d6 table takes a third. */
const d6Scale = 3;

/** T2, T3: the turn's weather in the report, as the players saw it before planning. */
const recordWeather: Phase = (draft) => {
  const weather = draft.input.start.weather;
  if (weather === undefined) return draft;
  return { ...draft, events: [...draft.events, { kind: "weather-rolled", turnNumber: draft.input.start.turnNumber, weather }] };
};

/**
 * T4, D7: a unit that moved or withdrew this turn from or into a territory whose weather carries
 * `frostbite` (Severe cold) loses that share of its men, rounded to the nearest man, at step 9.
 * "Into" is where the unit actually ended up: an intercepted move stops short, and a blocked
 * withdrawal falls back (the `withdrew` outcome names the real destination). Units already gone
 * (destroyed, surrendered) lose nothing more. Under the d20, a unit left below `breakUpShare` of
 * its full strength breaks up (D6), as after a battle's losses.
 */
const takeFrostbite: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const share = (territoryId: TerritoryId): number => weatherEffectsIn(scenario, start, territoryId, "frostbite").reduce((most, effect) => Math.max(most, effect.share), 0);
  const armies: Record<UnitId, GameState["units"][UnitId]> = { ...draft.armies };
  const brokenUp: UnitId[] = [];
  const events: FrostbiteOutcome[] = [];
  const marches = [
    ...draft.orders.valid.map((order) => ({ from: draft.orders.origins.get(order.unitId) ?? order.from, unitId: order.unitId })),
    ...draft.events.flatMap((event) => (event.kind === "withdrew" ? [{ from: event.order.from, unitId: event.order.unitId }] : []))
  ];
  for (const { from, unitId } of marches) {
    const unit = armies[unitId];
    if (unit === undefined) continue;
    const worst = Math.max(share(from), share(unit.territoryId));
    const men = Math.round(unit.strength * worst);
    if (men <= 0) continue;
    const left = Math.max(0, unit.strength - men);
    const fullStrength = (scenario.index.units.get(unit.id) ?? start.raised[unit.id])?.fullStrength ?? unit.strength;
    const breaksUp = left <= 0 || (usesD20(scenario) && left < requireD20(scenario).breakUpShare * fullStrength);
    if (breaksUp) brokenUp.push(unit.id);
    else armies[unitId] = { ...unit, strength: left };
    events.push({ factionId: unit.factionId, kind: "frostbite", men, territoryId: unit.territoryId, unitId: unit.id, ...(breaksUp ? { destroyed: true as const } : {}) });
  }
  return events.length === 0 ? draft : { ...draft, armies: removeArmies(armies, brokenUp), events: [...draft.events, ...events] };
};

/** D7: the battle territory's weather as a named modifier on the attacker's roll; none when it is 0. */
function weatherModifiers(scenario: Scenario, state: GameState, territoryId: TerritoryId): readonly CombatModifier[] {
  const weather = weatherIn(scenario, state, territoryId);
  if (weather === undefined || weather.attackRoll === 0) return [];
  const roll = scenario.rules.dice === "d6-table" ? Math.trunc(weather.attackRoll / d6Scale) : weather.attackRoll;
  return roll === 0 ? [] : [{ kind: "weather", roll, weatherId: weather.id }];
}

/** U2: an all-weather (paved) airfield in a sub-territory of the territory that the faction holds. */
function hasAllWeatherAirbase(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionId: FactionId): boolean {
  return (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).some((site) => {
    const held = state.subTerritories[site.id];
    return held?.holder === factionId && held.buildings.some((buildingId) =>
      scenario.index.buildings.get(buildingId)?.effects.some((effect) => effect.kind === "all-weather-airbase") === true);
  });
}

/** T4: the weather's effects on the other areas, read from the start-of-turn state (CT-44). */
export const weatherHooks: RuleHooks = {
  allowanceDelta: ({ from, scenario, state }) => -weatherEffectsIn(scenario, state, from, "movement-penalty").reduce((sum, effect) => sum + effect.amount, 0),
  canDigIn: ({ scenario, state, territoryId }) => weatherEffectsIn(scenario, state, territoryId, "blocks-digging-in").length === 0,
  combatModifiers: ({ scenario, state, territoryId }) => weatherModifiers(scenario, state, territoryId),
  grounded: ({ scenario, state, territoryId, unitId }) => {
    if (weatherEffectsIn(scenario, state, territoryId, "grounds-aircraft").length === 0) return false;
    const factionId = state.units[unitId]?.factionId;
    return factionId === undefined || !hasAllWeatherAirbase(scenario, state, territoryId, factionId);
  }
};

export const weatherModules: readonly RuleModule[] = [
  { area: "weather", blocks: [], id: "none", steps: {} },
  { area: "weather", blocks: ["weather", "calendar"], hooks: weatherHooks, id: "seasonal-zones", steps: { morale: takeFrostbite, weather: recordWeather } }
];
