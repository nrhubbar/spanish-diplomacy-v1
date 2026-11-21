import { territoriesWithin, unitKindIn, unitTypeIn } from "../../engine/air/pieces";
import type { FactionId, GameState, Scenario, TerritoryId, UnitTypeDefinition } from "../../engine/types";

/** Design note for the harness to tune (H7): one aircraft wanted per this many own ground units. */
const groundPerAircraft = 6;

/** The faction's aircraft, by the missions they fly. */
function airCounts(scenario: Scenario, state: GameState, factionId: FactionId): { readonly aircraft: number; readonly ground: number; readonly missions: ReadonlyMap<string, number> } {
  let aircraft = 0;
  let ground = 0;
  const missions = new Map<string, number>();
  for (const unit of Object.values(state.units)) {
    if (unit.factionId !== factionId) continue;
    const kind = unitKindIn(scenario, state.raised, unit.id);
    if (kind === "ground") ground += 1;
    if (kind !== "air") continue;
    aircraft += 1;
    for (const mission of unitTypeIn(scenario, state.raised, unit.id)?.air?.missions ?? []) missions.set(mission, (missions.get(mission) ?? 0) + 1);
  }
  for (const item of state.training) {
    if (item.factionId !== factionId) continue;
    const type = scenario.index.unitTypes.get(item.typeId);
    if (type?.air === undefined) continue;
    aircraft += 1;
    for (const mission of type.air.missions) missions.set(mission, (missions.get(mission) ?? 0) + 1);
  }
  return { aircraft, ground, missions };
}

/** Whether an enemy bomber can reach the territory. */
function underAirThreat(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): boolean {
  return Object.values(state.units).some((unit) => {
    if (unit.factionId === factionId) return false;
    const air = unitTypeIn(scenario, state.raised, unit.id)?.air;
    return air?.missions.includes("raid") === true && territoriesWithin(scenario, unit.territoryId, air.range).has(territoryId);
  });
}

/**
 * H5, U1-U3 (m3r1-air-generals): what the Recruit planner should buy at a site before its ground
 * choice, if anything. Anti-air (a `raid-defence` type) where enemy bombers reach and none of the
 * faction's stands; else an aircraft when the faction has fewer than one per `groundPerAircraft`
 * ground units, of the mission it has least (raid, then intercept, then recon, ties by type id).
 * `open` holds the types this site can train now (unlocked); the caller checks the price.
 */
export function airRecruitChoices(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  territoryId: TerritoryId,
  open: readonly UnitTypeDefinition[]
): readonly UnitTypeDefinition[] {
  const choices: UnitTypeDefinition[] = [];
  const antiAir = open.find((type) => type.kind === "ground" && type.effects.some((effect) => effect.kind === "raid-defence"));
  const defended = Object.values(state.units).some((unit) => unit.factionId === factionId && unit.territoryId === territoryId
    && (unitTypeIn(scenario, state.raised, unit.id)?.effects.some((effect) => effect.kind === "raid-defence") ?? false));
  if (antiAir !== undefined && !defended && underAirThreat(scenario, state, factionId, territoryId)) choices.push(antiAir);
  const counts = airCounts(scenario, state, factionId);
  if (counts.aircraft * groundPerAircraft < counts.ground) {
    const order = ["raid", "patrol", "recon"];
    const air = open
      .filter((type) => type.air !== undefined)
      .map((type) => ({ need: Math.min(...(type.air?.missions ?? []).map((mission) => counts.missions.get(mission) ?? 0)), rank: Math.min(...(type.air?.missions ?? []).map((mission) => order.indexOf(mission))), type }))
      .sort((a, b) => a.need - b.need || a.rank - b.rank || (a.type.id < b.type.id ? -1 : 1))[0];
    if (air !== undefined) choices.push(air.type);
  }
  return choices;
}
