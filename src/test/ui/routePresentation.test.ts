import { describe, expect, it } from "vitest";
import type { MoveRoute } from "../../main/engine/movement/routes";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, RaisedUnitDefinition, Scenario, SubTerritoryId, UnitId, UnitState, UnitTypeId } from "../../main/engine/types";
import { beforePlanning, weatherIn } from "../../main/engine/weather";
import {
  armyLeaving,
  routeChips,
  routeChipText,
  routeDetail,
  routeRows,
  routeTag,
  selectionRoutes,
  subTerritoryName
} from "../../main/presentation/movement";
import { armies, destinationCallout, plannedOrderRoute } from "../../main/presentation/text";
import { faction, spainWithAir, territory, unit } from "../support";

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const dot = "\u00b7";
const minus = "\u2212";

function route(overrides: Partial<MoveRoute> = {}): MoveRoute {
  return {
    cost: 1,
    from: territory("madrid"),
    legs: [{ kind: "land", to: territory("castilla-la-mancha") }],
    mode: "march",
    path: [],
    rough: [],
    shape: "step",
    staging: territory("madrid"),
    steps: 1,
    to: territory("castilla-la-mancha"),
    transit: [],
    ...overrides
  };
}

const ride = {
  boarding: sub("madrid"),
  crossings: 2,
  end: territory("valencia"),
  level: 2,
  range: 4,
  stations: [sub("madrid"), sub("valencia")],
  start: territory("madrid"),
  through: [territory("castilla-la-mancha")]
};

const battle = { kind: "battle" } as never;
const reinforce = { kind: "reinforcement" } as never;

/** Raises a unit of the type in play, under the id the engine gives recruits (R6). */
function withRaised(state: GameState, serial: number, type: string, territoryId: string, factionId = "republic"): readonly [GameState, UnitId] {
  const id = raisedUnitId(faction(factionId), type as UnitTypeId, serial);
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id, type: type as UnitTypeId };
  return [{
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  }, id];
}

function tired(state: GameState, id: string, fatigue: number): UnitState {
  const found = state.units[unit(id)];
  if (found === undefined) throw new Error(id);
  return { ...found, fatigue };
}

describe("route tags (X5)", () => {
  it("tags every shape, with one wording for the map and the pane (m8)", () => {
    expect(routeTag(route())).toBeUndefined();
    expect(routeTag(route({ shape: "march", steps: 3 }))).toBe("March 3");
    expect(routeTag(route({ shape: "rail" }))).toBe("By rail");
    expect(routeTag(route({ shape: "step-rail" }))).toBe("March, then rail");
    const railStep = routeTag(route({ shape: "rail-step" }));
    expect(railStep).toBe("Rail, then march");
    expect(railStep).not.toMatch(/attack/u);
    expect(routeTag(route({ shape: "rail-step" }), true)).toMatch(/^Rail\b.*attack$/u);
    expect(routeTag(route({ sea: { departure: sub("valencia"), kind: "amphibious" }, shape: "sea" }))).toBe("Amphibious");
    expect(routeTag(route({ sea: { departure: sub("valencia"), kind: "port", level: 1, port: sub("mallorca") }, shape: "sea" }))).toBe("By sea");
    expect(routeTag(route({ shape: "sea" }))).toBe("By sea");
  });

  it("puts the tag before the chip, or the chip alone", () => {
    expect(routeChipText(undefined, "Unopposed")).toBe("Unopposed");
    expect(routeChipText(route(), "Unopposed")).toBe("Unopposed");
    expect(routeChipText(route({ shape: "rail" }), "Reinforce", reinforce)).toBe(`By rail ${dot} Reinforce`);
    expect(routeChipText(route({ shape: "rail-step" }), "2:1", battle)).toMatch(/attack \u00b7 2:1$/u);
  });

  it("names sub-territories, or falls back to the id", () => {
    const scenario = spainWithAir();
    expect(subTerritoryName(scenario, sub("burgos"))).toBe("Burgos");
    expect(subTerritoryName(scenario, sub("atlantis"))).toBe("atlantis");
  });
});

describe("route chips (X5)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("warns of rough ground on steps and marches, and counts the moves left", () => {
    const chips = routeChips(scenario, route({ cost: 2, rough: [sub("guadarrama")], shape: "march", steps: 2 }), [], 4, undefined);
    expect(chips).toEqual([
      { kind: "terrain", text: "Mountain entry (Sierra de Guadarrama)", warn: true },
      { kind: "moves", text: "2 moves left after", warn: false }
    ]);
    expect(routeChips(scenario, route(), [], 2, undefined)).toEqual([{ kind: "moves", text: "1 move left after", warn: false }]);
    expect(routeChips(scenario, route(), [], 1, undefined)).toEqual([]);
    // Rough entries count only on a step or a march; a ride's terrain is free.
    expect(routeChips(scenario, route({ rail: ride, rough: [sub("guadarrama")], shape: "rail" }), [], 1, undefined).map((chip) => chip.kind)).toEqual(["rail"]);
  });

  it("names a swamp, and treats an unknown entry as mountain", () => {
    const swampy: Scenario = {
      ...scenario,
      index: { ...scenario.index, subTerritories: new Map([...scenario.index.subTerritories].map(([id, entry]) => [id, id === sub("henares") ? { ...entry, terrain: "swamp" } : entry])) }
    };
    expect(routeChips(swampy, route({ rough: [sub("henares"), sub("atlantis")] }), [], 1, undefined).map((chip) => chip.text))
      .toEqual(["Swamp entry (Henares)", "Mountain entry (atlantis)"]);
  });

  it("warns of fatigued units only when the move attacks", () => {
    const units = [tired(state, "rep-wad-ras-1", 2), tired(state, "rep-covadonga-4", 3), tired(state, "rep-madrid-security", 0)];
    expect(routeChips(scenario, route(), units, 1, battle)).toEqual([{ kind: "fatigue", text: `Fatigued ${minus}2 on 2 units`, warn: true }]);
    expect(routeChips(scenario, route(), units.slice(0, 1), 1, battle).map((chip) => chip.text)).toEqual([`Fatigued ${minus}2 on 1 unit`]);
    expect(routeChips(scenario, route(), units, 1, reinforce)).toEqual([]);
  });

  it("shows rail, port and amphibious landings, and the transit", () => {
    expect(routeChips(scenario, route({ rail: ride, shape: "rail-step", transit: [territory("valencia")] }), [], 1, undefined)).toEqual([
      { kind: "rail", text: expect.stringMatching(/^Rail\b.*\b2$/u) as string, warn: false },
      { kind: "transit", text: "Via Valencia", warn: false }
    ]);
    expect(routeChips(scenario, route({ sea: { departure: sub("valencia"), kind: "port", level: 1, port: sub("mallorca") }, shape: "sea" }), [], 1, undefined))
      .toEqual([{ kind: "sea", text: "Port of Mallorca", warn: false }]);
    expect(routeChips(scenario, route({ sea: { departure: sub("valencia"), kind: "port" }, shape: "sea" }), [], 1, undefined).map((chip) => chip.text))
      .toEqual(["Port of Valencia"]);
    expect(routeChips(scenario, route({ sea: { departure: sub("valencia"), kind: "amphibious" }, shape: "sea" }), [], 1, undefined))
      .toEqual([{ kind: "sea", text: `Amphibious ${minus}4`, warn: true }]);
  });
});

describe("route detail and breakdown rows (X5)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);

  it("says nothing for a plain step", () => {
    expect(routeDetail(scenario, state, route(), 0)).toBeUndefined();
  });

  it("explains a ride, its train places and the transit stop", () => {
    const detail = routeDetail(scenario, state, route({ rail: ride, shape: "rail-step", transit: [territory("valencia")] }), 3);
    expect(detail).toContain("Rail from Madrid to Valencia, level 2 or better the whole way (range 4)");
    expect(detail).toContain("uses 3 of Madrid's 6 train places");
    expect(detail).toMatch(/\u00b7 Stops in Valencia if an enemy (army|unit) enters it/u);
  });

  it("uses the singular for a station with one train place", () => {
    const one: GameState = { ...state, subTerritories: { ...state.subTerritories, [sub("burgos")]: { ...state.subTerritories[sub("burgos")]!, buildings: [], rail: 1 } } };
    const narrow: Scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, rail: { label: "Railway", rangeByLevel: { main: 4, single: 2 }, unitsPerLevel: 1 } } };
    const detail = routeDetail(narrow, one, route({ rail: { ...ride, boarding: sub("burgos"), start: territory("castilla-y-leon") }, shape: "rail" }), 1);
    expect(detail).toContain("uses 1 of Burgos's 1 train place");
    expect(detail).not.toContain("places");
  });

  it("explains port landings and amphibious assaults", () => {
    expect(routeDetail(scenario, state, route({ sea: { departure: sub("valencia"), kind: "port", level: 2, port: sub("mallorca") }, shape: "sea" }), 0))
      .toBe("Sails from Valencia, lands at Mallorca (2 a turn)");
    expect(routeDetail(scenario, state, route({ sea: { departure: sub("valencia"), kind: "port" }, shape: "sea" }), 0))
      .toBe("Sails from Valencia, lands at Valencia (0 a turn)");
    expect(routeDetail(scenario, state, route({ sea: { departure: sub("valencia"), kind: "amphibious" }, shape: "sea" }), 0))
      .toMatch(/^Sails from Valencia and storms the coast: one (army|unit) per lane a turn$/u);
    expect(routeDetail(scenario, state, route({ shape: "march", steps: 2, transit: [territory("castilla-la-mancha")] }), 0))
      .toMatch(/^Stops in Castilla-La Mancha if an enemy (army|unit) enters it$/u);
  });

  it("lists the moves used, rough entries, the ride, the landing and the weather", () => {
    expect(routeRows(scenario, state, route({ cost: 3 }), 2)).toEqual([{ label: "Moves this turn", value: "2 of 2" }]);
    expect(routeRows(scenario, state, route({ cost: 3, rough: [sub("guadarrama"), sub("atlantis")], shape: "march", steps: 2 }), 3)).toEqual([
      { label: "Moves this turn", value: "3 of 3" },
      { label: "Enters Sierra de Guadarrama (mountain)", value: "+1 move" },
      { label: "Enters atlantis (mountain)", value: "+1 move" }
    ]);
    expect(routeRows(scenario, state, route({ cost: 0, rail: ride, rough: [sub("guadarrama")], shape: "rail", steps: 0 }), 2)).toEqual([
      { label: "Moves this turn", value: "0 of 2" },
      { label: "Rail, level 2", value: "2 of 4 borders" }
    ]);
    expect(routeRows(scenario, state, route({ sea: { departure: sub("valencia"), kind: "amphibious" }, shape: "sea" }), 1)).toContainEqual({ label: "Amphibious assault", value: `${minus}4` });
    const noRoll = { ...scenario, d20: { ...scenario.d20, modifiers: { ...scenario.d20.modifiers, amphibious: 0 } } };
    expect(routeRows(noRoll, state, route({ sea: { departure: sub("valencia"), kind: "amphibious" }, shape: "sea" }), 1)).toContainEqual({ label: "Amphibious assault", value: "No roll modifier" });
    const rolled = beforePlanning(scenario, state, 3);
    const weather = weatherIn(scenario, rolled, territory("castilla-la-mancha"));
    expect(weather).toBeDefined();
    expect(routeRows(scenario, rolled, route(), 1)).toContainEqual({ label: `Weather ${dot} Castilla-La Mancha`, value: weather?.name, weatherId: weather?.id });
  });
});

describe("the army leaving and the offered routes (X5)", () => {
  const scenario = spainWithAir();
  const state = initialGameState(scenario);
  const madrid = territory("madrid");
  const foot = [unit("rep-wad-ras-1"), unit("rep-covadonga-4")];

  it("offers no routes without the allowance module, and none for an empty selection", () => {
    const single: Scenario = { ...scenario, rules: { ...scenario.rules, movement: "single-step" } };
    expect(selectionRoutes(single, state, faction("republic"), madrid, foot, [])).toBeUndefined();
    expect(selectionRoutes(scenario, state, faction("republic"), undefined, foot, [])?.size).toBe(0);
    expect(selectionRoutes(scenario, state, faction("republic"), madrid, [], [])?.size).toBe(0);
    const routes = selectionRoutes(scenario, state, faction("republic"), madrid, foot, []);
    expect(routes?.get(territory("castilla-la-mancha"))?.shape).toBe("step");
  });

  it("sums up the army: units, attack, moves and the trucks it lacks", () => {
    const single: Scenario = { ...scenario, rules: { ...scenario.rules, movement: "single-step" } };
    expect(armyLeaving(single, state, faction("republic"), madrid, foot)).toBeUndefined();
    expect(armyLeaving(scenario, state, faction("republic"), madrid, [])).toBeUndefined();
    const two = armyLeaving(scenario, state, faction("republic"), madrid, foot);
    expect(two?.heading).toMatch(new RegExp(`^(Army|Units?) leaving Madrid ${dot} 2 units, \\d+ attack$`, "u"));
    expect(two?.line).toMatch(/^\d+ moves? this turn: no trucks \(1 truck for these 2 units would give \+1\)\. Rail does not use moves\.$/u);
    const one = armyLeaving(scenario, state, faction("republic"), madrid, foot.slice(0, 1));
    expect(one?.heading).toMatch(/ 1 unit, \d+ attack$/u);
    // The wording for one unit reads "these 1 unit" (reported as a copy bug); only the count is pinned.
    expect(one?.line).toMatch(/\(1 truck for /u);
    const three = armyLeaving(scenario, state, faction("republic"), madrid, [...foot, unit("rep-madrid-security")]);
    expect(three?.line).toContain("(2 trucks for these 3 units would give +1)");
    const ghost = armyLeaving(scenario, state, faction("republic"), madrid, [unit("no-such-unit")]);
    expect(ghost?.heading).toMatch(/ 0 units, 0 attack$/u);
  });

  it("counts the trucks, and says when every unit is mounted", () => {
    const [oneRaised, truck] = withRaised(state, 1, "truck-column", "madrid");
    const [trucked, secondTruck] = withRaised(oneRaised, 2, "truck-column", "madrid");
    const oneTruck = armyLeaving(scenario, trucked, faction("republic"), madrid, [...foot, truck]);
    expect(oneTruck?.line).toMatch(/: 1 truck for 2 units\./u);
    const twoTrucks = armyLeaving(scenario, trucked, faction("republic"), madrid, [foot[0]!, truck, secondTruck]);
    expect(twoTrucks?.line).toMatch(/: 2 trucks for 1 unit\./u);
    const [mounted, cavalry] = withRaised(state, 1, "cavalry-regiment", "madrid");
    const horse = armyLeaving(scenario, mounted, faction("republic"), madrid, [cavalry]);
    expect(horse?.line).toMatch(/: all mounted\./u);
    expect(horse?.line).toMatch(/^(1 move|\d+ moves) this turn/u);
  });
});

describe("the destination callout and the planned order list (O1, C1)", () => {
  const scenario = spainWithAir();
  const arrow = "\u2192";

  it("counts units in the singular and plural", () => {
    expect(armies(1)).toBe("1 unit");
    expect(armies(3)).toBe("3 units");
  });

  it("says what is moving or withdrawing from where, and how to cancel it", () => {
    expect(destinationCallout(scenario, "move", 2, territory("madrid"))).toEqual({ cancel: "Cancel move", text: "Moving 2 units from Madrid. Choose a highlighted territory on the map." });
    expect(destinationCallout(scenario, "withdraw", 1, territory("andalucia"))).toEqual({ cancel: "Cancel withdrawal", text: "Withdrawing 1 unit from Andaluc\u00eda. Choose a highlighted territory on the map." });
    // No territory selected (the pane never shows this, but the text stays well formed).
    expect(destinationCallout(scenario, "move", 0, undefined).text).toBe("Moving 0 units from . Choose a highlighted territory on the map.");
  });

  it("reads a planned Withdraw as the move it makes", () => {
    const order = { factionId: faction("republic"), from: territory("andalucia"), to: territory("murcia"), unitId: unit("rep-vitoria-8") };
    expect(plannedOrderRoute(scenario, { ...order, kind: "move" })).toBe(`Andaluc\u00eda ${arrow} Murcia`);
    expect(plannedOrderRoute(scenario, { ...order, kind: "withdraw" })).toBe(`Withdraw: Andaluc\u00eda ${arrow} Murcia`);
  });
});
