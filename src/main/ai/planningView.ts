import { unitKindIn } from "../engine/air/pieces";
import type { FactionId, GameState, Scenario, UnitId } from "../engine/types";

const views = new WeakMap<GameState, Map<FactionId, GameState>>();

/**
 * AG-3, M1: the board the ground planners read: no aircraft (D17), and none of the faction's own
 * generals, who follow its armies (`orders/general.ts`); enemy generals stay, so estimates count
 * their bonus and a territory held by a general alone is defended ground, as the battles treat it.
 * Remembered per state, so what planners remember about the view (`unitRoutes`) is shared.
 */
export function movePlanningView(scenario: Scenario, state: GameState, factionId: FactionId): GameState {
  const memo = views.get(state) ?? new Map<FactionId, GameState>();
  views.set(state, memo);
  const known = memo.get(factionId);
  if (known !== undefined) return known;
  const units = Object.fromEntries(Object.entries(state.units).filter(([id, unit]) => {
    const kind = unitKindIn(scenario, state.raised, id as UnitId);
    return kind === "ground" || (kind === "general" && unit.factionId !== factionId);
  }));
  const view = Object.keys(units).length === Object.keys(state.units).length ? state : { ...state, units };
  memo.set(factionId, view);
  return view;
}
