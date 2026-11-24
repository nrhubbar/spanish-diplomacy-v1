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
import { unitOrdersWithout } from "./recruitment";
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
  // Everything planned stays (the Recruit basket, builds, Replenish, U2's armies told to stay); the selection, stage and feedback go.
  const draft: Draft = { ...session.draft, selectedAircraftId: unitId, selectedTerritoryId: unit.territoryId, selectedUnitIds: [] };
  const cleared = draft as { feedback?: string; focusedSubTerritoryId?: unknown; stage?: unknown };
  delete cleared.feedback;
  delete cleared.focusedSubTerritoryId;
  delete cleared.stage;
  return { ...session, draft };
}

/** Closes the aircraft's missions and returns to its territory. */
export function closeAircraft(session: PlanningSession): PlanningSession {
  const draft: Draft = { ...leaveTargets(session).draft };
  delete (draft as { selectedAircraftId?: UnitId }).selectedAircraftId;
  return { ...session, draft };
}

/** N6: leaves the choice of a mission's target, and what was said about it; the aircraft stays selected. */
export function leaveTargets(session: PlanningSession): PlanningSession {
  const draft: Draft = { ...session.draft };
  delete (draft as { feedback?: string }).feedback;
  delete (draft as { stage?: unknown }).stage;
  return { ...session, draft };
}

/** N6: choosing a mission starts choosing its target on the map, unless nothing in range is one. */
export function chooseMission(scenario: Scenario, session: PlanningSession, unitId: UnitId, mission: AirMissionKind): PlanningSession {
  const open = leaveTargets(selectAircraft(session, unitId));
  const stage = { mission, step: "choose-target" } as const;
  const none = airTargets(scenario, open.game.state, unitId, mission).length === 0;
  return { ...open, draft: { ...open.draft, ...(none ? { feedback: "Nothing in range for this mission." } : { stage }) } };
}

/** N6: the targets being chosen from, when a mission is choosing one. */
export function stageTargets(scenario: Scenario, session: PlanningSession): readonly AirTarget[] {
  const { selectedAircraftId, stage } = session.draft;
  return stage?.step === "choose-target" && selectedAircraftId !== undefined ? airTargets(scenario, session.game.state, selectedAircraftId, stage.mission) : [];
}

/** N6: the territories a mission may fly to, nearest first; a raid may have several targets in each. */
export function targetTerritories(scenario: Scenario, session: PlanningSession): readonly TerritoryId[] {
  return [...new Set(stageTargets(scenario, session).map((target) => target.territoryId))];
}

/** N6: why a territory is no target of the mission being chosen; undefined when it is one, or none is being chosen. */
export function targetRefusal(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId): { readonly inRange: boolean; readonly reason: string } | undefined {
  const { draft: { selectedAircraftId: unitId, stage }, factionId, game: { state } } = session;
  const unit = unitId === undefined ? undefined : state.units[unitId];
  if (stage?.step !== "choose-target" || unit === undefined || targetTerritories(scenario, session).includes(territoryId)) return undefined;
  const range = unitTypeIn(scenario, state.raised, unit.id)?.air?.range ?? 0;
  if (!territoriesWithin(scenario, unit.territoryId, range).has(territoryId)) {
    const flies = `flies up to ${range === 1 ? "1 territory" : `${String(range)} territories`} from its airfield.`;
    return { inRange: false, reason: `Out of range: it ${flies}` };
  }
  const [first] = scenario.index.subTerritoriesByTerritory.get(territoryId) ?? [];
  const kind = stage.mission;
  const mission: AirMission | undefined = kind !== "raid" ? { kind, territoryId } : first === undefined ? undefined : { kind, subTerritoryId: first.id };
  const validation = mission === undefined ? undefined : validateAirMission(scenario, state, { factionId, kind: "air-mission", mission, unitId: unit.id });
  return { inRange: true, reason: validation?.ok === false ? validation.reason : "Nothing to hit there." };
}

/** N6: a click on a territory while a mission chooses its target plans it; a raid with several targets there asks which sub-territory. */
export function chooseTarget(scenario: Scenario, session: PlanningSession, territoryId: TerritoryId): PlanningSession {
  const { selectedAircraftId: unitId, stage } = session.draft;
  if (stage?.step !== "choose-target" || unitId === undefined) return session;
  const there = stageTargets(scenario, session).filter((target) => target.territoryId === territoryId);
  const [only] = there;
  if (only === undefined) {
    const refusal = targetRefusal(scenario, session, territoryId);
    return refusal === undefined ? session : { ...session, draft: { ...session.draft, feedback: refusal.reason } };
  }
  if (there.length === 1) return setAirMission(scenario, session, unitId, only.mission);
  const open = leaveTargets(session);
  return { ...open, draft: { ...open.draft, stage: { ...stage, territoryId } } };
}

/** N6: a click on a sub-territory while a raid chooses its target plans it there; any other click leaves the choice as it was. */
export function chooseTargetSite(scenario: Scenario, session: PlanningSession, subTerritoryId: SubTerritoryId): PlanningSession {
  const { selectedAircraftId: unitId } = session.draft;
  const target = stageTargets(scenario, session).find(({ mission }) => mission.kind === "raid" && mission.subTerritoryId === subTerritoryId);
  return target === undefined || unitId === undefined ? session : setAirMission(scenario, session, unitId, target.mission);
}

function withAirOrders(session: PlanningSession, airOrders: readonly AirDraftOrder[], feedback?: string): PlanningSession {
  return { ...session, draft: { ...session.draft, airOrders, ...(feedback === undefined ? {} : { feedback }) } };
}

/** U2: plans (or with no mission, stands down) an aircraft's one mission this turn. */
export function setAirMission(scenario: Scenario, session: PlanningSession, unitId: UnitId, mission: AirMission | undefined): PlanningSession {
  const others = (session.draft.airOrders ?? []).filter((order) => order.unitId !== unitId);
  if (mission === undefined) return withAirOrders(leaveTargets(session), others);
  const order: AirMissionOrder = { factionId: session.factionId, kind: "air-mission", mission, unitId };
  const validation = validateAirMission(scenario, session.game.state, order);
  if (!validation.ok) return { ...session, draft: { ...session.draft, feedback: validation.reason } };
  const open = leaveTargets(session);
  return withAirOrders({ ...open, draft: { ...open.draft, ...unitOrdersWithout(session.draft, [unitId]) } }, [...others, order]);
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
    if (type?.air?.missions.includes("patrol") === true && isAirbaseFor(scenario, state, other.territoryId, other.factionId)
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
