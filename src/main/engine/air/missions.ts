import { compareIds, removeArmies } from "../board";
import { pick } from "../dice";
import { sackGenerals } from "../generals/changes";
import { hookedGrounded } from "../hooks";
import type { Phase, TurnDraft } from "../phases/draft";
import type {
  AirMissionOrder,
  AirTurnOutcome,
  BuildingId,
  DevelopmentId,
  FactionId,
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
import { generalsSetAside, unitKindIn, unitTypeIn } from "./pieces";
import { airScratch, validOrdersOf } from "./scratch";
import { missionTerritory } from "./validation";

/**
 * Step 1, after the engine's reveal (AG-3, AG-4): sackings take effect, then aircraft and
 * generals leave the board until step 9, so only ground units march, fight and hold ground.
 * A general's move is kept aside too: he goes where his army arrives. His army is the ground
 * units of his faction moving with him (same origin and destination) or holding with him.
 */
export const setAside: Phase = (input) => {
  const draft = sackGenerals(input, validOrdersOf(input, "sack"));
  const { scenario, start } = draft.input;
  const aside: Record<UnitId, UnitState> = {};
  for (const unit of Object.values(draft.armies)) {
    const kind = unitKindIn(scenario, start.raised, unit.id);
    // D17: aircraft are never ground combatants; generals leave the ground steps only under the d6 table (AG-2).
    if (kind === "air" || (kind === "general" && generalsSetAside(scenario))) aside[unit.id] = unit;
  }
  // C1: a set-aside general's Withdraw goes where his withdrawing army goes, like a move (d6 table only).
  const moves = [...draft.orders.valid, ...validOrdersOf(draft, "withdraw")];
  const generalMoves: Record<UnitId, TerritoryId> = {};
  for (const order of moves) if (aside[order.unitId] !== undefined && unitKindIn(scenario, start.raised, order.unitId) === "general") generalMoves[order.unitId] = order.to;
  const moving = new Map(moves.map((order) => [order.unitId, order]));
  const armies: Record<UnitId, readonly UnitId[]> = {};
  for (const general of Object.values(aside)) {
    if (unitKindIn(scenario, start.raised, general.id) !== "general") continue;
    const to = generalMoves[general.id];
    armies[general.id] = Object.values(draft.armies)
      .filter((unit) => unit.factionId === general.factionId && aside[unit.id] === undefined && unit.territoryId === general.territoryId)
      .filter((unit) => {
        const order = moving.get(unit.id);
        return to === undefined ? order === undefined : order?.to === to;
      })
      .map((unit) => unit.id)
      .sort(compareIds);
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
    scratch: { ...draft.scratch, air: { ...airScratch(draft), armies, aside, generalMoves } }
  };
};

/** U3: the best (most negative) anti-air modifier among other factions' ground units in the territory. */
function antiAirIn(draft: TurnDraft, territoryId: TerritoryId, raider: FactionId): number {
  const { scenario, start } = draft.input;
  let best = 0;
  for (const unit of Object.values(draft.armies)) {
    if (unit.territoryId !== territoryId || unit.factionId === raider) continue;
    for (const effect of unitTypeIn(scenario, start.raised, unit.id)?.effects ?? []) {
      if (effect.kind === "raid-defence") best = Math.min(best, effect.roll);
    }
  }
  return best;
}

/** U3: the band of the raid table a modified roll falls in. */
export function raidResult(scenario: Scenario, roll: number): RaidOutcome {
  const table = scenario.air?.raidTable ?? [];
  const clamped = Math.min(20, Math.max(1, roll));
  return table.find((band) => clamped <= band.upTo)?.outcome ?? "nothing-hit";
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
      events.push({ kind: "grounded", order, reason: "weather" });
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
    const die = pick(stream, 20);
    const against = interceptors.filter((other) => other.factionId !== order.factionId && missionTerritory(scenario, other.mission) === territoryId);
    const roll = die + antiAirIn(draft, territoryId, order.factionId) + against.length * air.interceptRoll;
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
    const roll = pick(streams("raid", raidIndex), 20) + against.length * air.interceptRoll;
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
