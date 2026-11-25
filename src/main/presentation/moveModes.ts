import { connectionBetween, landNeighbors } from "../engine/movement/network";
import { boardingRefusal, type MoveRoute } from "../engine/movement/routes";
import type { MoveMode } from "../engine/network/reach";
import type { FactionId, GameState, MoveLeg, MovementRefusal, MoveOrder, Refusal, Scenario, TerritoryId, UnitId } from "../engine/types";
import { validateMoveOrder } from "../engine/validation";
import { refusalText } from "./refusals";

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
  | {
      /** The way is there, but the units ticked or ordered leave it no room (trains, trucks, ports) or no army to go with. */
      readonly full?: boolean;
      readonly mode: MoveMode;
      readonly ok: false;
      readonly reason: string;
    };

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
function noRoute(scenario: Scenario, mode: LandMode): MovementRefusal {
  const range = scenario.linkModifiers.road?.motorRange;
  const refusals: Readonly<Record<LandMode, MovementRefusal>> = {
    march: { code: "march-neighbours-only" },
    motor: range === undefined ? { code: "out-of-reach" } : { code: "motor-too-far", territories: range },
    rail: { code: "no-rail-line" }
  };
  return refusals[mode];
}

/** One mode of travel to a target: every leg list the engine's own order check takes (none for a plain step), or why there is none. */
export interface ModeOption {
  readonly mode: MoveMode;
  readonly reason: string;
  readonly ways: readonly (readonly MoveLeg[] | undefined)[];
}

function wayKey(legs: readonly MoveLeg[] | undefined): string {
  return (legs ?? []).map((leg) => `${leg.kind}:${leg.to}`).join(">");
}

/**
 * Every mode a unit could take from `from` to `to`, its ways most direct first, with `offered`
 * (the route the game offers) first of its mode. Room on trains, in ports and in trucks is the
 * army's and is not judged here.
 */
export function modeOptions(scenario: Scenario, state: GameState, factionId: FactionId, unitId: UnitId, offered: MoveRoute): readonly ModeOption[] {
  const { from, to } = offered;
  const option = (mode: LandMode): ModeOption => {
    let refusal: Refusal | undefined;
    const ways = candidates(scenario, mode, from, to).flatMap((each): (readonly MoveLeg[] | undefined)[] => {
      // A plain step carries no legs (CT-6).
      const legs = mode === "march" ? undefined : each;
      const verdict = validateMoveOrder(scenario, state, { factionId, from, kind: "move", ...(legs === undefined ? {} : { legs }), to, unitId });
      if (verdict.ok) return [legs];
      refusal ??= verdict.refusal;
      return [];
    });
    if (mode !== offered.mode) return { mode, reason: refusalText(scenario, refusal ?? noRoute(scenario, mode)), ways };
    const first = orderLegs(offered);
    return { mode, reason: "", ways: [first, ...ways.filter((legs) => wayKey(legs) !== wayKey(first))] };
  };
  const land = cardModes.map(option);
  return offered.mode === "sea" ? [...land, { mode: "sea", reason: "", ways: [orderLegs(offered)] }] : land;
}

/**
 * U6: every mode on a unit's card for one target. `offered` is the route the game offers it
 * (`moveRoutes`); it is always available. Each other land mode is available when one of its leg
 * lists passes the engine's order check and has a train place for the unit beside `others`, the
 * side's other planned moves (D5); otherwise it carries the first refusal.
 */
export function modeChips(scenario: Scenario, state: GameState, factionId: FactionId, unitId: UnitId, offered: MoveRoute, others: readonly MoveOrder[] = []): readonly ModeChip[] {
  const { from, to } = offered;
  return modeOptions(scenario, state, factionId, unitId, offered).map(({ mode, reason, ways }): ModeChip => {
    let full: string | undefined;
    for (const legs of ways) {
      const carried = legs === undefined ? {} : { legs };
      const refused = mode === offered.mode ? undefined : boardingRefusal(scenario, state, [{ factionId, from, kind: "move", ...carried, to, unitId }], others);
      if (refused === undefined) return { ...carried, mode, ok: true };
      full ??= refusalText(scenario, refused);
    }
    return { mode, ok: false, reason: full ?? reason };
  });
}
