import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMission, GameState, RaisedUnitDefinition, Scenario, SubTerritoryId, UnitTypeId } from "../../main/engine/types";
import {
  airDraftOrders,
  airTargets,
  closeAircraft,
  isAircraft,
  isSackPlanned,
  keepAirOrders,
  missionTerritoryId,
  type PlanningSession,
  plannedMission,
  raidPreview,
  selectAircraft,
  setAirMission,
  toggleSack
} from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, move, spainId, spainWithAir, territory, unit } from "../support";

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function planning(state: GameState, factionId = "republic"): PlanningSession {
  return {
    draft: emptyDraft,
    factionId: faction(factionId),
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  };
}

/** Adds a unit raised in play, as `GameState.raised` carries it. */
function withRaised(state: GameState, id: string, factionId: string, type: string, territoryId: string): GameState {
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id: unit(id), name: id, type: type as UnitTypeId };
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id: unit(id), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}

describe("air orders in the planning draft (U2, U5)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);
  const raidBurgos: AirMission = { kind: "raid", subTerritoryId: sub("burgos") };

  it("keeps the air orders only when the draft has them", () => {
    expect(keepAirOrders(emptyDraft)).toEqual({});
    const airOrders = [{ factionId: faction("republic"), kind: "sack" as const, unitId: unit("rep-general-miaja") }];
    expect(keepAirOrders({ ...emptyDraft, airOrders })).toEqual({ airOrders });
  });

  it("submits the air orders of units that have no move", () => {
    expect(airDraftOrders(emptyDraft)).toEqual([]);
    const sack = { factionId: faction("republic"), kind: "sack" as const, unitId: unit("rep-general-miaja") };
    const flight = { factionId: faction("republic"), kind: "air-mission" as const, mission: raidBurgos, unitId: unit("rep-breguet-bombers") };
    const draft = { ...emptyDraft, airOrders: [sack, flight], orders: [move("republic", "rep-general-miaja", "madrid", "castilla-la-mancha")] };
    expect(airDraftOrders(draft)).toEqual([flight]);
  });

  it("tells aircraft from ground units", () => {
    expect(isAircraft(scenario, state, unit("rep-breguet-bombers"))).toBe(true);
    expect(isAircraft(scenario, state, unit("rep-general-miaja"))).toBe(false);
    expect(isAircraft(scenario, state, unit("no-such-unit"))).toBe(false);
  });

  it("selects only an own aircraft, with its territory behind it, and closes it again", () => {
    const session = planning(state);
    expect(selectAircraft(session, unit("no-such-unit"))).toBe(session);
    expect(selectAircraft(session, unit("south-ju52-bombers"))).toBe(session);
    const selected = selectAircraft({ ...session, draft: { ...emptyDraft, airOrders: [], selectedUnitIds: [unit("rep-wad-ras-1")] } }, unit("rep-breguet-bombers"));
    expect(selected.draft).toEqual({ airOrders: [], orders: [], selectedAircraftId: "rep-breguet-bombers", selectedTerritoryId: "madrid", selectedUnitIds: [] });
    const closed = closeAircraft(selected);
    expect(closed.draft.selectedAircraftId).toBeUndefined();
    expect(closed.draft.selectedTerritoryId).toBe("madrid");
  });

  it("plans one mission per aircraft, replaces it, refuses an invalid one, and stands down", () => {
    const session = planning(state);
    expect(plannedMission(session.draft, unit("rep-breguet-bombers"))).toBeUndefined();
    const raiding = setAirMission(scenario, session, unit("rep-breguet-bombers"), raidBurgos);
    expect(plannedMission(raiding.draft, unit("rep-breguet-bombers"))?.mission).toEqual(raidBurgos);
    expect(raiding.draft.feedback).toBeUndefined();
    const valladolid: AirMission = { kind: "raid", subTerritoryId: sub("valladolid") };
    const replaced = setAirMission(scenario, raiding, unit("rep-breguet-bombers"), valladolid);
    expect(replaced.draft.airOrders).toHaveLength(1);
    expect(plannedMission(replaced.draft, unit("rep-breguet-bombers"))?.mission).toEqual(valladolid);
    const refused = setAirMission(scenario, replaced, unit("rep-breguet-bombers"), { kind: "raid", subTerritoryId: sub("madrid") });
    expect(refused.draft.feedback).toMatch(/another faction holds/u);
    expect(plannedMission(refused.draft, unit("rep-breguet-bombers"))?.mission).toEqual(valladolid);
    const down = setAirMission(scenario, replaced, unit("rep-breguet-bombers"), undefined);
    expect(down.draft.airOrders).toEqual([]);
    expect(down.draft.feedback).toBeUndefined();
  });

  it("toggles a free Sack that replaces the general's move, and refuses a unit that is no general", () => {
    const session = planning(state);
    expect(isSackPlanned(session.draft, unit("rep-general-miaja"))).toBe(false);
    const moving = { ...session, draft: { ...emptyDraft, orders: [move("republic", "rep-general-miaja", "madrid", "castilla-la-mancha"), move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")] } };
    const sacked = toggleSack(scenario, moving, unit("rep-general-miaja"));
    expect(isSackPlanned(sacked.draft, unit("rep-general-miaja"))).toBe(true);
    expect(sacked.draft.orders.map((order) => order.unitId)).toEqual(["rep-wad-ras-1"]);
    const withdrawn = toggleSack(scenario, sacked, unit("rep-general-miaja"));
    expect(isSackPlanned(withdrawn.draft, unit("rep-general-miaja"))).toBe(false);
    expect(withdrawn.draft.airOrders).toEqual([]);
    const refused = toggleSack(scenario, session, unit("rep-wad-ras-1"));
    expect(refused.draft.feedback).toBe("Only a general can be sacked.");
    expect(refused.draft.airOrders).toBeUndefined();
  });

  it("lists every valid target of a kind, nearest first, naming sub-territories with their territory", () => {
    const raids = airTargets(scenario, state, unit("rep-breguet-bombers"), "raid");
    expect(raids.length).toBeGreaterThan(0);
    expect(raids.every((target, index) => index === 0 || (raids[index - 1]?.distance ?? 0) <= target.distance)).toBe(true);
    expect(raids.find((target) => target.mission.kind === "raid" && target.mission.subTerritoryId === "burgos")).toMatchObject({ distance: 1, name: "Burgos (Castilla y Le\u00f3n)", territoryId: "castilla-y-leon" });
    // A sub-territory named like its territory is named once.
    expect(raids.some((target) => target.name === "Navarra")).toBe(true);
    expect(raids.some((target) => target.territoryId === "madrid")).toBe(false);
    const intercepts = airTargets(scenario, state, unit("rep-ni52-fighters"), "patrol");
    expect(intercepts.find((target) => target.territoryId === "castilla-y-leon")).toMatchObject({ mission: { kind: "patrol", territoryId: "castilla-y-leon" }, name: "Castilla y Le\u00f3n" });
    expect(airTargets(scenario, state, unit("rep-ni52-fighters"), "raid")).toEqual([]);
    expect(airTargets(scenario, state, unit("rep-wad-ras-1"), "raid")).toEqual([]);
    expect(airTargets(scenario, state, unit("no-such-unit"), "recon")).toEqual([]);
  });

  it("names the territory a mission flies to", () => {
    expect(missionTerritoryId(scenario, raidBurgos)).toBe("castilla-y-leon");
    expect(missionTerritoryId(scenario, { kind: "raid", subTerritoryId: sub("atlantis") })).toBeUndefined();
    expect(missionTerritoryId(scenario, { kind: "recon", territoryId: territory("aragon") })).toBe("aragon");
  });
});

describe("the raid preview (U3)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("reads the raid table into chances that sum to one", () => {
    const preview = raidPreview(scenario, state, unit("rep-breguet-bombers"), sub("burgos"));
    expect(preview?.antiAir).toBe(0);
    expect(preview?.fightersInReach).toBe(0);
    // The table: air eliminated up to 3, nothing hit up to 7, income cut up to 14, building hit up to 20.
    expect(preview?.chances["air-eliminated"]).toBeCloseTo(3 / 20);
    expect(preview?.chances["nothing-hit"]).toBeCloseTo(4 / 20);
    expect(preview?.chances["income-cut"]).toBeCloseTo(7 / 20);
    expect(preview?.chances["building-hit"]).toBeCloseTo(6 / 20);
  });

  it("counts anti-air at the target and enemy fighters that reach it", () => {
    const defended = withRaised(withRaised(state, "north-flak", "north", "anti-air-battery", "castilla-y-leon"), "north-fighters", "north", "fighter-squadron", "castilla-y-leon");
    const preview = raidPreview(scenario, defended, unit("rep-breguet-bombers"), sub("burgos"));
    expect(preview?.antiAir).toBe(-3);
    expect(preview?.fightersInReach).toBe(1);
    expect(preview?.chances["air-eliminated"]).toBeCloseTo(6 / 20);
    expect(preview?.chances["building-hit"]).toBeCloseTo(3 / 20);
    // The raider's own fighters never intercept it.
    const ownFighters = raidPreview(scenario, state, unit("south-ju52-bombers"), sub("madrid"));
    expect(ownFighters?.fightersInReach).toBe(1);
  });

  it("previews nothing for an unknown unit, target, or a scenario without air rules", () => {
    expect(raidPreview(scenario, state, unit("no-such-unit"), sub("burgos"))).toBeUndefined();
    expect(raidPreview(scenario, state, unit("rep-breguet-bombers"), sub("atlantis"))).toBeUndefined();
    const withoutAir = { ...scenario };
    delete (withoutAir as { air?: unknown }).air;
    expect(raidPreview(withoutAir, state, unit("rep-breguet-bombers"), sub("burgos"))).toBeUndefined();
  });

  it("skips raid-table gaps without a band", () => {
    const gappy: Scenario = { ...scenario, air: { ...scenario.air!, raidTable: [{ outcome: "income-cut", upTo: 10 }] } };
    const preview = raidPreview(gappy, state, unit("rep-breguet-bombers"), sub("burgos"));
    expect(preview?.chances["income-cut"]).toBeCloseTo(0.5);
    expect(preview?.chances["building-hit"]).toBe(0);
  });
});
