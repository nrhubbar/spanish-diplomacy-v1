import type { Scenario, SubTerritoryId } from "../../engine/types";
import type { PlanningSession } from "./selection";

/**
 * X3: zooming in and clicking a sub-territory focuses the pane on it, inside its territory;
 * "back" returns to the territory. Selecting anything else drops the focus. The pane's focus
 * view is `screens/pane/SubTerritoryFocus.tsx`; TODO(m3r1-sub-territories): the map layer's
 * click dispatches `focusSubTerritory`.
 */
export function focusOn(scenario: Scenario, session: PlanningSession, subTerritoryId: SubTerritoryId): PlanningSession {
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  if (sub === undefined) return session;
  const draft = session.draft.selectedTerritoryId === sub.territoryId
    ? { ...session.draft, focusedSubTerritoryId: subTerritoryId }
    : { orders: session.draft.orders, focusedSubTerritoryId: subTerritoryId, selectedTerritoryId: sub.territoryId, selectedUnitIds: [] };
  return { ...session, draft };
}

export function unfocus(session: PlanningSession): PlanningSession {
  const { feedback, orders, selectedTerritoryId, selectedUnitIds, stage } = session.draft;
  return {
    ...session,
    draft: {
      orders,
      selectedUnitIds,
      ...(feedback === undefined ? {} : { feedback }),
      ...(selectedTerritoryId === undefined ? {} : { selectedTerritoryId }),
      ...(stage === undefined ? {} : { stage })
    }
  };
}
