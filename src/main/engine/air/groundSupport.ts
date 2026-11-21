import { factionsOf } from "../board";
import { pick } from "../dice";
import { type CombatHookContext, hookedGrounded } from "../hooks";
import type { TurnDraft } from "../phases/draft";
import type {
  AirBattleAircraft,
  AirBattleInput,
  AirBattleResult,
  AirBattleRolls,
  AirMissionOrder,
  CombatModifier,
  FactionId,
  GameState,
  GroundSupportApplied,
  Scenario,
  TerritoryId,
  UnitId
} from "../types";
import { airBattle, airBattleFought, type AirBattleOdds, airBattleOdds, groundSupport } from "./airBattle";
import { unitTypeIn } from "./pieces";
import { type AirScratch, airScratch } from "./scratch";

/**
 * R10, R11: who gets Ground Support in a battle. The aircraft over the battle (Ground Support or
 * Patrol over its territory) and the defenders' AA make the air battle's input; the air battle,
 * when one is fought, picks the one side whose Ground Support applies. Resolution reads the
 * turn's flights from the air scratch; planning estimates pass the planned flights.
 */

/** An aircraft's numbers in the air battle and on Ground Support, from its type's effects. */
export function airBattleAircraft(scenario: Scenario, raised: GameState["raised"], order: AirMissionOrder): AirBattleAircraft | undefined {
  const { mission } = order;
  if (mission.kind !== "support" && mission.kind !== "patrol") return undefined;
  let airRoll = 0;
  let supportRoll = 0;
  for (const effect of unitTypeIn(scenario, raised, order.unitId)?.effects ?? []) {
    if (effect.kind === "air-battle") airRoll = Math.max(airRoll, effect.roll);
    if (effect.kind === "battle-support" && mission.kind === "support") supportRoll = Math.max(supportRoll, effect.roll);
  }
  return { airRoll, factionId: order.factionId, mission: mission.kind, supportRoll, unitId: order.unitId };
}

/** U3, R11: the AA of a set of units: the best `raid-defence` among them, as a plus. */
export function antiAirOf(scenario: Scenario, raised: GameState["raised"], unitIds: readonly UnitId[]): number {
  let best = 0;
  for (const id of unitIds) {
    for (const effect of unitTypeIn(scenario, raised, id)?.effects ?? []) {
      if (effect.kind === "raid-defence") best = Math.max(best, -effect.roll);
    }
  }
  return best;
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

/** R11: the air over one battle: the input, the air battle when one is fought, and the Ground Support that applies. */
export interface AirOverBattle {
  readonly input: AirBattleInput;
  readonly result?: AirBattleResult;
  readonly support: GroundSupportApplied;
}

/**
 * R11: settles the air over a battle. With no aircraft over it, there is nothing to settle. When
 * an air battle is fought, `roll` gives its two d20s; otherwise every side's Ground Support applies.
 */
export function airOverBattle(input: AirBattleInput, roll: () => AirBattleRolls): AirOverBattle | undefined {
  if (input.attacker.aircraft.length === 0 && input.defender.aircraft.length === 0) return undefined;
  if (!airBattleFought(input)) return { input, support: groundSupport(input, undefined) };
  const result = airBattle(input, roll());
  return { input, result, support: groundSupport(input, result.winner) };
}

/** R11: a battle's two air battle d20s, from the `air-battle` stream of its index: the attacker's first. */
export function airBattleRolls(scratch: AirScratch, battleIndex: number): AirBattleRolls {
  const streams = scratch.streams;
  if (streams === undefined) return { attacker: 1, defender: 1 };
  const stream = streams("air-battle", battleIndex);
  const attacker = pick(stream, 20);
  return { attacker, defender: pick(stream, 20) };
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
  return airOverBattle(input, () => airBattleRolls(scratch, context.battleIndex ?? 0));
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

/** R11: the air over one battle the turn fought, for the report. */
export interface AirOverFoughtBattle {
  readonly air: AirOverBattle;
  readonly battleIndex: number;
  readonly territoryId: TerritoryId;
}

/**
 * R11: the air over every battle of the turn that had aircraft over it, as the battle hooks
 * settled it: the same input and the same `air-battle` stream, so the report matches the roll.
 * Meetings on the road have no air (D27.5).
 */
export function airOverFoughtBattles(draft: TurnDraft): readonly AirOverFoughtBattle[] {
  const scratch = airScratch(draft);
  const { scenario, start } = draft.input;
  return [...draft.front.battles, ...draft.standing].flatMap(({ battle, site }): AirOverFoughtBattle[] => {
    const { attackerFactionId, defenders } = battle.engagement;
    const defenderFactionIds = factionsOf(defenders.map((combatant) => combatant.unit));
    const air = airOverHookedBattle({
      attackerFactionId,
      battleIndex: battle.index,
      defenderFactionIds,
      defenderUnitIds: defenders.map((combatant) => combatant.unit.id),
      diggingIn: false,
      scenario,
      state: start,
      territoryId: site.territoryId
    }, scratch);
    return air === undefined ? [] : [{ air, battleIndex: battle.index, territoryId: site.territoryId }];
  });
}

/** R11 for planning: an attack's planned Ground Support, and the chance that it applies. */
export interface PlannedAir {
  /** The chance the support applies: the attacker's chance to win the air, or 1 when nothing opposes it. */
  readonly chance: number;
  /** The air battle as the planner can see it: its own Ground Support against the defenders' AA. */
  readonly input: AirBattleInput;
  /** The support, when it applies, as the battle's `air-support` modifier. */
  readonly modifier: CombatModifier;
  /** The air battle's exact odds when one would be fought; absent when the support goes unopposed. */
  readonly odds?: AirBattleOdds;
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
  const support = groundSupport(input, "attacker").attacker;
  if (support.roll === 0) return undefined;
  const modifier: CombatModifier = { factionId: setting.attackerFactionId, kind: "air-support", role: "attack", roll: support.roll, unitIds: support.unitIds };
  if (!airBattleFought(input)) return { chance: 1, input, modifier };
  const odds = airBattleOdds(input);
  return { chance: odds.attackerWins, input, modifier, odds };
}
