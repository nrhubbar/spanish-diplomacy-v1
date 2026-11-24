import { holdsWhole } from "../partition/holders";
import { toThousandth } from "../resources";
import type { CombatHookContext, IncomeContext, RuleHooks } from "../hooks";
import type { CombatModifier, Resources } from "../types";
import { airOverHookedBattle, supportModifiersOf } from "./groundSupport";

/**
 * R10, R11: Ground Support over the battle's territory, after the air battle when one is fought
 * (`groundSupport.ts`): only the side that wins it gets any. The report reads the same air from
 * the battle (`FoughtBattle.air`).
 * The flights are known only while the turn resolves (the air scratch); planning estimates add
 * planned Ground Support themselves (`combat/estimate.ts`).
 */
function supportModifiers(context: CombatHookContext): readonly CombatModifier[] {
  const scratch = context.scratch?.air;
  return scratch === undefined ? [] : supportModifiersOf(airOverHookedBattle(context, scratch));
}

/**
 * U3 (AG-5): a raid's income cut. The cut names the turn whose income it removes (the turn after
 * the raid), so it reads the same whether the economy passes the start-of-turn or the current
 * state. It removes the cut sub-territory's development yield from the faction raided, only while
 * that faction still holds it and the whole territory (only whole territories pay, $2).
 */
export function raidIncomeDelta(context: IncomeContext): Resources {
  const { factionId, scenario, state } = context;
  const delta: Record<string, number> = {};
  for (const cut of state.raidCuts) {
    if (cut.turnNumber !== state.turnNumber || cut.factionId !== factionId) continue;
    const sub = state.subTerritories[cut.subTerritoryId];
    const definition = scenario.index.subTerritories.get(cut.subTerritoryId);
    if (sub === undefined || definition === undefined || sub.holder !== factionId) continue;
    if (!holdsWhole(scenario, state, definition.territoryId, factionId)) continue;
    for (const [developmentId, level] of Object.entries(sub.development)) {
      const track = scenario.development.find((candidate) => candidate.id === developmentId);
      if (track === undefined || level <= 0) continue;
      delta[track.resource] = toThousandth((delta[track.resource] ?? 0) - level * track.yieldPerLevel);
    }
  }
  return delta;
}

export const airHooks: RuleHooks = {
  combatModifiers: supportModifiers,
  incomeDelta: raidIncomeDelta
};
