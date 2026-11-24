import { generalOf, unitKindIn } from "../../engine/air/pieces";
import { compareIds } from "../../engine/board";
import { fieldedGenerals, nextOnRoster } from "../../engine/generals/roster";
import type { GeneralDefinition, SackOrder, Scenario } from "../../engine/types";
import type { OrderPlanner } from "./planner";

/** U5: how good a general's trait is: the sum of its roll changes, and -1 for a general who cannot rally. */
function traitScore(scenario: Scenario, general: GeneralDefinition): number {
  const trait = scenario.generalTraits.find((candidate) => candidate.id === general.traitId);
  return (trait?.effects ?? []).reduce((sum, effect) => sum + (effect.kind === "roll-modifier" ? effect.roll : -1), 0);
}

/**
 * H5: the computer player sacks a general whose trait hurts (Q-GEN-2's nudge) when the next man
 * on the roster is better and no replacement is already on his way. At most one a turn, the
 * worst first; ties by unit id.
 */
export const planSackings: OrderPlanner<SackOrder> = ({ factionId, planned, scenario, state }) => {
  if (scenario.generals.length === 0) return [];
  if ((state.generals[factionId]?.pending.length ?? 0) > 0) return [];
  const ordered = new Set(planned.flatMap((order) => ("unitId" in order ? [order.unitId] : [])));
  const own = Object.values(state.units).filter((unit) => unit.factionId === factionId && !ordered.has(unit.id) && unitKindIn(scenario, state.raised, unit.id) === "general");
  const next = nextOnRoster(scenario, state.generals, factionId, fieldedGenerals(scenario, state.raised, Object.values(state.units)));
  if (next === undefined) return [];
  const candidates = own
    .flatMap((unit) => {
      const general = generalOf(scenario, state.raised, unit.id);
      return general === undefined ? [] : [{ score: traitScore(scenario, general), unit }];
    })
    .filter((entry) => entry.score < 0 && entry.score < traitScore(scenario, next.general))
    .sort((a, b) => a.score - b.score || compareIds(a.unit.id, b.unit.id));
  const worst = candidates[0];
  return worst === undefined ? [] : [{ factionId, kind: "sack", unitId: worst.unit.id }];
};
