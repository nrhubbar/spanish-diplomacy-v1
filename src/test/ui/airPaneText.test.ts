import { describe, expect, it } from "vitest";
import type { GeneralDefinition, UnitTypeDefinition, UnitTypeId } from "../../main/engine/types";
import {
  aircraftLine,
  aircraftMeta,
  allowedMissions,
  antiAirLabel,
  baseWeatherHeading,
  baseWeatherVerdict,
  fightersLabel,
  generalPill,
  missionHints,
  missionTitle
} from "../../main/presentation/airPane";
import { spainWithAir } from "../support";

const scenario = spainWithAir();
const typeOf = (id: string): UnitTypeDefinition => scenario.index.unitTypes.get(id as UnitTypeId)!;
const dot = "\u00b7";

describe("the aircraft pane's words (U2, U3, M11)", () => {
  const bomber = typeOf("bomber-squadron");

  it("names the type, the base, a paved field and the range", () => {
    expect(aircraftMeta(bomber, "Madrid", false)).toBe(`${bomber.name} ${dot} based at Madrid ${dot} range 4 territories`);
    expect(aircraftMeta(bomber, "Madrid", true)).toBe(`${bomber.name} ${dot} based at Madrid (paved airfield) ${dot} range 4 territories`);
    // A unit whose type is not an aircraft's (or unknown) reads as a grounded "Aircraft".
    expect(aircraftMeta(undefined, "Madrid", false)).toBe(`Aircraft ${dot} based at Madrid ${dot} range 0 territories`);
    expect(aircraftMeta(typeOf("general"), "Madrid", false)).toMatch(/range 0 territories$/u);
  });

  it("greys the missions a type cannot fly, and says why", () => {
    expect(allowedMissions(bomber)).toEqual(["raid", "support"]);
    expect(allowedMissions(typeOf("general"))).toEqual([]);
    expect(allowedMissions(undefined)).toEqual([]);
    expect(missionTitle(bomber, "raid")).toBe(missionHints.raid);
    expect(missionTitle(bomber, "patrol")).toBe(`A ${bomber.name} cannot fly this mission.`);
    expect(missionTitle(undefined, "recon")).toBe("A aircraft cannot fly this mission.");
  });

  it("lists an aircraft with its mission this turn, or standing down", () => {
    expect(aircraftLine("Breguet", "raid")).toBe(`Breguet ${dot} Raid`);
    expect(aircraftLine("Breguet", undefined)).toBe(`Breguet ${dot} standing down`);
  });

  it("states anti-air as the roll change and whether fighters may intercept", () => {
    expect(antiAirLabel(0)).toBe("none");
    expect(antiAirLabel(-3)).toBe("\u22123");
    expect(fightersLabel(0)).toBe("none");
    expect(fightersLabel(2)).toBe("may intercept");
  });

  it("says whether the aircraft flies in its base's weather", () => {
    expect(baseWeatherVerdict(false, false, "Clear")).toBe("flies");
    expect(baseWeatherVerdict(true, true, "Mud")).toBe("flies (paved airfield)");
    expect(baseWeatherVerdict(true, false, "Mud")).toBe("grounded (Mud)");
    expect(baseWeatherHeading("Meseta")).toBe(`Weather ${dot} Meseta `);
    expect(baseWeatherHeading(undefined)).toBe("Weather ");
  });
});

describe("a general's pill (U5)", () => {
  const miaja: GeneralDefinition = scenario.generals.find((general) => general.id === "jose-miaja")!;
  const trait = scenario.generalTraits.find((candidate) => candidate.id === miaja.traitId);

  it("names the general and his trait", () => {
    expect(generalPill(miaja, trait)).toEqual({ text: `Jos\u00e9 Miaja ${dot} Tenacious`, title: "Jos\u00e9 Miaja: Tenacious" });
    expect(generalPill(miaja, undefined)).toEqual({ text: "Jos\u00e9 Miaja", title: "Jos\u00e9 Miaja" });
  });
});
