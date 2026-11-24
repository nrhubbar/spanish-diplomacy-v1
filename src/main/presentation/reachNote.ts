import type { MoveMode, Reach } from "../engine/network/reach";
import type { Scenario, TerritoryId } from "../engine/types";
import { modeNames } from "./moveModes";
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

const modes = Object.entries(modeNames) as readonly (readonly [MoveMode, string])[];

/** N6: why a territory is no target of the mission being chosen, as a note like Move's. */
export function targetNote(scenario: Scenario, territoryId: TerritoryId, refusal: { readonly inRange: boolean; readonly reason: string } | undefined): ReachNote | undefined {
  if (refusal === undefined) return undefined;
  return { lines: [{ text: refusal.reason }], status: refusal.inRange ? "Not a target for this mission" : "Out of reach this turn", title: territoryName(scenario, territoryId) };
}

/** The note for `territoryId`, or undefined when the units can reach it (or it is their own). */
export function reachNote(scenario: Scenario, territoryId: TerritoryId, reach: Reach | undefined): ReachNote | undefined {
  if (reach === undefined || reach.ok) return undefined;
  return {
    lines: reach.reasons.map((reason) => {
      const mode = modes.find(([, name]) => reason.text.startsWith(`${name} `))?.[0];
      return { ...(mode === undefined ? {} : { mode }), text: reason.text };
    }),
    status: "Out of reach this turn",
    title: territoryName(scenario, territoryId)
  };
}
