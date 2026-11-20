import { isAirbaseFor, territoriesWithin, unitKindIn, unitTypeIn } from "../../engine/air/pieces";
import { validateAirMission, validateSack } from "../../engine/air/validation";
import { compareIds } from "../../engine/board";
import type {
  AirMission,
  AirMissionKind,
  AirMissionOrder,
  GameState,
  RaidOutcome,
  SackOrder,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitId
} from "../../engine/types";
import type { Draft } from "../session";
import type { PlanningSession } from "./selection";

/**
 * U2-U5 in the planning draft (m3r1-air-generals): one mission per aircraft and the Sack orders,
 * kept apart from the moves in `Draft.airOrders` and carried through selection changes by
 * `withDraft`. An aircraft is selected like a unit, on its own: the pane shows its missions.
 */

export type AirDraftOrder = AirMissionOrder | SackOrder;

/** What `withDraft` keeps from the old draft when a new one leaves it out. */
export function keepAirOrders(draft: Draft): Pick<Draft, "airOrders"> {
  return draft.airOrders === undefined ? {} : { airOrders: draft.airOrders };
}

/** The air missions and sackings to submit. A unit with a move keeps the move (M1: one order a unit). */
export function airDraftOrders(draft: Draft): readonly AirDraftOrder[] {
  const moving = new Set(draft.orders.map((order) => order.unitId));
  return (draft.airOrders ?? []).filter((order) => !moving.has(order.unitId));
}

export function isAircraft(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): boolean {
  return unitKindIn(scenario, state.raised, unitId) === "air";
}

/** The planned mission of an aircraft, if any. */
export function plannedMission(draft: Draft, unitId: UnitId): AirMissionOrder | undefined {
  return draft.airOrders?.find((order): order is AirMissionOrder => order.kind === "air-mission" && order.unitId === unitId);
}

/** Whether a Sack order is planned for a general. */
export function isSackPlanned(draft: Draft, unitId: UnitId): boolean {
  return draft.airOrders?.some((order) => order.kind === "sack" && order.unitId === unitId) ?? false;
}

/** U2: selecting an own aircraft opens its missions; its territory is selected behind it. */
export function selectAircraft(session: PlanningSession, unitId: UnitId): PlanningSession {
  const unit = session.game.state.units[unitId];
  if (unit === undefined || unit.factionId !== session.factionId) return session;
  return {
    ...session,
    draft: { ...keepAirOrders(session.draft), orders: session.draft.orders, selectedAircraftId: unitId, selectedTerritoryId: unit.territoryId, selectedUnitIds: [] }
  };
}

/** Closes the aircraft's missions and returns to its territory. */
export function closeAircraft(session: PlanningSession): PlanningSession {
  const draft: Draft = { ...session.draft };
  delete (draft as { selectedAircraftId?: UnitId }).selectedAircraftId;
  return { ...session, draft };
}

function withAirOrders(session: PlanningSession, airOrders: readonly AirDraftOrder[], feedback?: string): PlanningSession {
  return { ...session, draft: { ...session.draft, airOrders, ...(feedback === undefined ? {} : { feedback }) } };
}

/** U2: plans (or with no mission, stands down) an aircraft's one mission this turn. */
export function setAirMission(scenario: Scenario, session: PlanningSession, unitId: UnitId, mission: AirMission | undefined): PlanningSession {
  const others = (session.draft.airOrders ?? []).filter((order) => order.unitId !== unitId);
  if (mission === undefined) return withAirOrders(session, others);
  const order: AirMissionOrder = { factionId: session.factionId, kind: "air-mission", mission, unitId };
  const validation = validateAirMission(scenario, session.game.state, order);
  if (!validation.ok) return { ...session, draft: { ...session.draft, feedback: validation.reason } };
  return withAirOrders(session, [...others, order]);
}

/** U5: Sack is a free order; it replaces the general's move, and choosing it again withdraws it. */
export function toggleSack(scenario: Scenario, session: PlanningSession, unitId: UnitId): PlanningSession {
  const current = session.draft.airOrders ?? [];
  if (isSackPlanned(session.draft, unitId)) return withAirOrders(session, current.filter((order) => order.unitId !== unitId));
  const order: SackOrder = { factionId: session.factionId, kind: "sack", unitId };
  const validation = validateSack(scenario, session.game.state, order);
  if (!validation.ok) return { ...session, draft: { ...session.draft, feedback: validation.reason } };
  return {
    ...session,
    draft: { ...session.draft, airOrders: [...current.filter((other) => other.unitId !== unitId), order], orders: session.draft.orders.filter((move) => move.unitId !== unitId) }
  };
}

/** One target a mission may fly to: a territory, or for raids a sub-territory. */
export interface AirTarget {
  readonly distance: number;
  readonly mission: AirMission;
  readonly name: string;
  readonly territoryId: TerritoryId;
}

/** U2-U4: every valid target of a mission kind for the aircraft, nearest first, then by name. */
export function airTargets(scenario: Scenario, state: GameState, unitId: UnitId, kind: AirMissionKind): readonly AirTarget[] {
  const unit = state.units[unitId];
  const range = unitTypeIn(scenario, state.raised, unitId)?.air?.range;
  if (unit === undefined || range === undefined) return [];
  const reach = territoriesWithin(scenario, unit.territoryId, range);
  const targets: AirTarget[] = [];
  for (const [territoryId, distance] of reach) {
    const territoryName = scenario.index.territories.get(territoryId)?.name ?? territoryId;
    const missions: { readonly mission: AirMission; readonly name: string }[] = kind === "raid"
      ? (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).map((sub) => ({ mission: { kind, subTerritoryId: sub.id }, name: sub.name === territoryName ? sub.name : `${sub.name} (${territoryName})` }))
      : [{ mission: { kind, territoryId }, name: territoryName }];
    for (const entry of missions) {
      if (validateAirMission(scenario, state, { factionId: unit.factionId, kind: "air-mission", mission: entry.mission, unitId }).ok) {
        targets.push({ distance, mission: entry.mission, name: entry.name, territoryId });
      }
    }
  }
  return targets.sort((a, b) => a.distance - b.distance || compareIds(a.name, b.name));
}

/** The territory a planned mission flies to. */
export function missionTerritoryId(scenario: Scenario, mission: AirMission): TerritoryId | undefined {
  return mission.kind === "raid" ? scenario.index.subTerritories.get(mission.subTerritoryId)?.territoryId : mission.territoryId;
}

/** What the pane says about a raid before it flies: anti-air there, enemy fighters in reach, the outcome chances. */
export interface RaidPreview {
  readonly antiAir: number;
  readonly chances: Readonly<Record<RaidOutcome, number>>;
  readonly fightersInReach: number;
}

/** U3: the raid roll's chances with the target's anti-air; intercepting fighters, unknown in advance, would worsen it. */
export function raidPreview(scenario: Scenario, state: GameState, unitId: UnitId, subTerritoryId: SubTerritoryId): RaidPreview | undefined {
  const unit = state.units[unitId];
  const territoryId = scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  if (unit === undefined || territoryId === undefined || scenario.air === undefined) return undefined;
  let antiAir = 0;
  let fightersInReach = 0;
  for (const other of Object.values(state.units)) {
    if (other.factionId === unit.factionId) continue;
    const type = unitTypeIn(scenario, state.raised, other.id);
    if (other.territoryId === territoryId) for (const effect of type?.effects ?? []) if (effect.kind === "raid-defence") antiAir = Math.min(antiAir, effect.roll);
    if (type?.air?.missions.includes("intercept") === true && isAirbaseFor(scenario, state, other.territoryId, other.factionId)
      && territoriesWithin(scenario, other.territoryId, type.air.range).has(territoryId)) fightersInReach += 1;
  }
  const chances: Record<RaidOutcome, number> = { "air-eliminated": 0, "building-hit": 0, "income-cut": 0, "nothing-hit": 0 };
  for (let die = 1; die <= 20; die += 1) {
    const roll = Math.min(20, Math.max(1, die + antiAir));
    const band = scenario.air.raidTable.find((entry) => roll <= entry.upTo);
    if (band !== undefined) chances[band.outcome] += 1 / 20;
  }
  return { antiAir, chances, fightersInReach };
}
