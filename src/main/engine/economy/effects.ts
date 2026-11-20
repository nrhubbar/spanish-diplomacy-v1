import type { CombatHookContext, ReplenishBonus, ReplenishContext } from "../hooks";
import type { BuildingDefinition, BuildingEffect, CombatModifier, FactionId, GameState, ResourceId, Scenario, SubTerritoryId, TerritoryId } from "../types";

/**
 * $4: what buildings do in other areas' rules, answered through the cross-area hooks
 * (`engine/hooks.ts`). Code reads building effects, never building ids (CT-5).
 */

/** The distinct buildings standing in a territory's sub-territories held by any of `factionIds`. */
function buildingsHeld(scenario: Scenario, state: GameState, territoryId: TerritoryId, factionIds: readonly FactionId[]): readonly { readonly building: BuildingDefinition; readonly subTerritoryId: SubTerritoryId }[] {
  const seen = new Set<string>();
  const found: { building: BuildingDefinition; subTerritoryId: SubTerritoryId }[] = [];
  for (const sub of scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []) {
    const site = state.subTerritories[sub.id];
    if (site === undefined || !factionIds.includes(site.holder)) continue;
    for (const id of site.buildings) {
      const building = scenario.index.buildings.get(id);
      if (building === undefined || seen.has(id)) continue;
      seen.add(id);
      found.push({ building, subTerritoryId: sub.id });
    }
  }
  return found;
}

const effectsOf = <Kind extends BuildingEffect["kind"]>(building: BuildingDefinition, kind: Kind): readonly Extract<BuildingEffect, { readonly kind: Kind }>[] =>
  building.effects.filter((effect): effect is Extract<BuildingEffect, { readonly kind: Kind }> => effect.kind === kind);

/**
 * $4: a `defence-roll` building (Fortifications) in a sub-territory a defender holds in the
 * battle territory takes its roll off the attacker's die. Only the strongest one counts, once
 * per battle.
 */
export function buildingCombatModifiers(context: CombatHookContext): readonly CombatModifier[] {
  let best: Extract<CombatModifier, { readonly kind: "building" }> | undefined;
  for (const { building, subTerritoryId } of buildingsHeld(context.scenario, context.state, context.territoryId, context.defenderFactionIds)) {
    for (const effect of effectsOf(building, "defence-roll")) {
      if (best === undefined || effect.roll > -best.roll) best = { buildingId: building.id, kind: "building", roll: -effect.roll, subTerritoryId };
    }
  }
  return best === undefined ? [] : [best];
}

/**
 * R5, D28.1: `replenish-cap` (Hospital: more men a turn) and `replenish-discount` (Depot: a
 * lower price) buildings in the unit's territory, in sub-territories its faction holds, each
 * building counted once.
 */
export function buildingReplenishBonus(context: ReplenishContext): ReplenishBonus {
  const unit = context.state.units[context.unitId];
  if (unit === undefined) return { capShare: 0, discount: {} };
  let capShare = 0;
  const discount: Partial<Record<ResourceId, number>> = {};
  for (const { building } of buildingsHeld(context.scenario, context.state, context.territoryId, [unit.factionId])) {
    for (const effect of effectsOf(building, "replenish-cap")) capShare += effect.share;
    for (const effect of effectsOf(building, "replenish-discount")) discount[effect.resource] = (discount[effect.resource] ?? 0) + effect.share;
  }
  return { capShare, discount };
}
