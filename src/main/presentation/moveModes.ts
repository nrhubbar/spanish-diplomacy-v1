import { connectionBetween, landNeighbors } from "../engine/movement/network";
import { boardingRefusal, type MoveRoute } from "../engine/movement/routes";
import type { MoveMode } from "../engine/network/reach";
import type { FactionId, GameState, MoveLeg, MoveOrder, Scenario, TerritoryId, UnitId } from "../engine/types";
import { validateMoveOrder } from "../engine/validation";

/**
 * U6: the move modes a unit could take to one target, for the Invade and Reinforce cards: the
 * route the game offers (`moveRoutes`) first, then each other mode tried through the engine's
 * own order check (`validateMoveOrder`), so a chip is never offered that the reveal refuses.
 */

/** The land modes a card shows, in order. Sea joins them when the route offered sails. */
type LandMode = Exclude<MoveMode, "sea">;
const cardModes: readonly LandMode[] = ["march", "motor", "rail"];

export const modeNames: Readonly<Record<MoveMode, string>> = { march: "March", motor: "Motor", rail: "Rail", sea: "Sea" };

/** One mode on a card: the legs its order carries (none for a plain step), or why it can't be used. */
export type ModeChip =
  | { readonly legs?: readonly MoveLeg[]; readonly mode: MoveMode; readonly ok: true }
  | { readonly mode: MoveMode; readonly ok: false; readonly reason: string };

/** The legs an order carries for a route: none for a plain step (CT-6), as Move planning does. */
export function orderLegs(route: Pick<MoveRoute, "legs" | "shape">): readonly MoveLeg[] | undefined {
  return route.shape === "step" ? undefined : route.legs;
}

/** The leg lists that would take a mode from `from` to `to`, most direct first. */
function candidates(scenario: Scenario, mode: LandMode, from: TerritoryId, to: TerritoryId): readonly (readonly MoveLeg[])[] {
  const land = (at: TerritoryId): MoveLeg => ({ kind: "land", to: at });
  switch (mode) {
    case "march":
      return connectionBetween(scenario, from, to, "land") === undefined ? [] : [[land(to)]];
    case "motor":
      return landNeighbors(scenario, from).filter((via) => via !== to && connectionBetween(scenario, via, to, "land") !== undefined).map((via) => [land(via), land(to)]);
    case "rail":
      return [
        [{ kind: "rail", to }],
        ...landNeighbors(scenario, from).filter((via) => via !== to).map((via) => [land(via), { kind: "rail" as const, to }]),
        ...landNeighbors(scenario, to).filter((end) => end !== from).map((end) => [{ kind: "rail" as const, to: end }, land(to)])
      ];
  }
}

/** Why a mode has no route at all to the target (no candidate legs; Rail always tries the direct ride). */
function noRouteReason(scenario: Scenario, mode: LandMode): string {
  const reasons: Readonly<Record<LandMode, string>> = {
    march: "March reaches only a neighbouring territory.",
    motor: `Motor reaches at most ${String(scenario.linkModifiers.road?.motorRange ?? 2)} territories.`,
    rail: "No rail line your side holds reaches it this turn."
  };
  return reasons[mode];
}

/**
 * U6: every mode on a unit's card for one target. `offered` is the route the game offers it
 * (`moveRoutes`); it is always available. Each other land mode is available when one of its leg
 * lists passes the engine's order check and has a train place for the unit beside `others`, the
 * side's other planned moves (D5); otherwise it carries the first refusal.
 */
export function modeChips(scenario: Scenario, state: GameState, factionId: FactionId, unitId: UnitId, offered: MoveRoute, others: readonly MoveOrder[] = []): readonly ModeChip[] {
  const { from, to } = offered;
  const legs = orderLegs(offered);
  const chosen = (mode: MoveMode): ModeChip => ({ ...(legs === undefined ? {} : { legs }), mode, ok: true });
  const other = (mode: LandMode): ModeChip => {
    let reason: string | undefined;
    for (const each of candidates(scenario, mode, from, to)) {
      // A plain step carries no legs (CT-6).
      const carried = mode === "march" ? {} : { legs: each };
      const order: MoveOrder = { factionId, from, kind: "move", ...carried, to, unitId };
      const verdict = validateMoveOrder(scenario, state, order);
      const refused = verdict.ok ? boardingRefusal(scenario, state, [order], others) : verdict.reason;
      if (refused === undefined) return { ...carried, mode, ok: true };
      reason ??= refused;
    }
    return { mode, ok: false, reason: reason ?? noRouteReason(scenario, mode) };
  };
  const land = cardModes.map((mode) => (mode === offered.mode ? chosen(mode) : other(mode)));
  return offered.mode === "sea" ? [...land, chosen("sea")] : land;
}
