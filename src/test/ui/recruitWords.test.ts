import { describe, expect, it } from "vitest";
import type { BuildingId, Scenario, UnitTypeDefinition, UnitTypeId } from "../../main/engine/types";
import {
  capitalBuildingsLabel,
  menShort,
  recruitAddReason,
  recruitRequirements,
  recruitSiteName,
  recruitTerms,
  resourcesLabel,
  turnsLabel
} from "../../main/presentation/recruitment";
import { spain, territory } from "../support";

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

  it("names the capital's buildings, or says there are none", () => {
    expect(capitalBuildingsLabel(scenario, [])).toBe("No buildings");
    expect(capitalBuildingsLabel(scenario, [building("barracks"), building("factory")])).toBe(`Barracks ${dot} Factory`);
  });

  it("gives a type's price, men and training time, in the row and in its tooltip", () => {
    const infantry = typeOf("infantry-regiment");
    const cost = resourcesLabel(scenario, infantry.recruit!.cost, ` ${dot} `);
    expect(recruitTerms(scenario, infantry)).toEqual({
      detail: `${cost} ${dot} ${menShort(700)} ${dot} trains in ${turnsLabel(2)}`,
      meta: `${cost} ${dot} ${menShort(700)} ${dot} ${turnsLabel(2)}`
    });
    // A type the scenario does not recruit costs nothing and trains no one.
    const notRecruited = { ...infantry };
    delete (notRecruited as { recruit?: unknown }).recruit;
    expect(recruitTerms(scenario, notRecruited).meta).toBe(`${resourcesLabel(scenario, {}, ` ${dot} `)} ${dot} ${menShort(0)} ${dot} ${turnsLabel(0)}`);
    expect(recruitRequirements(scenario, notRecruited, [])).toEqual([]);
  });

  it("marks each building a type needs as standing or not", () => {
    expect(recruitRequirements(scenario, typeOf("artillery-group"), [building("barracks")])).toEqual([{ have: true, name: "Barracks" }, { have: false, name: "Factory" }]);
    expect(recruitRequirements(scenario, typeOf("militia-column"), [])).toEqual([]);
  });

  it("says why one more cannot be added: locks first, then the turn's orders, then the price", () => {
    expect(recruitAddReason(["Needs Barracks.", "Contested."], true, "Funds")).toBe("Needs Barracks. Contested.");
    expect(recruitAddReason([], true, "Funds")).toBe("No Recruit orders left here this turn.");
    expect(recruitAddReason([], false, "Funds and Manpower")).toBe("Not enough Funds and Manpower.");
    expect(recruitAddReason([], false, "")).toBeUndefined();
  });
});
