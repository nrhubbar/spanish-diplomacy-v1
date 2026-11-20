// Builds ux-pass/provinces.json: the 1936 provinces as mock sub-territories, in the map's own
// projected kilometres, so mockups drawn into the live map SVG line up with its regions.
// Throwaway design tooling, not game code.
//
//   node project/milestones/milestone-3-ideation/ux-pass/build-provinces.ts <geoBoundaries-ESP-ADM2_simplified.geojson>
//
// Source: geoBoundaries gbOpen ESP ADM2 (CC BY 4.0), fetched separately (not vendored).
// Holders are the 31 July 1936 start (Q-PART-7, Q-PART-9) for the mock world only.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathData, type Point, poleOfInaccessibility, polygonRings, ringArea, simplifyRing } from "../../../../scripts/map/geometry.ts";
import { projection as definition } from "../../../../scripts/map/iberia-1936.ts";
import { lambertConformalConic } from "../../../../scripts/map/projection.ts";

const here = dirname(fileURLToPath(import.meta.url));
const source = process.argv[2];
if (!source) throw new Error("usage: build-provinces.ts <adm2.geojson>");
const project = lambertConformalConic(definition).forward;

type Holder = "republic" | "north" | "south";
// id: [source shapeName, territory, holder, capital?, rail level 0-3, port level 0-2]
const table: Record<string, [string, string, Holder, boolean, number, number]> = {
  "a-coruna": ["Coruna", "galicia", "north", true, 2, 2], "lugo": ["Lugo", "galicia", "north", false, 1, 0],
  "ourense": ["Ourense", "galicia", "north", false, 1, 0], "pontevedra": ["Pontevedra", "galicia", "north", false, 1, 2],
  "asturias": ["Asturias", "asturias", "republic", true, 2, 1],
  "cantabria": ["Cantabria", "cantabria", "republic", true, 2, 1],
  "bizkaia": ["Bizkaia", "pais-vasco", "republic", true, 3, 2], "gipuzkoa": ["Gipuzkoa", "pais-vasco", "republic", false, 2, 1],
  "alava": ["Alava", "pais-vasco", "north", false, 2, 0],
  "navarra": ["Navarra", "navarra", "north", true, 1, 0], "la-rioja": ["Rioja, La", "la-rioja", "north", true, 1, 0],
  "zaragoza": ["Zaragoza", "aragon", "north", true, 3, 0], "huesca": ["Huesca", "aragon", "republic", false, 1, 0],
  "teruel": ["Teruel", "aragon", "north", false, 1, 0],
  "madrid": ["Madrid", "madrid", "republic", true, 3, 0],
  "burgos": ["Burgos", "castilla-y-leon", "north", true, 2, 0], "valladolid": ["Valladolid", "castilla-y-leon", "north", false, 3, 0],
  "leon": ["Leon", "castilla-y-leon", "north", false, 2, 0], "palencia": ["Palencia", "castilla-y-leon", "north", false, 2, 0],
  "zamora": ["Zamora", "castilla-y-leon", "north", false, 1, 0], "salamanca": ["Salamanca", "castilla-y-leon", "north", false, 1, 0],
  "avila": ["Avila", "castilla-y-leon", "north", false, 2, 0], "segovia": ["Segovia", "castilla-y-leon", "north", false, 1, 0],
  "soria": ["Soria", "castilla-y-leon", "north", false, 1, 0],
  "toledo": ["Toledo", "castilla-la-mancha", "republic", true, 2, 0], "ciudad-real": ["Ciudad Real", "castilla-la-mancha", "republic", false, 2, 0],
  "cuenca": ["Cuenca", "castilla-la-mancha", "republic", false, 1, 0], "guadalajara": ["Guadalajara", "castilla-la-mancha", "republic", false, 2, 0],
  "albacete": ["Albacete", "castilla-la-mancha", "republic", false, 2, 0],
  "badajoz": ["Badajoz", "extremadura", "republic", true, 1, 0], "caceres": ["Caceres", "extremadura", "south", false, 1, 0],
  "barcelona": ["Barcelona", "catalunya", "republic", true, 3, 2], "girona": ["Girona", "catalunya", "republic", false, 2, 0],
  "lleida": ["Lleida", "catalunya", "republic", false, 2, 0], "tarragona": ["Tarragona", "catalunya", "republic", false, 2, 1],
  "valencia": ["Valencia", "valencia", "republic", true, 3, 2], "castellon": ["Castellon", "valencia", "republic", false, 2, 1],
  "alicante": ["Alicante", "valencia", "republic", false, 2, 1],
  "sevilla": ["Sevilla", "andalucia", "south", true, 3, 1], "cadiz": ["Cadiz", "andalucia", "south", false, 2, 2],
  "huelva": ["Huelva", "andalucia", "south", false, 1, 1], "cordoba": ["Cordoba", "andalucia", "south", false, 2, 0],
  "granada": ["Granada", "andalucia", "south", false, 1, 0], "malaga": ["Malaga", "andalucia", "republic", false, 1, 2],
  "jaen": ["Jaen", "andalucia", "republic", false, 2, 0], "almeria": ["Almeria", "andalucia", "republic", false, 1, 1],
  "murcia": ["Murcia", "murcia", "republic", true, 2, 2],
  "ceuta": ["Ceuta", "ceuta", "south", true, 0, 2], "melilla": ["Melilla", "melilla", "south", true, 0, 2]
};
// Baleares is one province in the source; the scenario splits it by island (Q-PART-1).
const islands: Record<string, [string, Holder, boolean, number]> = {
  "mallorca": ["Mallorca", "south", true, 1], "menorca": ["Menorca", "republic", false, 1], "ibiza": ["Ibiza and Formentera", "south", false, 1]
};

interface Feature { readonly properties: Record<string, unknown>; readonly geometry: { type: string; coordinates: unknown } }
const features = (JSON.parse(readFileSync(source, "utf8")) as { features: Feature[] }).features;
const byName = (name: string): Feature => {
  const found = features.find((f) => f.properties["shapeName"] === name);
  if (!found) throw new Error("no province " + name);
  return found;
};
const toRings = (feature: Feature, tolerance: number): Point[][] => polygonRings(feature.geometry)
  .map((ring) => simplifyRing(ring.map(([lon, lat]) => project(lon, lat)), tolerance))
  .filter((ring) => ring.length >= 3 && Math.abs(ringArea(ring)) >= 0.4);

interface Province { id: string; name: string; territory: string; holder: Holder; capital: boolean; rail: number; port: number; d: string; cx: number; cy: number; rings: Point[][]; neighbours: string[] }
const provinces: Province[] = [];
for (const [id, [name, territory, holder, capital, rail, port]] of Object.entries(table)) {
  const rings = toRings(byName(name), 0.6);
  const c = poleOfInaccessibility(rings, 1);
  provinces.push({ id, name: name.replace("Coruna", "A Coruña").replace("Rioja, La", "La Rioja").replace("Alava", "Álava").replace("Avila", "Ávila").replace("Caceres", "Cáceres").replace("Cadiz", "Cádiz").replace("Cordoba", "Córdoba").replace("Jaen", "Jaén").replace("Leon", "León").replace("Malaga", "Málaga").replace("Almeria", "Almería").replace("Castellon", "Castellón"), territory, holder, capital, rail, port, d: pathData(rings, 1), cx: c.x, cy: c.y, rings, neighbours: [] });
}
// Split Baleares by island: rank its rings by centroid x (Ibiza west, Mallorca middle, Menorca east).
{
  const rings = toRings(byName("Balears, Illes"), 0.6);
  const centre = (r: Point[]) => r.reduce((a, p) => ({ x: a.x + p.x / r.length, y: a.y + p.y / r.length }), { x: 0, y: 0 });
  const groups: Record<string, Point[][]> = { ibiza: [], mallorca: [], menorca: [] };
  for (const r of rings) { const c = centre(r); groups[c.x < 440 ? "ibiza" : c.x < 560 ? "mallorca" : "menorca"]!.push(r); }
  for (const [id, [name, holder, capital, port]] of Object.entries(islands)) {
    const g = groups[id]!; if (!g.length) throw new Error("empty island " + id);
    const c = poleOfInaccessibility(g, 0.5);
    provinces.push({ id, name, territory: "islas-baleares", holder, capital, rail: id === "mallorca" ? 1 : 0, port, d: pathData(g, 1), cx: c.x, cy: c.y, rings: g, neighbours: [] });
  }
}
// Adjacency: provinces whose borders come within 2 km of each other (sampled vertices).
for (let i = 0; i < provinces.length; i += 1) for (let j = i + 1; j < provinces.length; j += 1) {
  const a = provinces[i]!, b = provinces[j]!;
  const pa = a.rings.flat(), pb = b.rings.flat();
  let close = 0;
  outer: for (let s = 0; s < pa.length; s += 2) for (let t = 0; t < pb.length; t += 2) {
    if (Math.abs(pa[s]!.x - pb[t]!.x) < 2 && Math.abs(pa[s]!.y - pb[t]!.y) < 2) { close += 1; if (close >= 3) break outer; }
  }
  if (close >= 3) { a.neighbours.push(b.id); b.neighbours.push(a.id); }
}
const out = provinces.map(({ rings: _rings, ...p }) => ({ ...p, cx: Math.round(p.cx * 10) / 10, cy: Math.round(p.cy * 10) / 10 }));
writeFileSync(join(here, "provinces.json"), JSON.stringify(out) + "\n");
console.log(`${out.length} provinces; ${out.reduce((n, p) => n + p.neighbours.length, 0) / 2} adjacencies`);
for (const p of out) if (!p.neighbours.length && !["ceuta", "melilla", "mallorca", "menorca", "ibiza"].includes(p.id)) console.log("isolated:", p.id);
