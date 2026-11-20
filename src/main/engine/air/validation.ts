import type { FactionId, AirMission, AirMissionOrder, GameState, SackOrder, Scenario, TerritoryId, ValidationResult } from "../types";
import { generalOf, isAirbaseFor, territoriesWithin, unitTypeIn } from "./pieces";

/** M9: shown when the scenario's air module is off. */
const noAirReason = "This order is not available in this scenario.";

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
  if (scenario.air === undefined || scenario.rules.air === "none") return { ok: false, reason: noAirReason };
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, reason: "Unknown unit." };
  if (unit.factionId !== order.factionId) return { ok: false, reason: "Selected unit belongs to another player." };
  const type = unitTypeIn(scenario, state.raised, unit.id);
  if (type?.air === undefined || !type.orders.includes("air-mission")) return { ok: false, reason: "Only aircraft fly missions." };
  if (!type.air.missions.includes(order.mission.kind)) return { ok: false, reason: `A ${type.name} cannot fly that mission.` };
  if (!isAirbaseFor(scenario, state, unit.territoryId, unit.factionId)) return { ok: false, reason: "The aircraft has no airfield to fly from." };
  const target = missionTerritory(scenario, order.mission);
  if (target === undefined) return { ok: false, reason: "Unknown target." };
  if (!territoriesWithin(scenario, unit.territoryId, type.air.range).has(target)) return { ok: false, reason: "The target is out of range." };
  if (order.mission.kind === "raid" && state.subTerritories[order.mission.subTerritoryId]?.holder === unit.factionId) {
    return { ok: false, reason: "Raids target ground another faction holds." };
  }
  if (order.mission.kind === "recon" && !othersHoldIn(scenario, state, target, unit.factionId)) {
    return { ok: false, reason: "Recon looks at ground another faction holds." };
  }
  return { ok: true };
}

function othersHoldIn(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionId: FactionId): boolean {
  const control = state.control[territoryId];
  if (control?.kind === "contested") return true;
  if (control?.kind === "controlled" && control.factionId !== factionId) return true;
  return (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).some((sub) => {
    const holder = state.subTerritories[sub.id]?.holder;
    return holder !== undefined && holder !== factionId;
  });
}

/** U5: Sack is a free order for one of the faction's own generals. */
export function validateSack(scenario: Scenario, state: GameState, order: SackOrder): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, reason: "Unknown unit." };
  if (unit.factionId !== order.factionId) return { ok: false, reason: "Selected unit belongs to another player." };
  const type = unitTypeIn(scenario, state.raised, unit.id);
  if (type === undefined || !type.orders.includes("sack") || generalOf(scenario, state.raised, unit.id) === undefined) {
    return { ok: false, reason: "Only a general can be sacked." };
  }
  return { ok: true };
}
