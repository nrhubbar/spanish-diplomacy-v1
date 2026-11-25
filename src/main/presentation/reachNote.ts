import { type MoveMode, type Reach, reachFor } from "../engine/network/reach";
import { type FactionId, type GameState, isMoveOrder, type Scenario, type TerritoryId, type UnitId, type UnitOrder } from "../engine/types";
import { type Feedback, feedbackText } from "./feedback";
import { refusalText, refusedMode } from "./refusals";
import { territoryName } from "./text";

/**
 * U7: why a territory is out of reach of the units being ordered, as the hover card (desktop)
 * and the tap modal (phone) show it: one line per reason `reachFor` gives, each led by its move
 * mode when the sentence names one.
 */
export interface ReachNote {
  readonly lines: readonly { readonly mode?: MoveMode; readonly text: string }[];
  readonly status: string;
  readonly title: string;
}

/** N6: why a territory is no target of the mission being chosen, as a note like Move's. */
export function targetNote(scenario: Scenario, territoryId: TerritoryId, refusal: { readonly inRange: boolean; readonly reason: Feedback } | undefined): ReachNote | undefined {
  if (refusal === undefined) return undefined;
  return { lines: [{ text: feedbackText(scenario, refusal.reason) }], status: refusal.inRange ? "Not a target for this mission" : "Out of reach this turn", title: territoryName(scenario, territoryId) };
}

/** The note for `territoryId`, or undefined when the units can reach it (or it is their own). */
export function reachNote(scenario: Scenario, territoryId: TerritoryId, reach: Reach | undefined): ReachNote | undefined {
  if (reach === undefined || reach.ok) return undefined;
  return {
    lines: reach.reasons.map(({ refusal }) => {
      const mode = refusedMode(refusal);
      return { ...(mode === undefined ? {} : { mode }), text: refusalText(scenario, refusal) };
    }),
    status: "Out of reach this turn",
    title: territoryName(scenario, territoryId)
  };
}

/** Where the selected units can move, given the moves already planned. */
export function selectionReach(scenario: Scenario, state: GameState, factionId: FactionId, unitIds: readonly UnitId[], orders: readonly UnitOrder[]): ReadonlyMap<TerritoryId, Reach> {
  return reachFor(scenario, state, factionId, unitIds, orders.filter(isMoveOrder));
}
