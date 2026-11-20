// The generated sub-territory topology is the single source for the scenario's borders, connection
// entries and city placement (declog D13): scenario.json must equal sub-territory-topology.json.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scenarioDocument, topologyDocument } from "../../scripts/map/iberia-1936.ts";

interface Topology {
  readonly subTerritoryBorders: readonly (readonly [string, string])[];
  readonly connections: readonly { readonly between: readonly [string, string]; readonly entry: readonly [string, string] }[];
  readonly cities: Readonly<Record<string, string>>;
}
interface Scenario {
  readonly subTerritoryBorders: readonly (readonly [string, string])[];
  readonly connections: readonly { readonly between: readonly [string, string]; readonly entry?: readonly [string, string] }[];
  readonly cities: readonly { readonly id: string; readonly subTerritoryId?: string }[];
}

const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

describe("scenario topology", () => {
  const topology = read<Topology>(topologyDocument);
  const scenario = read<Scenario>(scenarioDocument);

  it("uses the generated sub-territory borders", () => {
    expect(scenario.subTerritoryBorders).toEqual(topology.subTerritoryBorders);
  });

  it("uses the generated connection entries, in scenario order", () => {
    expect(scenario.connections.map((c) => [c.between, c.entry])).toEqual(topology.connections.map((c) => [c.between, c.entry]));
  });

  it("places every city in its generated sub-territory", () => {
    expect(Object.fromEntries(scenario.cities.map((c) => [c.id, c.subTerritoryId]))).toEqual(topology.cities);
  });
});
