import { compareIds, removeArmies } from "../board";
import { d20Faces } from "../d20/rules";
import { dieFaces, pick } from "../dice";
import { sackGenerals } from "../generals/changes";
import { hookedGrounded } from "../hooks";
import type { Phase } from "../phases/draft";
import type {
  AirMissionOrder,
  AirTurnOutcome,
  BuildingId,
  DevelopmentId,
  FactionId,
  GameState,
  RaidCut,
  RaidOutcome,
  ReconReveal,
  Scenario,
  SubTerritoryId,
  SubTerritoryState,
  SystemOutcome,
  TerritoryId,
  UnitId,
  UnitState
} from "../types";
import { antiAirOf } from "./groundSupport";
import { unitKindIn } from "./pieces";
import { airScratch, validOrdersOf } from "./scratch";
import { missionTerritory } from "./validation";

/**
 * Step 1, after the engine's reveal (AG-3, AG-4): sackings take effect, then aircraft
 * are taken off the board until step 9, so they never march, fight on the ground or hold it (D17).
 */
export const setAside: Phase = (input) => {
  const draft = sackGenerals(input, validOrdersOf(input, "sack"));
  const { scenario, start } = draft.input;
  const aside: Record<UnitId, UnitState> = {};
  for (const unit of Object.values(draft.armies)) {
    if (unitKindIn(scenario, start.raised, unit.id) === "air") aside[unit.id] = unit;
  }
  const keep = (order: { readonly unitId: UnitId }): boolean => aside[order.unitId] === undefined;
  const origins = new Map([...draft.orders.origins].filter(([id]) => aside[id] === undefined));
  return {
    ...draft,
    armies: removeArmies(draft.armies, Object.keys(aside) as UnitId[]),
    orders: {
      ...draft.orders,
      advances: draft.orders.advances.filter(keep),
      origins,
      reinforcements: draft.orders.reinforcements.filter(keep),
      valid: draft.orders.valid.filter(keep)
    },
    scratch: { ...draft.scratch, air: { ...airScratch(draft), aside } }
  };
};

/** U3: what anti-air does to a raid's roll in a territory: the best among other factions' units there, 0 or below. */
export function raidDefence(scenario: Scenario, raised: GameState["raised"], units: readonly UnitState[], territoryId: TerritoryId, raider: FactionId): number {
  const defenders = units.filter((unit) => unit.territoryId === territoryId && unit.factionId !== raider);
  return 0 - antiAirOf(scenario, raised, defenders.map((unit) => unit.id));
}

/** U3: the band of the raid table a modified roll falls in. */
export function raidResult(scenario: Scenario, roll: number): RaidOutcome {
  const table = scenario.air?.raidTable ?? [];
  const clamped = Math.min(dieFaces, Math.max(1, roll));
  return table.find((band) => clamped <= band.upTo)?.outcome ?? "nothing-hit";
}

/** U3: the chance of each outcome of a raid whose roll is changed by `modifier`. */
export function raidChances(scenario: Scenario, modifier: number): Readonly<Record<RaidOutcome, number>> {
  const chances: Record<RaidOutcome, number> = { "air-eliminated": 0, "building-hit": 0, "income-cut": 0, "nothing-hit": 0 };
  for (const die of d20Faces) chances[raidResult(scenario, die + modifier)] += 1 / dieFaces;
  return chances;
}

/** U3: "Building downgraded or destroyed": a paved airfield falls back to its airfield; any other building is destroyed. Without buildings, the highest development level drops. */
function hitBuilding(
  scenario: Scenario,
  sub: SubTerritoryState,
  draw: number
): { readonly buildingId?: BuildingId; readonly developmentId?: DevelopmentId; readonly next: SubTerritoryState } {
  if (sub.buildings.length > 0) {
    const index = pick(() => draw, sub.buildings.length) - 1;
    const buildingId = sub.buildings[index] as BuildingId;
    const downgrade = scenario.index.buildings.get(buildingId)?.upgradeOf;
    const rest = sub.buildings.filter((_, at) => at !== index);
    const buildings = downgrade === undefined || rest.includes(downgrade) ? rest : [...rest, downgrade];
    return { buildingId, next: { ...sub, buildings } };
  }
  const levels = Object.entries(sub.development).filter(([, level]) => level > 0).sort((a, b) => b[1] - a[1] || compareIds(a[0], b[0]));
  const top = levels[0];
  if (top === undefined) return { next: sub };
  const developmentId = top[0] as DevelopmentId;
  return { developmentId, next: { ...sub, development: { ...sub.development, [developmentId]: top[1] - 1 } } };
}

/**
 * Step 2 (U2-U4, R10): every valid air mission flies unless its aircraft is grounded (the
 * `grounded` hook). Fighters on Patrol intercept enemy raids and recon over their territory
 * (D27.3). Each raid rolls a d20 from the `raid` stream, worsened by the best anti-air in the
 * target territory and by `interceptRoll` per intercepting fighter, and reads the raid table. An
 * intercepted recon flight then rolls on the same stream and is shot down on "air eliminated".
 * Recon that gets through reveals the target territory until `reconTurns` turns on. Ground
 * Support is never intercepted: it and the Patrols wait in the scratch for the battle hooks,
 * where the air battle decides whose Ground Support applies (R11).
 */
export const flyAirMissions: Phase = (draft) => {
  const { scenario, start, streams } = draft.input;
  const air = scenario.air;
  if (air === undefined) return draft;
  const events: AirTurnOutcome[] = [];
  const flying: AirMissionOrder[] = [];
  const orders = [...validOrdersOf(draft, "air-mission")].sort((a, b) => compareIds(a.unitId, b.unitId));
  const scratch = airScratch(draft);
  for (const order of orders) {
    const unit = scratch.aside[order.unitId];
    if (unit === undefined) continue;
    if (hookedGrounded({ scenario, state: start, territoryId: unit.territoryId, unitId: unit.id })) {
      events.push({ kind: "grounded", order, refusal: { code: "grounded-by-weather" } });
    } else {
      flying.push(order);
    }
  }

  const interceptors = flying.filter((order) => order.mission.kind === "patrol");
  const lost = new Set<UnitId>();
  const raidCuts: RaidCut[] = [];
  let subTerritories = draft.systems.subTerritories;
  let raidIndex = 0;
  const interceptions = new Map<string, { factionId: FactionId; interceptorIds: UnitId[]; lostUnitIds: UnitId[]; raiderIds: UnitId[]; territoryId: TerritoryId }>();
  for (const order of flying) {
    if (order.mission.kind !== "raid") continue;
    const subTerritoryId: SubTerritoryId = order.mission.subTerritoryId;
    const territoryId = missionTerritory(scenario, order.mission);
    if (territoryId === undefined) continue;
    const stream = streams("raid", raidIndex);
    raidIndex += 1;
    const die = pick(stream, dieFaces);
    const against = interceptors.filter((other) => other.factionId !== order.factionId && missionTerritory(scenario, other.mission) === territoryId);
    const roll = die + raidDefence(scenario, start.raised, Object.values(draft.armies), territoryId, order.factionId) + against.length * air.interceptRoll;
    const result = raidResult(scenario, roll);
    const aircraftLost = result === "air-eliminated" ? [order.unitId] : [];
    for (const id of aircraftLost) lost.add(id);
    let buildingHit: { buildingId?: BuildingId; developmentId?: DevelopmentId } = {};
    const sub = subTerritories[subTerritoryId];
    // U3: the cut falls on the faction raided, never on whoever holds the ground when income is paid.
    if (result === "income-cut" && sub !== undefined) raidCuts.push({ factionId: sub.holder, subTerritoryId, turnNumber: start.turnNumber + 1 });
    if (result === "building-hit" && sub !== undefined) {
      const hit = hitBuilding(scenario, sub, stream());
      subTerritories = { ...subTerritories, [subTerritoryId]: hit.next };
      buildingHit = { ...(hit.buildingId === undefined ? {} : { buildingId: hit.buildingId }), ...(hit.developmentId === undefined ? {} : { developmentId: hit.developmentId }) };
    }
    events.push({ aircraftLost, kind: "raid", order, result, roll, subTerritoryId, ...buildingHit });
    for (const fighter of against) {
      const key = `${territoryId}|${fighter.factionId}`;
      const entry = interceptions.get(key) ?? { factionId: fighter.factionId, interceptorIds: [], lostUnitIds: [], raiderIds: [], territoryId };
      if (!entry.interceptorIds.includes(fighter.unitId)) entry.interceptorIds.push(fighter.unitId);
      if (!entry.raiderIds.includes(order.unitId)) entry.raiderIds.push(order.unitId);
      if (aircraftLost.length > 0 && !entry.lostUnitIds.includes(order.unitId)) entry.lostUnitIds.push(order.unitId);
      interceptions.set(key, entry);
    }
  }
  // D27.3: enemy fighters intercept recon flights over their territory too. Each intercepted
  // flight rolls a d20 on the raid stream after the raids, worsened by `interceptRoll` per
  // fighter, and is shot down on the raid table's "air eliminated"; otherwise it flies. R11:
  // Ground Support is not intercepted; the air battle over its battle decides it instead.
  const reconInterceptions = new Map<string, { factionId: FactionId; interceptorIds: UnitId[]; lostUnitIds: UnitId[]; raiderIds: UnitId[]; reconFactionIds: FactionId[]; territoryId: TerritoryId }>();
  for (const order of flying) {
    if (order.mission.kind !== "recon") continue;
    const territoryId = order.mission.territoryId;
    const against = interceptors.filter((other) => other.factionId !== order.factionId && missionTerritory(scenario, other.mission) === territoryId);
    if (against.length === 0) continue;
    const roll = pick(streams("raid", raidIndex), dieFaces) + against.length * air.interceptRoll;
    raidIndex += 1;
    // CT-46: a recon flight is reported only when shot down, in an interception of its own that
    // only the fighters' faction and the flier see (`visibility.ts`): it names the recon's target.
    if (raidResult(scenario, roll) !== "air-eliminated") continue;
    lost.add(order.unitId);
    for (const fighter of against) {
      const key = `${territoryId}|${fighter.factionId}`;
      const entry = reconInterceptions.get(key) ?? { factionId: fighter.factionId, interceptorIds: [], lostUnitIds: [], raiderIds: [], reconFactionIds: [], territoryId };
      if (!entry.reconFactionIds.includes(order.factionId)) entry.reconFactionIds.push(order.factionId);
      if (!entry.interceptorIds.includes(fighter.unitId)) entry.interceptorIds.push(fighter.unitId);
      if (!entry.raiderIds.includes(order.unitId)) entry.raiderIds.push(order.unitId);
      if (!entry.lostUnitIds.includes(order.unitId)) entry.lostUnitIds.push(order.unitId);
      reconInterceptions.set(key, entry);
    }
  }
  for (const entry of [...interceptions.values(), ...reconInterceptions.values()]) events.push({ kind: "interception", ...entry });

  const reveals: ReconReveal[] = [];
  for (const order of flying) {
    if (order.mission.kind !== "recon" || lost.has(order.unitId)) continue;
    const untilTurn = start.turnNumber + air.reconTurns;
    reveals.push({ territoryId: order.mission.territoryId, untilTurn, viewerFactionId: order.factionId });
    events.push({ kind: "recon", order, territoryId: order.mission.territoryId, untilTurn });
  }

  const aside = Object.fromEntries(Object.entries(scratch.aside).filter(([id]) => !lost.has(id as UnitId)));
  const support = flying.filter((order) => order.mission.kind === "support");
  return {
    ...draft,
    events: [...draft.events, ...(events as SystemOutcome[])],
    scratch: { ...draft.scratch, air: { ...scratch, aside, patrols: interceptors, streams, support } },
    systems: {
      ...draft.systems,
      raidCuts: [...draft.systems.raidCuts, ...raidCuts],
      reveals: [...draft.systems.reveals, ...reveals],
      subTerritories
    }
  };
};
