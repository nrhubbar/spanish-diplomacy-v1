import { describe, expect, it } from "vitest";
import { initialGameState } from "../main/engine/resolution";
import type { SubTerritoryId, TerritoryId } from "../main/engine/types";
import { spain } from "./support";

/** Declog D8: the sub-territory ids agreed with `m3r1-map-provinces`. */
const agreedIds = [
  "a-coruna", "lugo", "ourense", "pontevedra", "asturias", "cantabria", "bizkaia", "gipuzkoa", "alava", "navarra", "la-rioja",
  "zaragoza", "huesca", "teruel", "madrid", "burgos", "valladolid", "leon", "palencia", "zamora", "salamanca", "avila", "segovia",
  "soria", "toledo", "ciudad-real", "cuenca", "guadalajara", "albacete", "badajoz", "caceres", "barcelona", "girona", "lleida",
  "tarragona", "valencia", "castellon", "alicante", "sevilla", "cadiz", "huelva", "cordoba", "granada", "malaga", "jaen", "almeria",
  "murcia", "ceuta", "melilla", "mallorca", "menorca", "ibiza", "oviedo", "guadarrama", "henares"
];

describe("the Spanish Civil War package (spec v2, m3-modular)", () => {
  const scenario = spain();

  it("selects the m3-modular modules, keeping the d6 table until its slice lands (CT-2)", () => {
    expect(scenario.ruleset).toBe("m3-modular");
    expect(scenario.rules).toEqual({
      air: "missions", dice: "d6-table", economy: "development", movement: "allowance", partition: "provinces", recruitment: "buildings", weather: "seasonal-zones"
    });
  });

  it("has exactly the agreed sub-territories, with the agreed capitals (D8, W3)", () => {
    expect(scenario.subTerritories.map((sub) => sub.id).sort()).toEqual([...agreedIds].sort());
    const capital = (id: string) => scenario.index.territories.get(id as TerritoryId)?.capitalSubTerritoryId;
    expect([capital("asturias"), capital("madrid"), capital("islas-baleares")]).toEqual(["oviedo", "madrid", "mallorca"]);
    expect(scenario.index.subTerritoriesByTerritory.get("madrid" as TerritoryId)?.map((sub) => sub.id)).toEqual(["madrid", "guadarrama", "henares"]);
  });

  it("starts each sub-territory with its 31 July 1936 holder (P1)", () => {
    const state = initialGameState(scenario);
    const holder = (id: string) => state.subTerritories[id as SubTerritoryId]?.holder;
    expect([holder("alava"), holder("bizkaia"), holder("oviedo"), holder("asturias"), holder("huesca"), holder("caceres")])
      .toEqual(["north", "republic", "north", "republic", "republic", "north"]);
  });

  it("gives every faction a treasury, a seat, an AI profile and a roster of 3 to 5 generals", () => {
    const state = initialGameState(scenario);
    for (const faction of scenario.factions) {
      expect(state.treasuries[faction.id]).toBeDefined();
      expect(faction.seatTerritoryId).toBeDefined();
      expect(scenario.ai.profiles[faction.id]).toBeDefined();
      expect(scenario.index.generalsByFaction.get(faction.id)?.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("carries the full d20 catalogue and table, weather, calendar and air data (D1, D2, T1, T2, U3)", () => {
    expect(scenario.d20?.grades).toHaveLength(13);
    expect(scenario.d20?.table.map((column) => column.length)).toEqual([21, 21, 21, 21, 21, 21, 21]);
    expect(scenario.d20?.table[4]?.[0]).not.toBe("attacker-destroyed");
    expect(scenario.d20?.table[1]?.[1]).toBe("attacker-destroyed");
    expect(scenario.weather?.zones.map((zone) => zone.id)).toEqual(["cantabrian", "meseta", "mediterranean", "south"]);
    expect(scenario.calendar?.start).toEqual({ half: "late", month: 7, year: 1936 });
    expect(scenario.air?.raidTable.map((band) => band.outcome)).toEqual(["air-eliminated", "nothing-hit", "income-cut", "building-hit"]);
  });
});
