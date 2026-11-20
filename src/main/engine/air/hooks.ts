import { generalModifiers } from "../generals/command";
import type { CombatHookContext, IncomeContext, RuleHooks } from "../hooks";
import type { CombatModifier, CombatRole, FactionId, Resources, UnitId } from "../types";
import { unitTypeIn } from "./pieces";

/**
 * D7: bombers flying support over the battle's territory add their `battle-support` roll for
 * their side. Only the best one counts per side (AG-6). Support is known only while the turn
 * resolves (the air scratch), so planning estimates leave it out.
 */
export function supportModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const support = context.scratch?.air?.support ?? [];
  const { scenario, state } = context;
  const side = (factionIds: readonly FactionId[], role: CombatRole): readonly CombatModifier[] => {
    const flying = support.filter((order) => order.mission.kind === "support" && order.mission.territoryId === context.territoryId && factionIds.includes(order.factionId));
    let best = 0;
    const unitIds: UnitId[] = [];
    for (const order of flying) {
      for (const effect of unitTypeIn(scenario, state.raised, order.unitId)?.effects ?? []) {
        if (effect.kind === "battle-support") best = Math.max(best, effect.roll);
      }
      unitIds.push(order.unitId);
    }
    const factionId = flying[0]?.factionId;
    if (best === 0 || factionId === undefined) return [];
    return [{ factionId, kind: "air-support", role, roll: role === "attack" ? best : -best, unitIds }];
  };
  return [...side([context.attackerFactionId], "attack"), ...side(context.defenderFactionIds, "defence")];
}

/**
 * U3 (AG-5): a raid's income cut. The cut names the turn whose income it removes (the turn after
 * the raid), so it reads the same whether the economy passes the start-of-turn or the current
 * state. It removes the cut sub-territory's development yield from its holder, when the holder
 * holds the whole territory (only whole territories pay, $2).
 */
export function raidIncomeDelta(context: IncomeContext): Resources {
  const { factionId, scenario, state } = context;
  const delta: Record<string, number> = {};
  for (const cut of state.raidCuts) {
    if (cut.turnNumber !== state.turnNumber) continue;
    const sub = state.subTerritories[cut.subTerritoryId];
    const definition = scenario.index.subTerritories.get(cut.subTerritoryId);
    if (sub === undefined || definition === undefined || sub.holder !== factionId) continue;
    const whole = (scenario.index.subTerritoriesByTerritory.get(definition.territoryId) ?? []).every((other) => state.subTerritories[other.id]?.holder === factionId);
    if (!whole) continue;
    for (const [developmentId, level] of Object.entries(sub.development)) {
      const track = scenario.development.find((candidate) => candidate.id === developmentId);
      if (track === undefined || level <= 0) continue;
      delta[track.resource] = (delta[track.resource] ?? 0) - level * track.yieldPerLevel;
    }
  }
  return delta;
}

export const airHooks: RuleHooks = {
  combatModifiers: (context) => [...generalModifiers(context), ...supportModifiers(context)],
  incomeDelta: raidIncomeDelta
};
