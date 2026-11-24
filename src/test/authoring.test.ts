import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strippedScenario } from "../../scripts/strip-citations";
import { citationProblems, withoutCitations } from "../main/scenarios/authoring";
import { scenarioSchema } from "../main/scenarios/schema/scenarioSchema";
import { createScenarioRegistry } from "../main/scenarios/registry";
import { builtInSources } from "../main/scenarios/builtInSources";

type Json = Record<string, unknown>;
const path = "src/scenarios/spanish-civil-war-1936/scenario.json";
const text = readFileSync(path, "utf8");
const authored = (): Json => JSON.parse(text) as Json;
const list = (value: unknown): Json[] => value as Json[];

describe("citations in an authored scenario", () => {
  it("are complete in the shipped game", () => {
    expect(citationProblems(scenarioSchema.parse(authored()))).toEqual([]);
  });

  it.each([
    ["a unit without a source", (s: Json) => { list(s["units"])[0]!["sources"] = []; }, /^units: ".*" needs a source$/u],
    ["a general without a source", (s: Json) => { list((s["generals"] as Json)["roster"])[0]!["sources"] = []; }, /^generals\.roster: ".*" needs a source$/u],
    ["a sub-territory with neither", (s: Json) => { const sub = list(s["subTerritories"])[0]!; delete sub["note"]; delete sub["sources"]; }, /^subTerritories: ".*" needs sources or a note \(L18\)$/u],
    ["a link with neither", (s: Json) => { const link = list(s["links"])[0]!; delete link["note"]; delete link["sources"]; }, /^links: .* needs sources or a note \(L28\)$/u]
  ])("are refused for %s, by the check and by the build", (_name, spoil, message) => {
    const spoiled = authored();
    spoil(spoiled);
    const problems = citationProblems(scenarioSchema.parse(spoiled));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(message);
    expect(() => strippedScenario(JSON.stringify(spoiled))).toThrow(message);
  });

  it("ship with none of them, as the same game", () => {
    const shipped = strippedScenario(text);
    expect(shipped).not.toMatch(/"(?:note|sources|historicalNote)":/u);
    expect(shipped.length).toBeLessThan(JSON.stringify(authored()).length * 0.7);
    const key = `/${path}`;
    const registry = createScenarioRegistry({ ...builtInSources, scenarios: { ...builtInSources.scenarios, [key]: JSON.parse(shipped) as unknown } });
    expect(registry.problems).toEqual([]);
    const full = createScenarioRegistry(builtInSources).require("spanish-civil-war-1936" as never).scenario;
    const bare = registry.require("spanish-civil-war-1936" as never).scenario;
    expect(withoutCitations(JSON.parse(JSON.stringify(bare.unitTypes)))).toEqual(withoutCitations(JSON.parse(JSON.stringify(full.unitTypes))));
    expect(bare.units.map((unit) => [unit.id, unit.strength, unit.territoryId])).toEqual(full.units.map((unit) => [unit.id, unit.strength, unit.territoryId]));
  });
});
