import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, Scenario, UnitTypeDefinition, UnitTypeId } from "../../main/engine/types";
import {
  menShort,
  recruitAddNote,
  recruitAddReason,
  recruitRequirements,
  recruitSiteName,
  recruitsWith,
  recruitTerms,
  resourceCells,
  resourcesLabel,
  termsLine,
  turnsLabel
} from "../../main/presentation/recruitment";
import { faction, spain, territory } from "../support";

const scenario = spain();
const typeOf = (id: string): UnitTypeDefinition => scenario.index.unitTypes.get(id as UnitTypeId)!;
const building = (id: string): BuildingId => id as BuildingId;
const dot = "\u00b7";

describe("the Recruit tab's words (X4, Q-UX-05)", () => {
  it("recruits at the territory's capital sub-territory, or at the territory without one", () => {
    expect(recruitSiteName(scenario, territory("madrid"))).toBe(scenario.index.subTerritories.get(scenario.index.territories.get(territory("madrid"))!.capitalSubTerritoryId!)!.name);
    const madrid = scenario.index.territories.get(territory("madrid"))!;
    const withoutCapital = { ...madrid };
    delete (withoutCapital as { capitalSubTerritoryId?: unknown }).capitalSubTerritoryId;
    const noCapital: Scenario = { ...scenario, index: { ...scenario.index, territories: new Map([...scenario.index.territories, [madrid.id, withoutCapital]]) } };
    expect(recruitSiteName(noCapital, territory("madrid"))).toBe(madrid.name);
    expect(recruitSiteName(noCapital, territory("atlantis"))).toBe("");
  });

  it("names the capital's buildings and the tracks a type needs, if any", () => {
    const state = initialGameState(scenario);
    const names = (id: string, standing: readonly BuildingId[]): readonly string[] => recruitsWith(scenario, state, faction("republic"), territory(id), standing).map(({ name }) => name);
    expect(names("extremadura", [])).toEqual([]);
    expect(names("extremadura", [building("barracks"), building("depot")])).toEqual(["Barracks", "Depot"]);
    expect(names("madrid", [building("barracks")])).toEqual(["Barracks", "Factory"]);
  });

  it("gives a type's price, men and training time, in the row and in its tooltip", () => {
    const infantry = typeOf("infantry-regiment");
    const cost = resourcesLabel(scenario, infantry.recruit!.cost, ` ${dot} `);
    const terms = recruitTerms(scenario, infantry);
    expect(terms.map(({ kind }) => kind)).toEqual(["cost", "men", "training", "upkeep"]);
    expect(termsLine(terms, "detail")).toBe(`${cost} ${dot} ${menShort(700)} ${dot} trains in ${turnsLabel(2)} ${dot} upkeep 0.3k Manpower a turn`);
    expect(termsLine(terms, "meta")).toBe(`${cost} ${dot} ${menShort(700)} ${dot} ${turnsLabel(2)} ${dot} upkeep 0.3k Manpower`);
    // A type the scenario does not recruit costs nothing and trains no one.
    const notRecruited = { ...infantry };
    delete (notRecruited as { recruit?: unknown }).recruit;
    (notRecruited as { upkeep: unknown }).upkeep = {};
    expect(termsLine(recruitTerms(scenario, notRecruited), "meta")).toBe(`${resourcesLabel(scenario, {}, ` ${dot} `)} ${dot} ${menShort(0)} ${dot} ${turnsLabel(0)}`);
    expect(recruitRequirements(scenario, initialGameState(scenario), faction("north"), territory("la-rioja"), notRecruited)).toEqual([]);
  });

  it("marks each building and track a type needs as there or not", () => {
    expect(recruitRequirements(scenario, initialGameState(scenario), faction("north"), territory("cantabria"), typeOf("artillery-group"))).toEqual([{ have: true, name: "Barracks" }, { have: false, name: "Factory" }]);
    expect(recruitRequirements(scenario, initialGameState(scenario), faction("north"), territory("la-rioja"), typeOf("militia-column"))).toEqual([]);
  });

  it("says the same reason in a few words, with the term it is about", () => {
    expect(recruitAddNote(true, "Funds", "Short next turn.")).toEqual({ text: "No orders left" });
    expect(recruitAddNote(false, "Funds", "Short next turn.")).toEqual({ term: "cost", text: "Not enough Funds" });
    expect(recruitAddNote(false, "", "Short next turn.")).toEqual({ term: "upkeep", text: "Upkeep too high next turn" });
    expect(recruitAddNote(false, "", undefined)).toBeUndefined();
  });

  it("gives every total the same resources", () => {
    expect(resourceCells(scenario, { funds: 3 } as never).map((cell) => cell.text)).toEqual(["3"]);
    expect(resourceCells(scenario, {}, true).map((cell) => cell.text)).toEqual(["0", "0k"]);
  });

  it("says why one more cannot be added: locks first, then the turn's orders, then the price", () => {
    expect(recruitAddReason(["Needs Barracks.", "Contested."], true, "Funds")).toBe("Needs Barracks. Contested.");
    expect(recruitAddReason([], true, "Funds")).toBe("No Recruit orders left here this turn.");
    expect(recruitAddReason([], false, "Funds and Manpower")).toBe("Not enough Funds and Manpower.");
    expect(recruitAddReason([], false, "")).toBeUndefined();
    expect(recruitAddReason([], false, "", "Short next turn.")).toBe("Short next turn.");
    expect(recruitAddReason([], false, "Funds", "Short next turn.")).toBe("Not enough Funds.");
  });
});
