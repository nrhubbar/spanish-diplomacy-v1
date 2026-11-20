import { unitDefinitionIn } from "../air/pieces";
import type { FactionId, GameState, GeneralDefinition, GeneralId, ReplacementDueOutcome, Scenario, UnitState } from "../types";

/** U5: the generals a faction has in play (on the board or set aside this turn), by roster id. */
export function fieldedGenerals(scenario: Scenario, raised: GameState["raised"], units: readonly UnitState[]): ReadonlySet<GeneralId> {
  const fielded = new Set<GeneralId>();
  for (const unit of units) {
    const generalId = unitDefinitionIn(scenario, raised, unit.id)?.generalId;
    if (generalId !== undefined) fielded.add(generalId);
  }
  return fielded;
}

/**
 * U5, D7 (AG-7): the next commander on a faction's roster: the first entry at or after the
 * roster index who is not in play, not already on his way, and not the man leaving.
 */
export function nextOnRoster(
  scenario: Scenario,
  generals: GameState["generals"],
  factionId: FactionId,
  unavailable: ReadonlySet<GeneralId>
): { readonly general: GeneralDefinition; readonly index: number } | undefined {
  const roster = scenario.index.generalsByFaction.get(factionId) ?? [];
  const state = generals[factionId] ?? { nextIndex: 0, pending: [] };
  const pending = new Set(state.pending.map((entry) => entry.generalId));
  for (let index = state.nextIndex; index < roster.length; index += 1) {
    const general = roster[index];
    if (general !== undefined && !unavailable.has(general.id) && !pending.has(general.id)) return { general, index };
  }
  return undefined;
}

/**
 * D7: after a death or a sacking, the next general on the roster is called; he appears at the
 * end of the next turn in the faction's seat territory. Returns the updated generals state and
 * the outcome, or nothing when the roster is exhausted.
 */
export function callReplacement(
  scenario: Scenario,
  generals: GameState["generals"],
  factionId: FactionId,
  unavailable: ReadonlySet<GeneralId>,
  turnNumber: number
): { readonly generals: GameState["generals"]; readonly outcome?: ReplacementDueOutcome } {
  const next = nextOnRoster(scenario, generals, factionId, unavailable);
  if (next === undefined) return { generals };
  const current = generals[factionId] ?? { nextIndex: 0, pending: [] };
  const arrivesOnTurn = turnNumber + 1;
  return {
    generals: {
      ...generals,
      [factionId]: { nextIndex: next.index + 1, pending: [...current.pending, { arrivesOnTurn, factionId, generalId: next.general.id }] }
    },
    outcome: { arrivesOnTurn, factionId, generalId: next.general.id, kind: "replacement-due" }
  };
}
