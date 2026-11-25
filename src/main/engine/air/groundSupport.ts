import { dieFaces, pick } from "../dice";
import { type CombatHookContext, hookedGrounded } from "../hooks";
import type {
  AirBattleAircraft,
  AirBattleInput,
  AirBattleResult,
  AirBattleRow,
  AirMissionOrder,
  CombatModifier,
  FactionId,
  GameState,
  GroundSupportApplied,
  Scenario,
  TerritoryId,
  UnitId,
  UnitTypeDefinition
} from "../types";
import { aircraftLost, airBattle, airBattleFought, airBattleOdds, groundSupport } from "./airBattle";
import { unitTypeIn } from "./pieces";
import type { AirScratch } from "./scratch";

/**
 * R10, R11: who gets Ground Support in a battle. The aircraft over the battle (Ground Support or
 * Patrol over its territory) and the defenders' AA make the air battle's input; the air battle,
 * when one is fought, gives Ground Support to one side or nobody, and may cost either side
 * aircraft. Resolution reads the turn's flights from the air scratch; planning estimates pass the
 * planned flights.
 */

/** An aircraft type's numbers in the air battle and on Ground Support, from its effects. */
export function flightRolls(type: Pick<UnitTypeDefinition, "effects"> | undefined, mission: AirBattleAircraft["mission"]): Pick<AirBattleAircraft, "airRoll" | "supportRoll"> {
  let airRoll = 0;
  let supportRoll = 0;
  for (const effect of type?.effects ?? []) {
    if (effect.kind === "air-battle") airRoll = Math.max(airRoll, effect.roll);
    if (effect.kind === "battle-support" && mission === "support") supportRoll = Math.max(supportRoll, effect.roll);
  }
  return { airRoll, supportRoll };
}

/** An aircraft's numbers in the air battle and on Ground Support, from its type's effects. */
export function airBattleAircraft(scenario: Scenario, raised: GameState["raised"], order: AirMissionOrder): AirBattleAircraft | undefined {
  const { mission } = order;
  if (mission.kind !== "support" && mission.kind !== "patrol") return undefined;
  return { ...flightRolls(unitTypeIn(scenario, raised, order.unitId), mission.kind), factionId: order.factionId, mission: mission.kind, unitId: order.unitId };
}

/** U3, R11: a type's AA: its best `raid-defence`, as a plus; 0 for a type with none. */
export function antiAirRoll(type: Pick<UnitTypeDefinition, "effects"> | undefined): number {
  return Math.max(0, ...(type?.effects ?? []).map((effect) => (effect.kind === "raid-defence" ? -effect.roll : 0)));
}

/** U3, R11: the AA of a set of units: the best `raid-defence` among them, as a plus. */
export function antiAirOf(scenario: Scenario, raised: GameState["raised"], unitIds: readonly UnitId[]): number {
  return Math.max(0, ...unitIds.map((id) => antiAirRoll(unitTypeIn(scenario, raised, id))));
}

/** Where and between whom a battle is fought, as its air battle sees it. */
export interface AirBattleSetting {
  readonly attackerFactionId: FactionId;
  readonly defenderFactionIds: readonly FactionId[];
  /** The defending units, whose AA counts; their order is kept. */
  readonly defenderUnitIds: readonly UnitId[];
  readonly territoryId: TerritoryId;
}

/**
 * R11: the air battle's input over a battle: each side's Ground Support and Patrol flights over
 * the battle's territory, the defenders' AA, and the scenario's cap on Ground Support. Recon and
 * raids take no part. The defender side is named for the first defending faction.
 */
export function airBattleInput(scenario: Scenario, state: Pick<GameState, "raised">, setting: AirBattleSetting, flights: readonly AirMissionOrder[]): AirBattleInput {
  const over = (factionIds: readonly FactionId[]): readonly AirBattleAircraft[] =>
    flights
      .filter((order) => factionIds.includes(order.factionId) && (order.mission.kind === "support" || order.mission.kind === "patrol") && order.mission.territoryId === setting.territoryId)
      .flatMap((order) => airBattleAircraft(scenario, state.raised, order) ?? []);
  const supportMax = scenario.air?.supportMax;
  return {
    attacker: { aircraft: over([setting.attackerFactionId]), antiAir: 0, factionId: setting.attackerFactionId },
    defender: {
      aircraft: over(setting.defenderFactionIds),
      antiAir: antiAirOf(scenario, state.raised, setting.defenderUnitIds),
      factionId: setting.defenderFactionIds[0] ?? setting.attackerFactionId
    },
    ...(supportMax === undefined ? {} : { supportMax })
  };
}

/** R11: the air over one battle: the input, the air battle when one is fought, the aircraft it cost, and the Ground Support each side gets. */
export interface AirOverBattle {
  readonly aircraftLost: readonly UnitId[];
  readonly input: AirBattleInput;
  readonly result?: AirBattleResult;
  readonly support: GroundSupportApplied;
}

/** R11: the scenario's air battle table, when an air battle is fought over a battle; else undefined. */
function foughtOn(scenario: Scenario, input: AirBattleInput): readonly AirBattleRow[] | undefined {
  return airBattleFought(input) ? scenario.air?.battleTable : undefined;
}

/**
 * R11: settles the air over a battle. With no aircraft over it, there is nothing to settle. When
 * an air battle is fought, `roll` gives its one d20; otherwise every side's Ground Support applies.
 */
export function airOverBattle(scenario: Scenario, input: AirBattleInput, roll: () => number): AirOverBattle | undefined {
  if (input.attacker.aircraft.length === 0 && input.defender.aircraft.length === 0) return undefined;
  const table = foughtOn(scenario, input);
  if (table === undefined) return { aircraftLost: [], input, support: groundSupport(input, undefined) };
  const result = airBattle(table, input, roll());
  return { aircraftLost: aircraftLost(input, result.row), input, result, support: groundSupport(input, result.row) };
}

/** R11: the turn's flights after a battle: the aircraft its air battle shot down are in no later one. */
export function flightsAfter(scratch: AirScratch, air: AirOverBattle): AirScratch {
  const flies = (order: AirMissionOrder): boolean => !air.aircraftLost.includes(order.unitId);
  return { ...scratch, patrols: scratch.patrols.filter(flies), support: scratch.support.filter(flies) };
}

/** R11: a battle's air battle d20, from the `air-battle` stream of its index. */
export function airBattleDie(scratch: AirScratch, battleIndex: number): number {
  const streams = scratch.streams;
  return streams === undefined ? 1 : pick(streams("air-battle", battleIndex), dieFaces);
}

/** The defending units a hook context names, or else the defenders' units in the territory at the start of the turn. */
function defenderUnitsOf(context: CombatHookContext): readonly UnitId[] {
  if (context.defenderUnitIds !== undefined) return context.defenderUnitIds;
  return Object.values(context.state.units)
    .filter((unit) => unit.territoryId === context.territoryId && context.defenderFactionIds.includes(unit.factionId))
    .map((unit) => unit.id);
}

/** R11: the air over the battle a hook context describes, from the turn's flights in `scratch`. */
export function airOverHookedBattle(context: CombatHookContext, scratch: AirScratch): AirOverBattle | undefined {
  const setting: AirBattleSetting = { ...context, defenderUnitIds: defenderUnitsOf(context) };
  const input = airBattleInput(context.scenario, context.state, setting, [...scratch.support, ...scratch.patrols]);
  return airOverBattle(context.scenario, input, () => airBattleDie(scratch, context.battleIndex ?? 0));
}

/** R11: Ground Support that applies, as the battle's `air-support` modifiers, the attacker's first, each named for its first aircraft's faction. */
export function supportModifiersOf(air: AirOverBattle | undefined): readonly CombatModifier[] {
  if (air === undefined) return [];
  const sides = [["attacker", "attack", 1], ["defender", "defence", -1]] as const;
  return sides.flatMap(([side, role, sign]): CombatModifier[] => {
    const { roll, unitIds } = air.support[side];
    const first = air.input[side].aircraft.find((aircraft) => aircraft.unitId === unitIds[0]);
    return roll > 0 && first !== undefined ? [{ factionId: first.factionId, kind: "air-support", role, roll: sign * roll, unitIds }] : [];
  });
}

/** R11 for planning: what one row of the air battle table would do for the attack, and its chance. */
export interface PlannedAirResult {
  /** The planned aircraft it would cost. */
  readonly aircraftLost: number;
  readonly chance: number;
  readonly name: string;
  /** What the attack's Ground Support would add: all of it, or 0. */
  readonly roll: number;
  /** Whose Ground Support would apply. */
  readonly support: AirBattleRow["support"];
}

/** R11 for planning: an attack's planned Ground Support, and what the air battle is likely to make of it. */
export interface PlannedAir {
  /** The roll the support adds on average over the air battle; all of it when nothing opposes it. */
  readonly average: number;
  /** The air battle as the planner can see it: its own Ground Support against the defenders' AA. */
  readonly input: AirBattleInput;
  /** The chance that the air battle costs the attack aircraft, 0 to 1; 0 when nothing opposes it. */
  readonly lossChance: number;
  /** All of the support, as the battle's `air-support` modifier. */
  readonly modifier: CombatModifier;
  /** Every row of the table in its order, when an air battle would be fought; absent when the support goes unopposed. */
  readonly results?: readonly PlannedAirResult[];
  /** The chance that the support applies, 0 to 1; 1 when nothing opposes it. */
  readonly supportChance: number;
}

/** The chance of the results a test picks, added up in the d20's faces, so that seven of them read as exactly 0.35. */
function chanceOf(results: readonly PlannedAirResult[], test: (result: PlannedAirResult) => boolean): number {
  const faces = dieFaces;
  return results.filter(test).reduce((sum, result) => sum + Math.round(result.chance * faces), 0) / faces;
}

/**
 * R11: what an attack's planned Ground Support (`supportIds`, the faction's aircraft) would add,
 * as the planner sees it: enemy aircraft are unknown, so only the defenders' AA can fight its air
 * battle; aircraft the weather grounds are left out. Undefined when no planned aircraft would add support.
 */
export function plannedAir(scenario: Scenario, state: GameState, setting: AirBattleSetting, supportIds: readonly UnitId[]): PlannedAir | undefined {
  const flies = (id: UnitId): boolean => {
    const unit = state.units[id];
    // Weather grounds an aircraft at its base (Rain, Mud, Snow without a paved airfield), and a grounded one gives no support.
    return unit?.factionId === setting.attackerFactionId && !hookedGrounded({ scenario, state, territoryId: unit.territoryId, unitId: id });
  };
  const flights = supportIds
    .filter(flies)
    .map((unitId): AirMissionOrder => ({ factionId: setting.attackerFactionId, kind: "air-mission", mission: { kind: "support", territoryId: setting.territoryId }, unitId }));
  const input = airBattleInput(scenario, state, setting, flights);
  const { roll, unitIds } = groundSupport(input, undefined).attacker;
  if (roll === 0) return undefined;
  return { ...plannedSupport(scenario, input), input, modifier: { factionId: setting.attackerFactionId, kind: "air-support", role: "attack", roll, unitIds } };
}

/**
 * R11 for planning: what the attacker's Ground Support in an air battle's input adds on average,
 * and the chances that it applies and that it costs aircraft. The computer player's recruiting
 * reads the same odds for aircraft it does not have yet.
 */
export function plannedSupport(scenario: Scenario, input: AirBattleInput): Omit<PlannedAir, "input" | "modifier"> {
  const table = foughtOn(scenario, input);
  if (table === undefined) return { average: groundSupport(input, undefined).attacker.roll, lossChance: 0, supportChance: 1 };
  const results = airBattleOdds(table, input).map(({ chance, row }): PlannedAirResult => ({
    aircraftLost: aircraftLost(input, row).length,
    chance,
    name: row.name,
    roll: groundSupport(input, row).attacker.roll,
    support: row.support
  }));
  const average = results.reduce((sum, result) => sum + Math.round(result.chance * dieFaces) * result.roll, 0) / dieFaces;
  return {
    average,
    lossChance: chanceOf(results, (result) => result.aircraftLost > 0),
    results,
    supportChance: chanceOf(results, (result) => result.roll > 0)
  };
}
