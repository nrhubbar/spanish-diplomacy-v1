import { type Armies, type Combatant, combatantsOf, compareIds, factionsOf, inScenarioOrder, placeAt, removeArmies, replaceArmies, requireArmy } from "../board";
import type { BattleDice } from "../dice";
import { flightsAfter } from "../air/groundSupport";
import type { Leaving } from "../retreat";
import type { FactionId, GameState, MoveOrder, Occupation, ReinforcementArrivedOutcome, Scenario, SuccessfulMoveOutcome, TerritoryId, UnitId, UnitState } from "../types";
import { type BattleInput, fight, type FoughtBattle, type PendingBattle, rollD20 } from "./battle";
import { fightingSurvivors } from "./grades";
import { fightingSide } from "./modifiers";
import { canFight, hasFighter } from "../units/fighting";
import { fightingValue, isGeneralUnit, typeOf } from "./rules";

/** The result of the territory-battle step (M17-M19). */
export interface FrontResolution {
  readonly armies: Armies;
  readonly arrivals: readonly (SuccessfulMoveOutcome | ReinforcementArrivedOutcome)[];
  readonly battles: readonly PendingBattle[];
  readonly leaving: readonly Leaving[];
}

/** What the territory-battle step reads (M17-M19). */
export interface Front extends BattleInput {
  readonly armies: Armies;
  readonly continuing: readonly MoveOrder[];
  readonly dice: BattleDice;
  readonly firstIndex: number;
  readonly origins: ReadonlyMap<UnitId, TerritoryId>;
}

interface Site {
  readonly attackers: readonly MoveOrder[];
  readonly defenders: readonly Combatant[];
  readonly kind: "assault" | "entry";
  readonly standing?: FactionId;
  readonly territoryId: TerritoryId;
}

/**
 * M17-M19 (D1-D7, P4, P5, C3): every territory that moves still head for, in id
 * order. Each attacking faction fights the defenders separately, from one
 * snapshot of values; the defenders' losses add up battle by battle. A grade with ground
 * "all" ousts the defenders and lets M18 pick the occupant. A partial grade (1 or 2) in a
 * territory with several sub-territories brings the attackers in beside the defenders, who fall
 * back inside it (P5); elsewhere it acts as a stalemate (Q-D20-7).
 */
export function resolveFront(scenario: Scenario, front: Front): FrontResolution {
  const inTransit = new Set(front.continuing.map((order) => order.unitId));
  const targets = [...new Set(front.continuing.map((order) => order.to))].sort(compareIds);
  const arrivals: (SuccessfulMoveOutcome | ReinforcementArrivedOutcome)[] = [];
  const battles: PendingBattle[] = [];
  const leaving: Leaving[] = [];
  let armies = front.armies;
  let next = front.firstIndex;

  for (const territoryId of targets) {
    const entrants = front.continuing.filter((order) => order.to === territoryId);
    const present = Object.values(front.armies).filter((unit) => unit.territoryId === territoryId && !inTransit.has(unit.id));
    const defending = factionsOf(present);
    const joiners = entrants.filter((order) => defending.includes(order.factionId));
    const advancing = entrants.filter((order) => !defending.includes(order.factionId));
    arrivals.push(...joiners.map((order): ReinforcementArrivedOutcome => ({ kind: "reinforcement-arrived", order })));
    armies = replaceArmies(armies, joiners.map((order) => placeAt(requireArmy(armies, order.unitId), territoryId)));

    const site = siteOf(scenario, front, territoryId, [
      ...present.map((unit) => ({ from: front.origins.get(unit.id) ?? territoryId, unit })),
      ...joiners.map((order) => ({ from: order.from, unit: requireArmy(front.armies, order.unitId) }))
    ], advancing);
    if (site === "unopposed") {
      arrivals.push(...advancing.map((order): SuccessfulMoveOutcome => ({ kind: "successful-move", order })));
      armies = replaceArmies(armies, advancing.map((order) => placeAt(requireArmy(armies, order.unitId), territoryId)));
    } else if (site === "standoff") {
      leaving.push(...advancing.map((order) => bounceOf(scenario, order, factionsOf(advancing))));
    } else if (site !== undefined) {
      const settled = settleSite(scenario, front, site, next);
      // D5, D27.1: where every other entrant turned back without a battle, the leader walked in unopposed.
      if (site.kind === "entry" && settled.battles.length === 0) {
        const leaders = new Set(site.defenders.map((combatant) => combatant.unit.id));
        arrivals.push(...advancing.filter((order) => leaders.has(order.unitId)).map((order): SuccessfulMoveOutcome => ({ kind: "successful-move", order })));
      }
      next += settled.battles.length;
      battles.push(...settled.battles);
      leaving.push(...settled.leaving);
      armies = removeArmies(replaceArmies(armies, settled.updates), settled.destroyed);
    }
  }
  return { armies, arrivals, battles, leaving };
}

function bounceOf(scenario: Scenario, order: MoveOrder, opposing: readonly FactionId[]): Leaving {
  return {
    from: order.from,
    kind: "return",
    report: { opposingFactionIds: inScenarioOrder(scenario, opposing).filter((id) => id !== order.factionId), order },
    unitId: order.unitId
  };
}

/**
 * M19 with C3: in an empty territory entered by several factions, the entrant holding its
 * capital sub-territory (else its last controller) stands as the defender when three or more
 * factions enter; otherwise the entrant with the greatest attack, and a tie bounces everyone.
 */
function siteOf(scenario: Scenario, front: Front, territoryId: TerritoryId, defenders: readonly Combatant[], advancing: readonly MoveOrder[]): Site | "unopposed" | "standoff" | undefined {
  if (advancing.length === 0) return undefined;
  if (defenders.length > 0) return { attackers: advancing, defenders, kind: "assault", territoryId };
  const factionIds = factionsOf(advancing);
  if (factionIds.length === 1) return "unopposed";
  const attack = factionIds.map((factionId) => ({
    factionId,
    value: fightingSide(scenario, front.start, combatantsOf(front.armies, advancing.filter((order) => order.factionId === factionId)), "attack").value
  }));
  // C3 with D27.1: the capital holder stands only with an entrant that can fight.
  const capitalHolder = factionIds.length >= 3 ? standingHolder(scenario, front.start, territoryId, factionIds) : undefined;
  const holder = capitalHolder !== undefined
    && hasFighter(scenario, front.start.raised, advancing.filter((order) => order.factionId === capitalHolder).map((order) => order.unitId)) ? capitalHolder : undefined;
  const greatest = Math.max(...attack.map((entry) => entry.value));
  const leaders = attack.filter((entry) => entry.value === greatest).map((entry) => entry.factionId);
  const [leader] = holder === undefined ? leaders : [holder];
  if (leader === undefined || (holder === undefined && leaders.length > 1)) return "standoff";
  return {
    attackers: advancing.filter((order) => order.factionId !== leader),
    defenders: combatantsOf(front.armies, advancing.filter((order) => order.factionId === leader)),
    kind: "entry",
    standing: leader,
    territoryId
  };
}

/** C3: the faction among `factionIds` holding the territory's capital sub-territory, else its last controller. */
export function standingHolder(scenario: Scenario, start: GameState, territoryId: TerritoryId, factionIds: readonly FactionId[]): FactionId | undefined {
  const capital = scenario.index.territories.get(territoryId)?.capitalSubTerritoryId;
  const capitalHolder = capital === undefined ? undefined : start.subTerritories[capital]?.holder;
  if (capitalHolder !== undefined && factionIds.includes(capitalHolder)) return capitalHolder;
  const control = start.control[territoryId];
  return control?.kind === "controlled" && factionIds.includes(control.factionId) ? control.factionId : undefined;
}

/** P5: partial grades take ground only where the territory has several sub-territories and the partition module is on. */
function partialGroundApplies(scenario: Scenario, territoryId: TerritoryId): boolean {
  return scenario.rules.partition !== "none" && (scenario.index.subTerritoriesByTerritory.get(territoryId)?.length ?? 0) > 1;
}

/**
 * D5, D27.1: a side that cannot attack: none of its units can fight (`canFight`) without
 * company, so it is empty, or made only of generals, units with no attack (trucks, anti-air)
 * and units that cannot attack alone (artillery).
 */
export function cannotAttackAlone(scenario: Scenario, start: Pick<GameState, "raised">, units: readonly UnitState[]): boolean {
  return !units.some((unit) => {
    const type = typeOf(scenario, start.raised, unit.id);
    return canFight(scenario, start.raised, unit.id) && !type.effects.some((effect) => effect.kind === "cannot-attack-alone");
  });
}

interface SettledSite {
  readonly battles: readonly PendingBattle[];
  readonly destroyed: readonly UnitId[];
  readonly leaving: readonly Leaving[];
  readonly updates: readonly UnitState[];
}

function settleSite(scenario: Scenario, front: Front, site: Site, firstIndex: number): SettledSite {
  const defenderFactionIds = factionsOf(site.defenders.map((combatant) => combatant.unit));
  const leaving: Leaving[] = [];
  const updates: UnitState[] = [];
  let current = front.armies;
  let scratch = front.scratch;
  const fought: FoughtBattle[] = [];
  for (const factionId of factionsOf(site.attackers)) {
    const orders = site.attackers.filter((order) => order.factionId === factionId);
    const attackers = combatantsOf(front.armies, orders);
    if (cannotAttackAlone(scenario, front.start, attackers.map((combatant) => combatant.unit))) {
      // D5, D27.1: artillery alone, or a side with nothing that can fight, turns back without a battle.
      leaving.push(...orders.map((order) => bounceOf(scenario, order, defenderFactionIds)));
      updates.push(...attackers.map((combatant) => combatant.unit));
      continue;
    }
    const index = firstIndex + fought.length;
    const battle = fight(scenario, { ...front, ...(scratch === undefined ? {} : { scratch }) }, current, {
      attackerFactionId: factionId,
      attackers,
      context: { attackerFactionId: factionId, defenderFactionIds, diggingIn: site.kind === "assault", territoryId: site.territoryId },
      defenderRole: site.kind === "entry" ? "attack" : "defence",
      defenders: site.defenders
    }, index, rollD20(front.dice(index)));
    fought.push(battle);
    // R11: an aircraft shot down over this battle is not over the next one here.
    if (scratch?.air !== undefined && battle.air !== undefined) scratch = { ...scratch, air: flightsAfter(scratch.air, battle.air) };
    // M17: the defenders' losses add up across attacks.
    const gone = battle.defenderCasualties.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId);
    current = removeArmies(replaceArmies(current, battle.defenderCasualties.survivors), gone);
  }

  const defendersLeft = site.defenders.flatMap(({ unit }) => current[unit.id] ?? []);
  const defendersFight = defendersLeft.some((unit) => !isGeneralUnit(scenario, front.start.raised, unit.id));
  const attackerLeft = (battle: FoughtBattle) => fightingSurvivors(scenario, front.start, battle.attackerCasualties).length > 0;
  // M18: a whole-territory grade, or no defender left to hold, makes a claim.
  const claims = fought.filter((battle) => attackerLeft(battle) && (battle.grade.ground === "all" || !defendersFight));
  const ousted = fought.some((battle) => battle.grade.ground === "all") || !defendersFight;
  const occupant = occupantOf(scenario, front, claims);
  const partial = site.kind === "assault" && !ousted && partialGroundApplies(scenario, site.territoryId);
  const entering = new Set(fought.filter((battle) => battle.engagement.attackerFactionId === occupant
    || (partial && battle.grade.ground !== "all" && battle.grade.ground !== 0 && attackerLeft(battle))).map((battle) => battle.index));
  const occupation: Occupation = occupant !== undefined ? { factionId: occupant, kind: "taken" }
    : !ousted ? (site.standing === undefined ? { kind: "held" } : { factionId: site.standing, kind: "taken" })
    : { kind: "left-empty" };

  const battles = fought.map((battle): PendingBattle => {
    const ground = !entering.has(battle.index) ? 0 : battle.engagement.attackerFactionId === occupant ? "all" : battle.grade.ground;
    return {
      battle: { ...battle, ground },
      report: {
        demoralizedUnitIds: [...battle.attackerCasualties.demoralized, ...battle.defenderCasualties.demoralized],
        losses: [...battle.attackerCasualties.losses, ...battle.defenderCasualties.losses],
        retreats: [],
        surrenderedUnitIds: []
      },
      site: { kind: site.kind, occupation, territoryId: site.territoryId }
    };
  });

  for (const battle of fought) {
    for (const unit of battle.attackerCasualties.survivors) {
      if (entering.has(battle.index)) {
        updates.push(placeAt(unit, site.territoryId));
      } else {
        updates.push(unit);
        leaving.push({ from: originOf(front, unit.id), kind: "return", report: { battleIndex: battle.index }, unitId: unit.id });
      }
    }
  }
  const ouster = fought.find((battle) => battle.grade.ground === "all") ?? fought[0];
  for (const unit of defendersLeft) {
    if (ousted && ouster !== undefined && site.kind === "assault") {
      leaving.push({ from: site.territoryId, kind: "retreat", report: { battleIndex: ouster.index }, unitId: unit.id });
      updates.push(placeAt(unit, site.territoryId));
    } else if (ousted && ouster !== undefined) {
      // An ousted standing entrant never got in: it returns to its origin (M21).
      leaving.push({ from: originOf(front, unit.id), kind: "return", report: { battleIndex: ouster.index }, unitId: unit.id });
      updates.push(unit);
    } else {
      updates.push(placeAt(unit, site.territoryId));
    }
  }
  const destroyed = [
    ...fought.flatMap((battle) => battle.attackerCasualties.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId)),
    ...site.defenders.map(({ unit }) => unit.id).filter((id) => current[id] === undefined)
  ];
  return { battles, destroyed, leaving, updates };
}

/** M18: one claimant moves in; with several, the greatest attack left after its own losses; a tie, nobody. */
function occupantOf(scenario: Scenario, front: Front, claims: readonly FoughtBattle[]): FactionId | undefined {
  const values = claims.map((battle) => ({
    factionId: battle.engagement.attackerFactionId,
    value: battle.attackerCasualties.survivors.reduce((sum, unit) => sum + fightingValue(scenario, front.start.raised, unit, "attack"), 0)
  }));
  const greatest = Math.max(...values.map((entry) => entry.value));
  const leaders = values.filter((entry) => entry.value === greatest);
  return leaders.length === 1 ? leaders[0]?.factionId : undefined;
}

function originOf(front: Front, id: UnitId): TerritoryId {
  const origin = front.origins.get(id);
  if (origin === undefined) throw new Error(`Invariant violated: army "${id}" moved without an origin.`);
  return origin;
}
