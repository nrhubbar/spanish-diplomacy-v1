import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMissionOrder, SackOrder, SubTerritoryId, TerritoryId } from "../../main/engine/types";
import type { DestinationEstimate } from "../../main/presentation/odds";
import { focusesOnClick, oddsDestinations, type PlanningSession, planningMapView } from "../../main/state/planning";
import { type Draft, emptyDraft } from "../../main/state/session";
import { faction, move, spainId, spainWithAir, territory, unit } from "../support";

const scenario = spainWithAir();
const start = initialGameState(scenario);
const republic = faction("republic");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function session(draft: Partial<Draft> = {}): PlanningSession {
  return { draft: { ...emptyDraft, ...draft }, factionId: republic, game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state: start }, phase: "planning" };
}

describe("the planning map's view (O1, C1, U2, X3)", () => {
  it("shows a bare board before anything is selected", () => {
    const view = planningMapView(scenario, session(), [], new Map());
    expect(view).not.toHaveProperty("destinationEstimates");
    expect(view).not.toHaveProperty("focusedSubTerritoryId");
    expect(view).not.toHaveProperty("selectedAircraftId");
    expect(view).not.toHaveProperty("selectedTerritoryId");
    expect(view.plannedAirMissions).toEqual([]);
    expect(view.plannedOrders).toEqual([]);
    // Every own unit has an order, and only own units.
    const own = Object.values(start.units).filter((entry) => entry.factionId === republic);
    expect(view.unitOrders?.size).toBe(own.length);
    expect(view.unitOrders?.get(unit("rep-wad-ras-1"))).toBe("entrench");
  });

  it("carries the selection, the odds, the focus, and draws a Withdraw as its move and only air missions", () => {
    const raid: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "raid", subTerritoryId: sub("burgos") }, unitId: unit("rep-breguet-bombers") };
    const sack: SackOrder = { factionId: republic, kind: "sack", unitId: unit("rep-general-miaja") };
    const withdraw = { factionId: republic, from: territory("andalucia"), kind: "withdraw" as const, to: territory("murcia"), unitId: unit("rep-vitoria-8") };
    const march = move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha");
    const estimates = new Map<TerritoryId, DestinationEstimate>([[territory("castilla-la-mancha"), { kind: "reinforcement" }]]);
    const view = planningMapView(scenario, session({
      airOrders: [raid, sack],
      focusedSubTerritoryId: sub("madrid"),
      orders: [march, withdraw],
      selectedAircraftId: unit("rep-breguet-bombers"),
      selectedTerritoryId: territory("madrid"),
      selectedUnitIds: [unit("rep-covadonga-4")]
    }), [territory("castilla-la-mancha")], estimates);
    expect(view.destinationEstimates).toBe(estimates);
    expect(view.destinationIds).toEqual(["castilla-la-mancha"]);
    expect(view.focusedSubTerritoryId).toBe("madrid");
    expect(view.selectedAircraftId).toBe("rep-breguet-bombers");
    expect(view.selectedTerritoryId).toBe("madrid");
    expect([...view.selectedUnitIds]).toEqual(["rep-covadonga-4"]);
    expect([...view.orderedUnitIds]).toEqual(["rep-wad-ras-1", "rep-vitoria-8"]);
    expect(view.plannedOrders).toEqual([march, { ...withdraw, kind: "move" }]);
    expect(view.plannedAirMissions).toEqual([raid]);
  });

  it("gives a Withdraw's destinations no odds, and a Move's their odds", () => {
    const destinations = [territory("murcia")];
    expect(oddsDestinations({ ...emptyDraft, stage: { orderKind: "withdraw", step: "choose-destination" } }, destinations)).toEqual([]);
    expect(oddsDestinations({ ...emptyDraft, stage: { orderKind: "move", step: "choose-destination" } }, destinations)).toBe(destinations);
    expect(oddsDestinations({ ...emptyDraft, stage: { step: "choose-order" } }, destinations)).toBe(destinations);
    expect(oddsDestinations(emptyDraft, destinations)).toBe(destinations);
  });

  it("focuses a sub-territory on a second click inside the selected territory, never while giving an order", () => {
    const inMadrid: Draft = { ...emptyDraft, selectedTerritoryId: territory("madrid") };
    expect(focusesOnClick(scenario, inMadrid, sub("madrid"))).toBe(true);
    // The first click elsewhere selects the territory instead.
    expect(focusesOnClick(scenario, inMadrid, sub("burgos"))).toBe(false);
    expect(focusesOnClick(scenario, emptyDraft, sub("madrid"))).toBe(false);
    expect(focusesOnClick(scenario, { ...inMadrid, stage: { step: "choose-order" } }, sub("madrid"))).toBe(false);
    expect(focusesOnClick(scenario, inMadrid, sub("atlantis"))).toBe(false);
  });
});
