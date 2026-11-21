// The shipped sub-territory geometry (assets/maps/iberia-sub-territories.svg plus map.json) and
// the generated topology (sub-territory-topology.json in the scenario package), as built by
// `npm run maps:build`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { containsPoint, type Point, poleOfInaccessibility, ringArea } from "../../scripts/map/geometry.ts";
import { mapDocument, projection as projectionDefinition, scenarioDocument, topologyDocument } from "../../scripts/map/iberia-1936.ts";
import { entryOverrides, seaLinks, subTerritories as subTerritoryConfig, topology as topologyOptions } from "../../scripts/map/iberia-1936-sub-territories.ts";
import { evenOddArea } from "../../scripts/map/partition.ts";
import { lambertConformalConic } from "../../scripts/map/projection.ts";
import { mapSchema } from "../main/scenarios/schema/mapSchema";

/** The agreed ids (declog D8). */
const d8 = [
  "a-coruna", "lugo", "ourense", "pontevedra", "asturias", "cantabria", "bizkaia", "gipuzkoa", "alava", "navarra", "la-rioja", "zaragoza",
  "huesca", "teruel", "madrid", "burgos", "valladolid", "leon", "palencia", "zamora", "salamanca", "avila", "segovia", "soria", "toledo",
  "ciudad-real", "cuenca", "guadalajara", "albacete", "badajoz", "caceres", "barcelona", "girona", "lleida", "tarragona", "valencia",
  "castellon", "alicante", "sevilla", "cadiz", "huelva", "cordoba", "granada", "malaga", "jaen", "almeria", "murcia", "ceuta", "melilla",
  "mallorca", "menorca", "ibiza", "oviedo", "guadarrama", "henares"
];

interface Entry { readonly territoryId: string; readonly label: Point; readonly capital: Point }
interface Topology {
  readonly subTerritories: readonly { readonly id: string; readonly territoryId: string; readonly name: string }[];
  readonly subTerritoryBorders: readonly (readonly [string, string])[];
  readonly connections: readonly { readonly between: readonly [string, string]; readonly kind: string; readonly entry: readonly [string, string] }[];
  readonly cities: Readonly<Record<string, string>>;
  readonly measurements: {
    readonly coastKm: Readonly<Record<string, number>>;
    readonly borderKm: readonly { readonly between: readonly [string, string]; readonly km: number; readonly sea?: boolean }[];
    readonly connectionKm: readonly { readonly entry: readonly [string, string]; readonly km: number; readonly rule: string; readonly reason?: string }[];
  };
}

const map = mapSchema.parse(JSON.parse(readFileSync(mapDocument, "utf8")));
const rawScenario = JSON.parse(readFileSync(scenarioDocument, "utf8")) as {
  territories: { id: string }[];
  connections: { "@type": string; "@data": { between: [string, string]; entry?: [string, string] } }[];
  cities: { id: string; territoryId: string }[];
};
/** Connections are typed entries in scenario.json (D1); the topology keeps them plain. */
const scenario = { ...rawScenario, connections: rawScenario.connections.map(({ "@type": kind, "@data": data }) => ({ ...data, kind })) };
const topology = JSON.parse(readFileSync(topologyDocument, "utf8")) as Topology;
const subTerritoryMap = map.subTerritories;
if (subTerritoryMap === undefined) throw new Error("map.json has no sub-territories");
const entries: Readonly<Record<string, Entry>> = subTerritoryMap.entries;
const svgText = (path: string): string => readFileSync(path, "utf8");
const project = lambertConformalConic(projectionDefinition).forward;

/** Rings of one closed path as the pipeline writes it: `M x y` then relative `l` steps, then `z`. */
function rings(d: string): Point[][] {
  return d.split("z").filter((text) => text.length > 0).map((text) => {
    const match = /^M([^l]+)l(.*)$/.exec(text);
    if (match === null) throw new Error(`Unexpected path data ${text.slice(0, 40)}`);
    const numbers = (value: string): number[] => (value.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) ?? []).map(Number);
    const [x, y] = numbers(match[1] ?? "");
    const steps = numbers(match[2] ?? "");
    const points = [{ x: x ?? NaN, y: y ?? NaN }];
    for (let index = 0; index + 1 < steps.length; index += 2) {
      const last = points[points.length - 1] as Point;
      points.push({ x: last.x + (steps[index] ?? NaN), y: last.y + (steps[index + 1] ?? NaN) });
    }
    return points;
  });
}

function paths(svg: string): [string, string][] {
  return [...svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)].map((match) => [match[1] ?? "", match[2] ?? ""]);
}

const subPaths = paths(svgText(subTerritoryMap.svg));
const parts = new Map(subPaths.map(([id, d]) => [id, rings(d)]));
const regionParts = new Map(paths(svgText(map.geometry.svg)).map(([id, d]) => [id, rings(d)]));
const partRings = (id: string): Point[][] => parts.get(id) ?? [];
const containing = (point: Point): string[] => [...parts].filter(([, partRingList]) => containsPoint(partRingList, point)).map(([id]) => id);

describe("sub-territory ids", () => {
  it("are exactly the agreed D8 list, everywhere", () => {
    const sorted = [...d8].sort();
    expect(Object.keys(entries).sort()).toEqual(sorted);
    expect(Object.keys(subTerritoryConfig).sort()).toEqual(sorted);
    expect(topology.subTerritories.map((entry) => entry.id).sort()).toEqual(sorted);
  });

  it("name the SVG paths, one per map entry, in the same order", () => {
    expect(subPaths.map(([id]) => id)).toEqual(Object.keys(entries));
  });

  it("belong to known territories, and every territory has at least one", () => {
    const territories = new Set(scenario.territories.map((territory) => territory.id));
    expect(new Set(Object.keys(map.territories))).toEqual(territories);
    expect(new Set(Object.values(entries).map((entry) => entry.territoryId))).toEqual(territories);
    for (const entry of topology.subTerritories) expect(entries[entry.id]?.territoryId).toBe(entry.territoryId);
  });
});

describe("sub-territory geometry", () => {
  it("is closed rings of at least three points with an area", () => {
    for (const [id, d] of subPaths) {
      expect(d.endsWith("z"), id).toBe(true);
      expect(d.split("M").length - 1, id).toBe(d.split("z").length - 1);
      for (const ring of partRings(id)) {
        expect(ring.length, id).toBeGreaterThanOrEqual(3);
        expect(Math.abs(ringArea(ring)), id).toBeGreaterThan(0);
      }
      expect(evenOddArea(partRings(id)), id).toBeGreaterThan(0);
    }
  });

  it("covers each territory's region, with parts adding up to the region's area", () => {
    for (const [regionId, { territoryId }] of Object.entries(map.regions)) {
      const regionArea = evenOddArea(regionParts.get(regionId) ?? []);
      const ids = Object.entries(entries).filter(([, entry]) => entry.territoryId === territoryId).map(([id]) => id);
      const total = ids.reduce((sum, id) => sum + evenOddArea(partRings(id)), 0);
      expect(Math.abs(total - regionArea) / regionArea, territoryId).toBeLessThan(0.002);
    }
  });

  it("puts every label and capital point inside its own sub-territory and no other", () => {
    for (const [id, entry] of Object.entries(entries)) {
      expect(containing(entry.label), `${id} label`).toEqual([id]);
      expect(containing(entry.capital), `${id} capital`).toEqual([id]);
    }
  });

  it("keeps capitals at their towns, within a kilometre", () => {
    for (const [id, entry] of Object.entries(entries)) {
      const town = subTerritoryConfig[id]?.capital;
      if (town === undefined) throw new Error(id);
      const projected = project(town.longitude, town.latitude);
      expect(Math.hypot(projected.x - entry.capital.x, projected.y - entry.capital.y), id).toBeLessThan(1);
    }
  });

  it("draws the hand splits at their historical size", () => {
    const area = (id: string): number => evenOddArea(partRings(id));
    expect(area("oviedo")).toBeGreaterThan(175);
    expect(area("oviedo")).toBeLessThan(200);
    expect(area("guadarrama")).toBeGreaterThan(2000);
    expect(area("guadarrama")).toBeLessThan(2150);
    expect(area("henares")).toBeGreaterThan(820);
    expect(area("henares")).toBeLessThan(920);
    expect(area("madrid")).toBeGreaterThan(4900);
    // The Oviedo pocket is closed inside the rest of Asturias.
    expect(topology.subTerritoryBorders.filter((pair) => pair.includes("oviedo"))).toEqual([["oviedo", "asturias"]]);
  });

  it("gives enclaves and outlying islands to the right sub-territory", () => {
    // Each probe is the pole of inaccessibility of the region ring nearest the place: the smallest
    // ring of that region whose bounds come within 2 km of it.
    const probe = (regionId: string, longitude: number, latitude: number): Point => {
      const point = project(longitude, latitude);
      const candidates = (regionParts.get(regionId) ?? []).filter((ring) => {
        const xs = ring.map((vertex) => vertex.x);
        const ys = ring.map((vertex) => vertex.y);
        return point.x >= Math.min(...xs) - 2 && point.x <= Math.max(...xs) + 2 && point.y >= Math.min(...ys) - 2 && point.y <= Math.max(...ys) + 2;
      }).sort((left, right) => Math.abs(ringArea(left)) - Math.abs(ringArea(right)));
      const ring = candidates[0];
      if (ring === undefined || Math.abs(ringArea(ring)) > 1000) throw new Error(`No small ring of ${regionId} near ${String(longitude)}, ${String(latitude)}`);
      return poleOfInaccessibility([ring], 0.05);
    };
    expect(containing(probe("ES41", -2.745, 42.735))).toEqual(["burgos"]); // Trevino, inside Alava
    expect(containing(probe("ES22", -1.093, 42.452))).toEqual(["navarra"]); // Petilla de Aragon, inside Zaragoza
    expect(containing(probe("ES52", -1.29, 40.06))).toEqual(["valencia"]); // Rincon de Ademuz
    expect(containing(probe("ES51", 1.98, 42.465))).toEqual(["girona"]); // Llivia, inside France
    expect(containing(probe("ES53", 1.45, 38.69))).toEqual(["ibiza"]); // Formentera
    expect(containing(probe("ES53", 2.94, 39.145))).toEqual(["mallorca"]); // Cabrera
    expect(containing(probe("ES53", 2.32, 39.585))).toEqual(["mallorca"]); // Dragonera
  });
});

describe("sub-territory topology", () => {
  const territoryOf = (id: string): string | undefined => entries[id]?.territoryId;
  const adjacency = new Map<string, Set<string>>();
  for (const [a, b] of topology.subTerritoryBorders) {
    adjacency.set(a, (adjacency.get(a) ?? new Set()).add(b));
    adjacency.set(b, (adjacency.get(b) ?? new Set()).add(a));
  }

  it("lists each border once between two known, different sub-territories, symmetrically", () => {
    const keys = topology.subTerritoryBorders.map((pair) => [...pair].sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
    for (const [a, b] of topology.subTerritoryBorders) {
      expect(a).not.toBe(b);
      expect(d8).toContain(a);
      expect(d8).toContain(b);
      expect(adjacency.get(b)?.has(a)).toBe(true);
    }
    expect(topology.measurements.borderKm.map((border) => border.between)).toEqual(topology.subTerritoryBorders);
    for (const border of topology.measurements.borderKm) if (border.sea !== true) expect(border.km).toBeGreaterThanOrEqual(topologyOptions.minimumBorder);
  });

  it("links the islands by sea, inside their territory only", () => {
    const sea = topology.measurements.borderKm.filter((border) => border.sea === true).map((border) => border.between);
    expect(sea).toEqual(seaLinks.map((link) => link.between));
    expect(sea).toEqual([["mallorca", "menorca"], ["mallorca", "ibiza"]]);
    for (const [a, b] of sea) expect(territoryOf(a)).toBe(territoryOf(b));
  });

  it("joins the sub-territories of every territory into one connected graph", () => {
    for (const territory of scenario.territories) {
      const ids = Object.keys(entries).filter((id) => territoryOf(id) === territory.id);
      const reached = new Set([ids[0]]);
      for (const id of reached) for (const next of adjacency.get(id ?? "") ?? []) if (territoryOf(next) === territory.id) reached.add(next);
      expect(reached.size, territory.id).toBe(ids.length);
    }
    for (const enclave of ["ceuta", "melilla"]) expect(adjacency.has(enclave), enclave).toBe(false);
  });

  it("borders across territories exactly where the scenario has land connections", () => {
    // Sea links stay inside a territory, so every crossing pair is a land border.
    const crossing = new Set(topology.subTerritoryBorders
      .filter(([a, b]) => territoryOf(a) !== territoryOf(b))
      .map(([a, b]) => [territoryOf(a), territoryOf(b)].sort().join("|")));
    const land = new Set(scenario.connections.filter((connection) => connection.kind === "land").map((connection) => [...connection.between].sort().join("|")));
    expect(crossing).toEqual(land);
  });

  it("names the entry sub-territories of every scenario connection, in between order", () => {
    // The scenario's connections, field for field, but for `entry`: a straight comparison.
    const withoutEntry = (connection: object): object => Object.fromEntries(Object.entries(connection).filter(([key]) => key !== "entry"));
    expect(topology.connections.map(withoutEntry)).toEqual(scenario.connections.map(withoutEntry));
    for (const connection of topology.connections) {
      const [a, b] = connection.entry;
      expect(territoryOf(a), connection.between.join("-")).toBe(connection.between[0]);
      expect(territoryOf(b), connection.between.join("-")).toBe(connection.between[1]);
      if (connection.kind === "land") expect(adjacency.get(a)?.has(b), connection.between.join("-")).toBe(true);
      else for (const port of connection.entry) expect(topology.measurements.coastKm[port], port).toBeGreaterThanOrEqual(topologyOptions.minimumCoast);
    }
  });

  it("uses every entry override, and the derived rule elsewhere", () => {
    const overridden = topology.measurements.connectionKm.filter((measure) => measure.rule === "override");
    expect(overridden).toHaveLength(entryOverrides.length);
    for (const measure of overridden) expect(measure.reason?.length ?? 0).toBeGreaterThan(0);
    const entry = (a: string, b: string): readonly string[] | undefined =>
      topology.connections.find((connection) => [...connection.between].sort().join("|") === [a, b].sort().join("|"))?.entry;
    expect(entry("castilla-la-mancha", "extremadura")).toEqual(["toledo", "caceres"]);
    expect(entry("extremadura", "andalucia")).toEqual(["badajoz", "sevilla"]);
    expect(entry("andalucia", "melilla")).toEqual(["malaga", "melilla"]);
    expect(entry("valencia", "islas-baleares")).toEqual(["valencia", "mallorca"]);
    expect(entry("andalucia", "ceuta")).toEqual(["cadiz", "ceuta"]);
    expect(entry("catalunya", "islas-baleares")).toEqual(["barcelona", "mallorca"]);
    for (const measure of topology.measurements.connectionKm.filter((candidate) => candidate.rule !== "override")) expect(["longest-border", "closest-coasts"]).toContain(measure.rule);
  });

  it("puts every city in a sub-territory of its own territory", () => {
    expect(Object.keys(topology.cities).sort()).toEqual(scenario.cities.map((city) => city.id).sort());
    for (const city of scenario.cities) expect(territoryOf(topology.cities[city.id] ?? ""), city.id).toBe(city.territoryId);
    expect(topology.cities["oviedo"]).toBe("oviedo");
    expect(topology.cities["gijon"]).toBe("asturias");
  });

  it("finds coast only where there is sea", () => {
    for (const inland of ["madrid", "guadarrama", "henares", "oviedo", "leon", "zaragoza", "jaen", "cordoba"]) expect(topology.measurements.coastKm[inland], inland).toBe(0);
    for (const coastal of ["a-coruna", "asturias", "barcelona", "valencia", "cadiz", "malaga", "mallorca", "ceuta", "melilla"]) expect(topology.measurements.coastKm[coastal], coastal).toBeGreaterThan(5);
  });
});
