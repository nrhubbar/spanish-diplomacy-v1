import { describe, expect, it } from "vitest";
import { planningMapView } from "../../main/screens/planningMapView";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMissionOrder, GameState, UnitId } from "../../main/engine/types";
import type { MapPackage } from "../../main/scenarios/loader";
import { createGameReducer, disbandUnit, orderFromMuster, planAirMission, removePlannedOrder } from "../../main/state/gameSlice";
import { cancelIdleSupport, type PlanningSession } from "../../main/state/planning";
import type { Draft } from "../../main/state/session";
import { faction, move, spainWithAir, territory, unit, testGame, told } from "../support";

/** N3: one planned attack, one planned move. */

const scenario = spainWithAir();
const start = initialGameState(scenario);
const republic = faction("republic");
const castile = territory("castilla-y-leon");
const extremadura = territory("extremadura");
const wadRas = unit("rep-wad-ras-1");
const security = unit("rep-madrid-security");
const fighters = unit("rep-ni52-fighters");
const bombers = unit("rep-breguet-xix");

const support = (unitId: UnitId, territoryId = castile): AirMissionOrder => ({ factionId: republic, kind: "air-mission", mission: { kind: "support", territoryId }, unitId });
const marches = (...unitIds: readonly string[]) => unitIds.map((id) => move("republic", id, "madrid", "castilla-y-leon"));

function session(draft: Partial<Draft> = {}, state: GameState = start): PlanningSession {
  return {
    draft: { orders: [], selectedUnitIds: [], ...draft },
    factionId: republic,
    game: { assignments: {}, history: [], ready: [], scenarioId: scenario.id, gameId: testGame, state },
    phase: "planning"
  };
}

const reduce = createGameReducer({ registry: { list: () => [], require: () => ({ map: {} as MapPackage, scenario, version: "test" }) } });
const after = (before: PlanningSession, action: Parameters<typeof reduce>[1]): Draft => {
  const next = reduce({ session: before }, action).session;
  if (next.phase !== "planning") throw new Error("still planning");
  return next.draft;
};

describe("N3: Ground Support goes with the attack it was planned for", () => {
  const attack = { airOrders: [support(fighters)], orders: marches("rep-wad-ras-1", "rep-madrid-security") };
  const note = "Ground Support over Castilla y León is cancelled too: none of your units go there now.";

  it("stays while a unit still goes, and is cancelled with the last one, saying so", () => {
    const one = after(session(attack), removePlannedOrder(wadRas));
    expect(one.airOrders).toEqual(attack.airOrders);
    expect(one.feedback).toBeUndefined();
    const none = after(session(one), removePlannedOrder(security));
    expect(none.airOrders).toEqual([]);
    expect(told(scenario, none.feedback)).toBe(note);
    expect(planningMapView(scenario, session(none), [], new Map()).plannedAirMissions).toEqual([]);
  });

  it("is cancelled by every other way the attack ends: Disband, and the pane sending its units nowhere", () => {
    const one = { ...attack, orders: marches("rep-wad-ras-1") };
    expect(after(session(one), disbandUnit(wadRas))).toMatchObject({ airOrders: [], feedback: { before: { code: "disband-planned" }, code: "support-cancelled", territoryIds: [castile] } });
    const pane = after(session(one), orderFromMuster({ kind: "invade", moves: [], shown: [wadRas], support: [fighters], target: castile }));
    expect(pane.airOrders).toEqual([]);
    expect(told(scenario, pane.feedback)).toContain(note);
  });

  it("keeps a flight the same order gives, even with no units left to go", () => {
    const pane = after(session({ ...attack, airOrders: [], orders: marches("rep-wad-ras-1") }), orderFromMuster({ kind: "invade", moves: [], shown: [wadRas, fighters], support: [fighters], target: castile }));
    expect(pane.orders).toEqual([]);
    expect(pane.airOrders).toEqual([support(fighters)]);
    expect(told(scenario, pane.feedback)).not.toContain("cancelled too");
  });

  it("stays planned on its own, or over ground where the player's units stand", () => {
    const alone = session({ airOrders: [support(fighters)], orders: [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")] });
    expect(after(alone, removePlannedOrder(wadRas)).airOrders).toEqual([support(fighters)]);
    expect(Object.values(start.units).some((each) => each.factionId === republic && each.territoryId === extremadura)).toBe(true);
    const standing = { airOrders: [support(fighters, extremadura)], orders: [move("republic", "rep-wad-ras-1", "madrid", "extremadura")] };
    expect(after(session(standing), removePlannedOrder(wadRas)).airOrders).toEqual(standing.airOrders);
  });

  it("leaves other missions and other places alone, and reads no support where none is planned", () => {
    const both: Draft = { ...session().draft, airOrders: [support(fighters), { ...support(bombers), mission: { kind: "patrol", territoryId: castile } }, { factionId: republic, kind: "sack", unitId: unit("nobody") }], orders: marches("rep-wad-ras-1") };
    expect(after(session(both), removePlannedOrder(wadRas)).airOrders?.map((order) => order.unitId)).toEqual([bombers, "nobody"]);
    const bare = session({ orders: [] });
    expect(cancelIdleSupport(scenario, session({ orders: marches("rep-wad-ras-1") }), bare)).toBe(bare);
    expect(after(session({ airOrders: [support(fighters)] }), planAirMission({ unitId: fighters })).airOrders).toEqual([]);
  });

  it("draws only the missions that will be submitted", () => {
    const moved = session({ airOrders: [support(fighters)], orders: [move("republic", fighters, "madrid", "valencia")] });
    expect(planningMapView(scenario, moved, [], new Map()).plannedAirMissions).toEqual([]);
  });
});
