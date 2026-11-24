import type { RollStreams } from "../dice";
import type { TurnDraft } from "../phases/draft";
import type { AirMissionOrder, Order, UnitId, UnitState } from "../types";

/**
 * The air area's turn-only data (`TurnDraft.scratch.air`), passed between its own parts and to
 * the `combatModifiers` hook. Generals ride here too: they have no area of their own (CT-4).
 */
export interface AirScratch {
  /**
   * AG-3: aircraft held out of the ground steps (3 to 8), as they stood after reveal. They come
   * back at step 9.
   */
  readonly aside: Readonly<Record<UnitId, UnitState>>;
  /** R10: fighters that flew Patrol, set at step 2; they join the air battles over their territory (R11). */
  readonly patrols: readonly AirMissionOrder[];
  /** R11: the turn's roll streams, set at step 2, so a battle's air battle rolls on the `air-battle` stream of its index. */
  readonly streams?: RollStreams;
  /** R10: aircraft that flew Ground Support, set at step 2 and read by the battle hooks at step 5. */
  readonly support: readonly AirMissionOrder[];
}

export const emptyAirScratch: AirScratch = { aside: {}, patrols: [], support: [] };

/** The turn's air scratch, empty before step 1's part. */
export function airScratch(draft: TurnDraft): AirScratch {
  return draft.scratch.air ?? emptyAirScratch;
}

/** Orders of one kind that passed step 1's validation (failed ones are in `orders.rejected`). */
export function validOrdersOf<Kind extends Order["kind"]>(draft: TurnDraft, kind: Kind): readonly Extract<Order, { kind: Kind }>[] {
  const rejected = new Set<Order>(draft.orders.rejected.map((outcome) => outcome.order));
  return draft.input.submissions
    .flatMap((submission) => submission.orders)
    .filter((order): order is Extract<Order, { kind: Kind }> => order.kind === kind && !rejected.has(order));
}

