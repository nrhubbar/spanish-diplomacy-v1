import { isGroundUnit } from "../air/pieces";
import { isUnitOrder, type TimeRanOutOutcome } from "../types";
import { isPublicOrder } from "../visibility";
import type { Phase } from "./draft";

/**
 * Step 0 (T2, T3, T5): before planning. The weather is rolled before anyone plans
 * (`engine/weather.ts`, `beforePlanning`) and the weather module's part records it here. The
 * engine's own part reports each player whose time ran out (T6): the submission says so, and the
 * units without an order took their defaults. The line is public, so the count reads only
 * public orders ($6: a unit on a hidden Replenish counts as held) and only ground units, since
 * aircraft and generals have no default to take. The engine never reads a clock.
 */
export const weatherStep: Phase = (draft) => {
  const { scenario, start, submissions } = draft.input;
  const ranOut: TimeRanOutOutcome[] = submissions.filter((submission) => submission.timedOut === true).map((submission) => {
    const ordered = new Set(submission.orders.filter(isPublicOrder).filter(isUnitOrder).map((order) => order.unitId));
    const heldUnitCount = Object.values(start.units).filter((unit) =>
      unit.factionId === submission.factionId && !ordered.has(unit.id) && isGroundUnit(scenario, start.raised, unit.id)).length;
    return { factionId: submission.factionId, heldUnitCount, kind: "time-ran-out" };
  });
  return ranOut.length === 0 ? draft : { ...draft, events: [...draft.events, ...ranOut] };
};
