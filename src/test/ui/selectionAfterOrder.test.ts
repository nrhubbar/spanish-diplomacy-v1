import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState } from "../../main/engine/types";
import { chooseDestination, chooseOrder, clearSelection, type PlanningSession, removeOrder, selectAircraft, selectTerritory, toggleUnit } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, spain, spainId, spainWithAir, territory, unit } from "../support";

/**
 * Note 11 (copied from the m3r2-probe acceptance tests): after an order the selection goes to
 * none, not back to every unit without an order.
 */

function planning(state: GameState): PlanningSession {
  return {
    draft: emptyDraft,
    factionId: faction("republic"),
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  };
}

describe("note 11: after an order the selection goes to none, not back to all", () => {
  it("selects nothing after one unit of a group is given a Move", () => {
    const scenario = spain();
    const opened = selectTerritory(planning(initialGameState(scenario)), territory("madrid"), scenario);
    expect(opened.draft.selectedUnitIds.length).toBeGreaterThan(1);
    const one = toggleUnit(clearSelection(opened), unit("rep-wad-ras-1"), scenario);
    expect(one.draft.selectedUnitIds).toEqual(["rep-wad-ras-1"]);
    const moved = chooseDestination(scenario, chooseOrder(scenario, one, "move"), territory("castilla-la-mancha"));
    expect(moved.draft.orders.map((order) => order.unitId)).toEqual(["rep-wad-ras-1"]);
    expect(moved.draft.selectedUnitIds).toEqual([]);
    // The territory stays open, so its other units are one click away.
    expect(moved.draft.selectedTerritoryId).toBe("madrid");
  });

  it("selects nothing after a sub-group is told to Entrench", () => {
    const scenario = spain();
    const opened = selectTerritory(planning(initialGameState(scenario)), territory("madrid"), scenario);
    const one = toggleUnit(clearSelection(opened), unit("rep-wad-ras-1"), scenario);
    const entrenched = chooseOrder(scenario, one, "entrench");
    expect(entrenched.draft.selectedUnitIds).toEqual([]);
  });
});

describe("U2: the armies told to stay are remembered", () => {
  it("records Entrench, keeps it through selection changes, and forgets it when the order is cleared", () => {
    const scenario = spain();
    const opened = selectTerritory(planning(initialGameState(scenario)), territory("madrid"), scenario);
    const one = toggleUnit(clearSelection(opened), unit("rep-wad-ras-1"), scenario);
    const entrenched = chooseOrder(scenario, one, "entrench");
    expect(entrenched.draft.orderedToStay).toEqual(["rep-wad-ras-1"]);
    const again = chooseOrder(scenario, toggleUnit(entrenched, unit("rep-wad-ras-1"), scenario), "entrench");
    expect(again.draft.orderedToStay).toEqual(["rep-wad-ras-1"]);
    const elsewhere = selectTerritory(again, territory("valencia"), scenario);
    expect(elsewhere.draft.orderedToStay).toEqual(["rep-wad-ras-1"]);
    expect(removeOrder(elsewhere, unit("rep-wad-ras-1")).draft.orderedToStay).toEqual([]);
    expect(removeOrder(opened, unit("rep-wad-ras-1")).draft.orderedToStay).toBeUndefined();
  });

  it("keeps every plan when an aircraft is selected, dropping only the selection", () => {
    const scenario = spainWithAir();
    const opened = selectTerritory(planning(initialGameState(scenario)), territory("madrid"), scenario);
    const entrenched = chooseOrder(scenario, toggleUnit(clearSelection(opened), unit("rep-wad-ras-1"), scenario), "entrench");
    const aircraft = selectAircraft(entrenched, unit("rep-breguet-bombers"));
    expect(aircraft.draft.orderedToStay).toEqual(["rep-wad-ras-1"]);
    expect(aircraft.draft.selectedAircraftId).toBe("rep-breguet-bombers");
    expect(aircraft.draft.feedback).toBeUndefined();
    expect(aircraft.draft.selectedUnitIds).toEqual([]);
  });
});

describe("U2: a move replaces an earlier stay order", () => {
  it("drops the army from the stay list when it is moved", () => {
    const scenario = spain();
    const opened = selectTerritory(planning(initialGameState(scenario)), territory("madrid"), scenario);
    const one = (session: PlanningSession) => toggleUnit(clearSelection(session), unit("rep-wad-ras-1"), scenario);
    const entrenched = chooseOrder(scenario, one(opened), "entrench");
    const moved = chooseDestination(scenario, chooseOrder(scenario, one(entrenched), "move"), territory("castilla-la-mancha"));
    expect(moved.draft.orderedToStay).toEqual([]);
    expect(removeOrder(moved, unit("rep-wad-ras-1")).draft.feedback).toBeUndefined();
  });
});
