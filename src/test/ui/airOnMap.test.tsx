import { cleanup, render, screen, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMissionOrder, GameState, SubTerritoryId } from "../../main/engine/types";
import { AirLayer, placeAircraft } from "../../main/map/layers/AirLayer";
import { staticMapView } from "../../main/map/view";
import { clickUnit, orderChoices, type PlanningSession, selectTerritory } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { AirPane } from "../../main/screens/pane/AirPane";
import { faction, shippedRegistry, spainId, spainWithAir, territory, testStore, unit } from "../support";

/** U14: air on the map. Note 7's cases are copied from the `m3r2-probe` branch's `uiBugs.test.tsx`. */

afterEach(cleanup);

function planning(state: GameState): PlanningSession {
  return {
    draft: emptyDraft,
    factionId: faction("republic"),
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  };
}

describe("note 7: a bomber raid's order line ends at the target sub-territory", () => {
  it("draws the raid line to Burgos, not to the Castilla y Leon label", () => {
    const scenario = spainWithAir();
    const pkg = shippedRegistry().require(spainId);
    const start = initialGameState(scenario);
    const toScreen = (point: { readonly x: number; readonly y: number }) => point;
    const scenarioPackage = { ...pkg, scenario };
    const { placements } = placeAircraft(scenarioPackage, start, toScreen, []);
    const raid: AirMissionOrder = { factionId: faction("republic"), kind: "air-mission", mission: { kind: "raid", subTerritoryId: "burgos" as SubTerritoryId }, unitId: unit("rep-breguet-bombers") };
    const view = { ...staticMapView, plannedAirMissions: [raid] };
    const { container } = render(<AirLayer game={start} level="detail" placements={placements} scenarioPackage={scenarioPackage} toScreen={toScreen} unitSymbols={new Map()} view={view} />);
    const line = container.querySelector(".air-mission-line[data-mission=\"raid\"]");
    expect(line).not.toBeNull();
    const end = { x: Number(line?.getAttribute("x2")), y: Number(line?.getAttribute("y2")) };
    const territoryLabel = pkg.map.territories.get(territory("castilla-y-leon"))?.label;
    const burgos = pkg.map.subTerritories?.entries.get("burgos" as SubTerritoryId);
    expect(burgos).toBeDefined();
    // Today the line ends at the territory label of Castilla y Leon.
    expect(end).not.toEqual({ x: territoryLabel?.x, y: territoryLabel?.y });
    expect([burgos?.label, burgos?.capital]).toContainEqual(end);
  });

  it("still ends a territory mission (Ground Support) on the territory's label", () => {
    const scenario = spainWithAir();
    const pkg = shippedRegistry().require(spainId);
    const start = initialGameState(scenario);
    const toScreen = (point: { readonly x: number; readonly y: number }) => point;
    const scenarioPackage = { ...pkg, scenario };
    const { placements } = placeAircraft(scenarioPackage, start, toScreen, []);
    const support: AirMissionOrder = { factionId: faction("republic"), kind: "air-mission", mission: { kind: "support", territoryId: territory("castilla-la-mancha") }, unitId: unit("rep-breguet-bombers") };
    const { container } = render(<AirLayer game={start} level="detail" placements={placements} scenarioPackage={scenarioPackage} toScreen={toScreen} unitSymbols={new Map()} view={{ ...staticMapView, plannedAirMissions: [support] }} />);
    const line = container.querySelector(".air-mission-line[data-mission=\"support\"]");
    const label = pkg.map.territories.get(territory("castilla-la-mancha"))?.label;
    expect({ x: Number(line?.getAttribute("x2")), y: Number(line?.getAttribute("y2")) }).toEqual({ x: label?.x, y: label?.y });
  });

  it("falls back to the territory's label on a map without sub-territories", () => {
    const scenario = spainWithAir();
    const pkg = shippedRegistry().require(spainId);
    const start = initialGameState(scenario);
    const toScreen = (point: { readonly x: number; readonly y: number }) => point;
    const map = { ...pkg.map };
    delete (map as { subTerritories?: unknown }).subTerritories;
    const scenarioPackage = { ...pkg, map, scenario };
    const { placements } = placeAircraft(scenarioPackage, start, toScreen, []);
    const raid: AirMissionOrder = { factionId: faction("republic"), kind: "air-mission", mission: { kind: "raid", subTerritoryId: "burgos" as SubTerritoryId }, unitId: unit("rep-breguet-bombers") };
    const { container } = render(<AirLayer game={start} level="detail" placements={placements} scenarioPackage={scenarioPackage} toScreen={toScreen} unitSymbols={new Map()} view={{ ...staticMapView, plannedAirMissions: [raid] }} />);
    const line = container.querySelector(".air-mission-line[data-mission=\"raid\"]");
    const label = pkg.map.territories.get(territory("castilla-y-leon"))?.label;
    expect({ x: Number(line?.getAttribute("x2")), y: Number(line?.getAttribute("y2")) }).toEqual({ x: label?.x, y: label?.y });
  });
});

describe("U14: selecting an aircraft offers only air orders", () => {
  const scenario = spainWithAir();
  const bomber = unit("rep-breguet-bombers");

  it("leaves no ground units selected, so the selection bar offers no ground orders", () => {
    const withArmies = selectTerritory(planning(initialGameState(scenario)), territory("madrid"), scenario);
    expect(withArmies.draft.selectedUnitIds.length).toBeGreaterThan(0);
    const picked = clickUnit(scenario, withArmies, bomber);
    expect(picked.draft.selectedAircraftId).toBe(bomber);
    expect(picked.draft.selectedUnitIds).toEqual([]);
    expect(orderChoices(scenario, picked)).toEqual([]);
  });

  it("names the missions Patrol, Ground Support, Raid and Recon, in that order", () => {
    const session = clickUnit(scenario, planning(initialGameState(scenario)), bomber);
    render(<Provider store={testStore()}><AirPane scenario={scenario} session={session} unitId={bomber} /></Provider>);
    const group = screen.getByRole("group", { name: "Mission" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual(["Patrol", "Ground Support", "Raid", "Recon", "Stand down"]);
  });
});
