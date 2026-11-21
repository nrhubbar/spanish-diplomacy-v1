import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MoveRoute } from "../main/engine/movement/routes";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, Scenario, SubTerritoryId, UnitState } from "../main/engine/types";
import { armyLeaving, routeChips, routeDetail, routeRows, routeTag, selectionRoutes } from "../main/presentation/movement";
import { RouteCard } from "../main/screens/movement/RouteCard";
import { blockedOrders, enemyPresent, inContestedGround, selectedWithdrawRoutes, withdrawDestinations } from "../main/state/planning/contested";
import { type PlanningSession, selectTerritory } from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { armyIn, faction, onD6Dice, spainD20, spainId, territory, tiny, unit, withUnits } from "./support";

/**
 * M-9: the route chips, rows, detail line and "Army leaving" summary for every route shape
 * (X5), the breakdown card, and contested-ground planning helpers (C1), on shipped Spain.
 */

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const t = territory;

function route(partial: Partial<MoveRoute> & Pick<MoveRoute, "shape" | "to">): MoveRoute {
  return { cost: 1, from: t("madrid"), legs: [{ kind: "land", to: partial.to }], mode: "march", path: [], rough: [], staging: t("madrid"), steps: 1, transit: [], ...partial };
}

const ride = { boarding: sub("madrid"), crossings: 2, end: t("catalunya"), level: 2, range: 4, start: t("madrid"), stations: [sub("madrid"), sub("barcelona")], through: [t("castilla-la-mancha"), t("valencia")] };

describe("route chips and rows for each shape (X5)", () => {
  const scenario = spainD20();
  const state = initialGameState(scenario);

  it("names a mountain or swamp entry, the moves left and the fatigue on a march", () => {
    const march = route({ cost: 3, legs: [{ kind: "land", to: t("aragon") }, { kind: "land", to: t("catalunya") }], rough: [sub("huesca")], shape: "march", steps: 2, to: t("catalunya"), transit: [t("aragon")] });
    const tired = [{ ...armyIn(state, "rep-wad-ras-1"), fatigue: 2 }] as readonly UnitState[];
    const chips = routeChips(scenario, march, tired, 4, { kind: "battle" } as never);
    expect(chips.map((chip) => chip.kind)).toEqual(["terrain", "fatigue", "transit", "moves"]);
    expect(chips[0]?.text).toBe("Mountain entry (Huesca)");
    expect(chips[1]?.text).toContain("1 unit");
    expect(chips[3]?.text).toBe("1 move left after");
    expect(routeChips(scenario, march, [...tired, ...tired], 5, { kind: "battle" } as never).map((chip) => chip.text)).toEqual(expect.arrayContaining(["2 moves left after", expect.stringContaining("2 units")]));
    expect(routeTag(march)).toBe("March 2");
    expect(routeDetail(scenario, state, march, 0)).toBe("Stops in Arag\u00f3n if an enemy army enters it");
    const rows = routeRows(scenario, state, march, 4);
    expect(rows[0]).toEqual({ label: "Moves this turn", value: "3 of 4" });
    expect(rows[1]).toEqual({ label: "Enters Huesca (mountain)", value: "+1 move" });
  });

  it("calls an unknown entry a mountain and a swamp a swamp", () => {
    const swampy: Scenario = { ...scenario, index: { ...scenario.index, subTerritories: new Map([...scenario.index.subTerritories, [sub("huesca"), { ...scenario.index.subTerritories.get(sub("huesca"))!, terrain: "swamp" }]]) } };
    const step = route({ rough: [sub("huesca")], shape: "step", to: t("aragon") });
    expect(routeChips(swampy, step, [], 1, undefined)[0]?.text).toBe("Swamp entry (Huesca)");
    expect(routeChips(scenario, route({ rough: [sub("nowhere")], shape: "step", to: t("aragon") }), [], 1, undefined)[0]?.text).toBe("Mountain entry (nowhere)");
    expect(routeTag(step)).toBeUndefined();
    expect(routeDetail(scenario, state, step, 0)).toBeUndefined();
  });

  it("describes a ride, the places left to board and where it may be stopped", () => {
    const rail = route({ legs: [{ kind: "rail", to: t("catalunya") }], rail: ride, shape: "rail", steps: 0, to: t("catalunya"), transit: ride.through });
    expect(routeChips(scenario, rail, [], 1, undefined).map((chip) => chip.text)).toEqual(["Rail \u00b7 level 2", "Via Castilla-La Mancha, Valencia"]);
    const detail = routeDetail(scenario, state, rail, 0) ?? "";
    expect(detail).toContain("Rail from Madrid to Catalu\u00f1a, level 2 or better the whole way (range 4)");
    expect(detail).toContain("Stops in Castilla-La Mancha, Valencia if an enemy army enters it");
    expect(routeRows(scenario, state, rail, 1)).toContainEqual({ label: "Rail, level 2", value: "2 of 4 borders" });
    expect(routeTag(route({ shape: "step-rail", to: t("catalunya") }))).toBe("March, then rail");
    expect(routeTag(route({ shape: "rail-step", to: t("aragon") }), false)).toBe("Rail, then march");
  });

  it("separates a port landing from an amphibious assault, with the d20 modifier only under the d20", () => {
    const port = route({ legs: [{ kind: "sea", to: t("islas-baleares") }], sea: { departure: sub("barcelona"), kind: "port", level: 2, port: sub("mallorca") }, shape: "sea", to: t("islas-baleares") });
    expect(routeChips(scenario, port, [], 1, undefined)).toEqual([{ kind: "sea", text: "Port of Mallorca", warn: false }]);
    expect(routeDetail(scenario, state, port, 0)).toBe("Sails from Barcelona, lands at Mallorca (2 a turn)");
    expect(routeTag(port)).toBe("By sea");
    const assault = route({ legs: [{ kind: "sea", to: t("islas-baleares") }], sea: { departure: sub("barcelona"), kind: "amphibious" }, shape: "sea", to: t("islas-baleares") });
    expect(routeChips(scenario, assault, [], 1, undefined)[0]).toEqual({ kind: "sea", text: "Amphibious \u22124", warn: true });
    expect(routeRows(scenario, state, assault, 1)).toContainEqual({ label: "Amphibious assault", value: "\u22124" });
    expect(routeDetail(scenario, state, assault, 0)).toBe("Sails from Barcelona and storms the coast: one army per lane a turn");
    expect(routeTag(assault)).toBe("Amphibious");
    const d6 = onD6Dice(scenario);
    expect(routeChips(d6, assault, [], 1, undefined)[0]?.text).toBe("Amphibious assault");
    expect(routeRows(d6, state, assault, 1)).toContainEqual({ label: "Amphibious assault", value: "No roll modifier" });
  });

  it("adds the weather row for the destination when the turn has weather", () => {
    const zones = Object.fromEntries((scenario.weather?.zones ?? []).map((zone) => [zone.id, "rain"]));
    const wet: GameState = { ...state, weather: { outcomes: zones as NonNullable<GameState["weather"]>["outcomes"], roll: 15 } };
    expect(routeRows(scenario, wet, route({ shape: "step", to: t("aragon") }), 1).at(-1)?.label).toBe("Weather \u00b7 Arag\u00f3n");
  });
});

describe("the army leaving (X5, M1)", () => {
  const scenario = spainD20();

  it("counts trucks with the scenario's own carrying number, and mounted armies", () => {
    const state = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-sevilla-34", "republic", "madrid"], ["rep-vitoria-8", "republic", "madrid"]]);
    const three = [unit("rep-wad-ras-1"), unit("rep-sevilla-34"), unit("rep-vitoria-8")];
    expect(armyLeaving(scenario, state, faction("republic"), t("madrid"), three)?.line).toBe("1 move this turn: no trucks (2 trucks for these 3 units would give +1). Rail does not use moves.");
    expect(armyLeaving(scenario, state, faction("republic"), t("madrid"), [unit("rep-wad-ras-1")])?.heading).toMatch(/^Army leaving Madrid \u00b7 1 unit, \d+ attack$/);
    expect(armyLeaving(scenario, state, faction("republic"), t("madrid"), [])).toBeUndefined();
    expect(armyLeaving(tiny(), state, faction("republic"), t("madrid"), three)).toBeUndefined();
  });

  it("reads trucks and cavalry raised in play", async () => {
    const { raisedDefinition, raisedUnitId } = await import("../main/engine/recruitment/rules");
    const base = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]);
    const truck = raisedUnitId(faction("republic"), "truck-column" as never, 1);
    const horse = raisedUnitId(faction("republic"), "cavalry-regiment" as never, 1);
    const place = (id: typeof truck): UnitState => ({ ...armyIn(base, "rep-wad-ras-1"), id });
    const state: GameState = { ...base, raised: { [truck]: raisedDefinition(scenario, truck)!, [horse]: raisedDefinition(scenario, horse)! }, units: { ...base.units, [truck]: place(truck), [horse]: place(horse) } };
    expect(armyLeaving(scenario, state, faction("republic"), t("madrid"), [unit("rep-wad-ras-1"), truck])?.line).toBe("2 moves this turn: 1 truck for 1 unit. Rail does not use moves.");
    expect(armyLeaving(scenario, state, faction("republic"), t("madrid"), [horse])?.line).toBe("2 moves this turn: all mounted. Rail does not use moves.");
    const two = raisedUnitId(faction("republic"), "truck-column" as never, 2);
    const both: GameState = { ...state, raised: { ...state.raised, [two]: raisedDefinition(scenario, two)! }, units: { ...state.units, [two]: place(two) } };
    expect(armyLeaving(scenario, both, faction("republic"), t("madrid"), [unit("rep-wad-ras-1"), truck, two])?.line).toContain("2 trucks for 1 unit");
  });

  it("offers no routes without a selection, and none under single steps", () => {
    const state = initialGameState(scenario);
    expect(selectionRoutes(scenario, state, faction("republic"), undefined, [], [])?.size).toBe(0);
    expect(selectionRoutes(tiny(), state, faction("republic"), t("madrid"), [unit("rep-wad-ras-1")], [])).toBeUndefined();
  });
});

describe("the route breakdown card (X5)", () => {
  const scenario = spainD20();
  const state = initialGameState(scenario);
  const step = route({ shape: "step", to: t("aragon") });

  it("shows the odds, modifiers and take chance for an attack", () => {
    const estimate = { attack: 12, defence: 6, kind: "battle", modifiers: [{ kind: "amphibious", roll: -4 }], oddsLabel: "2:1", takeChance: 0.5 } as never;
    render(<RouteCard allowance={1} estimate={estimate} route={step} scenario={scenario} state={state} />);
    expect(screen.getByRole("heading", { name: "Attack Arag\u00f3n" })).toBeInTheDocument();
    expect(screen.getByText("Odds (attack 12 v defence 6)")).toBeInTheDocument();
    expect(screen.getByText("Chance to take it")).toBeInTheDocument();
  });

  it("names a reinforcement and a plain move", () => {
    cleanup();
    const { unmount } = render(<RouteCard allowance={1} estimate={{ kind: "reinforcement" } as never} route={step} scenario={scenario} state={state} />);
    expect(screen.getByRole("heading", { name: "Reinforce Arag\u00f3n" })).toBeInTheDocument();
    unmount();
    render(<RouteCard allowance={1} estimate={undefined} route={step} scenario={scenario} state={state} />);
    expect(screen.getByRole("heading", { name: "Move to Arag\u00f3n" })).toBeInTheDocument();
    expect(screen.queryByText("Chance to take it")).toBeNull();
  });
});

describe("planning in contested ground: the helpers (C1)", () => {
  const scenario = spainD20();
  const session = (state: GameState, factionId = "republic"): PlanningSession => ({
    draft: emptyDraft,
    factionId: faction(factionId),
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  });

  it("finds the Withdraw routes of the selected units, and none without a selection", () => {
    const start = initialGameState(scenario);
    expect(selectedWithdrawRoutes(scenario, session(start))).toEqual([]);
    const andalucia = selectTerritory(session(start), t("andalucia"));
    // R1: the Málaga regiment's pocket is Málaga alone; its only way out is the sea lane.
    expect(withdrawDestinations(scenario, andalucia)).toEqual(["murcia"]);
    expect(inContestedGround(scenario, andalucia, armyIn(start, "rep-vitoria-8"))).toBe(true);
    expect(inContestedGround(undefined, andalucia, armyIn(start, "rep-vitoria-8"))).toBe(false);
    expect(enemyPresent(andalucia, t("andalucia"))).toBe(true);
    expect(enemyPresent(andalucia, t("madrid"))).toBe(false);
  });

  it("greys out Replenish only where the scenario has recruitment", () => {
    expect(blockedOrders(scenario).map((entry) => entry.label)).toEqual(["Move, Entrench, Rest", "Replenish"]);
    const none: Scenario = { ...scenario, rules: { ...scenario.rules, recruitment: "none" } };
    expect(blockedOrders(none).map((entry) => entry.label)).toEqual(["Move, Entrench, Rest"]);
  });
});

