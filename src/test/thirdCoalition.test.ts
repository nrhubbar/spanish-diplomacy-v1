// The Europe 1805 package: its topology is the generated one, its small states stay at home, and a
// whole game's worth of order kinds is accepted by the rules.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mapDocument, scenarioPackage, terrain, topologyDocument } from "../../scripts/map/europe-1805";
import { legalMoves } from "../main/ai/computerPlayer";
import { initialGameState } from "../main/engine/resolution";
import type { FactionId, Scenario, ScenarioId, UnitId } from "../main/engine/types";
import { citationProblems } from "../main/scenarios/authoring";
import { scenarioSchema } from "../main/scenarios/schema/scenarioSchema";
import { playComputerGame } from "../sim/engine";
import { shippedRegistry } from "./support";

interface Topology {
  readonly cities: Readonly<Record<string, string>>;
  readonly connections: readonly { readonly between: readonly string[]; readonly entry: readonly string[]; readonly kind: string }[];
  readonly subTerritoryBorders: readonly (readonly string[])[];
}
const read = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
const scenario = (): Scenario => shippedRegistry().require("third-coalition-1805" as ScenarioId).scenario;
const majors = ["france", "united-kingdom", "prussia", "russia", "austria", "ottoman-empire"];
/** The Serbian rising is meant to fight for the rest of Serbia. */
const homebound = (): FactionId[] => scenario().factions.map((faction) => faction.id).filter((id) => !majors.includes(id) && id !== "serbia");

describe("Europe 1805 package", () => {
  it("uses the generated borders, connections and city places", () => {
    const topology = read(topologyDocument) as Topology;
    const document = scenarioSchema.parse(read(`${scenarioPackage}scenario.json`));
    expect(document.subTerritoryBorders).toEqual(topology.subTerritoryBorders);
    expect(document.connections.map(({ between, entry, kind }) => ({ between, entry, kind }))).toEqual(topology.connections.map(({ between, entry, kind }) => ({ between, entry, kind })));
    expect(Object.fromEntries(document.cities.map((city) => [city.id, city.subTerritoryId]))).toEqual(topology.cities);
  });

  it("cites or notes everything an authored scenario must", () => {
    expect(citationProblems(scenarioSchema.parse(read(`${scenarioPackage}scenario.json`)))).toEqual([]);
  });

  it("gives every power its own color", () => {
    const colors = scenario().factions.map((faction) => faction.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("keeps each relief layer small enough for any WebGL device", () => {
    const { terrain: shipped } = read(mapDocument) as { terrain: { layers: readonly { bounds: unknown }[] } };
    const layers = [terrain.overview, terrain.detail];
    expect(shipped.layers.map((layer) => layer.bounds)).toEqual(layers.map((layer) => layer.bounds));
    for (const { bounds, texelsPerUnit } of layers) expect(Math.max(bounds.width, bounds.height) * texelsPerUnit).toBeLessThanOrEqual(4096);
  });

  it("lets the Grande Armée march, ride and sail", () => {
    const game = initialGameState(scenario());
    const destinations = (unit: string): string[] => legalMoves(scenario(), game, game.units[unit as UnitId]!).map((order) => order.to);
    expect(destinations("fra-lannes-infantry-division")).toEqual(expect.arrayContaining(["belgium", "southern-england"]));
    expect(destinations("fra-d-hautpoul-s-cuirassiers")).toEqual(expect.arrayContaining(["swabia"]));
    expect(destinations("fra-lannes-infantry-division")).not.toContain("swabia");
  });

  it("has no railways, trucks or aircraft", () => {
    expect(scenario().unitTypes.filter((type) => type.kind === "air" || type.effects.some((effect) => effect.kind === "transport"))).toEqual([]);
    expect(scenario().linkModifiers.rail).toBeUndefined();
    expect(scenario().subTerritories.filter((sub) => sub.buildable.some((item) => String(item) === "rail"))).toEqual([]);
  });

  it("plays turns whose orders all stand, with the small states staying at home", () => {
    const home = homebound();
    const kinds = new Set<string>();
    playComputerGame(scenario(), 1805, 2, ({ before, result }) => {
      for (const outcome of result.outcomes) kinds.add(outcome.kind);
      for (const unit of Object.values(result.finalState.units)) {
        if (!home.includes(unit.factionId)) continue;
        const start = before.control[unit.territoryId];
        expect(start?.kind === "controlled" && start.factionId, `${unit.id} in ${unit.territoryId}`).toBe(unit.factionId);
      }
    });
    expect([...kinds]).toEqual(expect.arrayContaining(["battle", "income", "upkeep", "weather-rolled", "training-started", "build-queued", "replenish-applied"]));
    expect([...kinds]).not.toContain("rejected-order");
    expect([...kinds]).not.toContain("move-held-back");
  }, 60_000);
});
