import type { FactionId, AirMission, AirMissionOrder, GameState, SackOrder, Scenario, TerritoryId, ValidationResult } from "../types";
import { isContested } from "../partition/holders";
import { generalOf, heldWholeByAnother, isAirbaseFor, territoriesWithin, unitTypeIn } from "./pieces";

/** U2-U4: the territory a mission flies to. */
export function missionTerritory(scenario: Scenario, mission: AirMission): TerritoryId | undefined {
  return mission.kind === "raid" ? scenario.index.subTerritories.get(mission.subTerritoryId)?.territoryId : mission.territoryId;
}

/**
 * U2-U4: an aircraft of the faction, at an airbase its faction holds, flies one mission its type
 * allows to a territory within its range. A raid targets a sub-territory another faction holds;
 * recon looks at a territory another faction holds some of. Weather is checked when it flies.
 */
export function validateAirMission(scenario: Scenario, state: GameState, order: AirMissionOrder): ValidationResult {
  if (scenario.air === undefined || scenario.rules.air === "none") return { ok: false, refusal: { code: "order-unavailable" } };
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, refusal: { code: "unknown-unit" } };
  if (unit.factionId !== order.factionId) return { ok: false, refusal: { code: "unit-of-another-faction" } };
  const type = unitTypeIn(scenario, state.raised, unit.id);
  if (type?.air === undefined || !type.orders.includes("air-mission")) return { ok: false, refusal: { code: "mission-needs-aircraft" } };
  if (!type.air.missions.includes(order.mission.kind)) return { ok: false, refusal: { code: "mission-not-flown", unitTypeId: type.id } };
  if (!isAirbaseFor(scenario, state, unit.territoryId, unit.factionId)) return { ok: false, refusal: { code: "no-airfield" } };
  const target = missionTerritory(scenario, order.mission);
  if (target === undefined) return { ok: false, refusal: { code: "unknown-target" } };
  if (!territoriesWithin(scenario, unit.territoryId, type.air.range).has(target)) return { ok: false, refusal: { code: "target-out-of-range" } };
  if (order.mission.kind === "raid" && state.subTerritories[order.mission.subTerritoryId]?.holder === unit.factionId) {
    return { ok: false, refusal: { code: "raid-own-ground" } };
  }
  if (order.mission.kind === "recon" && !othersHoldIn(scenario, state, target, unit.factionId)) {
    return { ok: false, refusal: { code: "recon-own-ground" } };
  }
  return { ok: true };
}

function othersHoldIn(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionId: FactionId): boolean {
  // W6: contested, or held whole by another faction (the partition's holders).
  return isContested(scenario, state, territoryId) || heldWholeByAnother(scenario, state, territoryId, factionId);
}

/** U5: Sack is a free order for one of the faction's own generals. */
export function validateSack(scenario: Scenario, state: GameState, order: SackOrder): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, refusal: { code: "unknown-unit" } };
  if (unit.factionId !== order.factionId) return { ok: false, refusal: { code: "unit-of-another-faction" } };
  const type = unitTypeIn(scenario, state.raised, unit.id);
  if (type === undefined || !type.orders.includes("sack") || generalOf(scenario, state.raised, unit.id) === undefined) {
    return { ok: false, refusal: { code: "sack-needs-general" } };
  }
  return { ok: true };
}
