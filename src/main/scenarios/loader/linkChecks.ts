import type { ModularScenarioDocument } from "../schema/scenarioSchema";
import { duplicates, idSet, type Issues } from "./issues";

type SubTerritoryDocument = ModularScenarioDocument["subTerritories"][number];

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * L28 (D2, D3): links. Each joins two known, bordering sub-territories, once; every border has
 * one; each has sources or a note; its modifiers are each listed once and defined in
 * `linkModifiers`, which defines each kind once.
 */
export function checkLinks(document: ModularScenarioDocument, issues: Issues): void {
  const subTerritories = idSet(document.subTerritories);
  const sources = idSet(document.sources);
  const borders = new Set(document.subTerritoryBorders.map(([a, b]) => pairKey(a, b)));
  const defined = new Set(document.linkModifiers.map((entry) => entry.kind));
  for (const kind of duplicates(document.linkModifiers.map((entry) => entry.kind))) issues.add(`linkModifiers: "${kind}" is defined twice (L28)`);

  const linked = new Set<string>();
  document.links.forEach((link, index) => {
    const path = `links[${index}]`;
    issues.ref(`${path}.a`, link.a, subTerritories, "sub-territory");
    issues.ref(`${path}.b`, link.b, subTerritories, "sub-territory");
    issues.cited(path, link, sources);
    const key = pairKey(link.a, link.b);
    if (linked.has(key)) issues.add(`${path}: duplicate link ${link.a} - ${link.b} (L28)`);
    else if (!borders.has(key)) issues.add(`${path}: ${link.a} - ${link.b} is not a sub-territory border (L28)`);
    linked.add(key);
    if (link.sources.length === 0 && link.note === undefined) issues.add(`${path}: ${link.a} - ${link.b} needs sources or a note (L28)`);
    const kinds = link.modifiers.map((modifier) => modifier.kind);
    for (const kind of duplicates(kinds)) issues.add(`${path}.modifiers: "${kind}" is listed twice (L28)`);
    for (const kind of new Set(kinds)) if (!defined.has(kind)) issues.add(`${path}.modifiers: "${kind}" has no entry in linkModifiers (L28)`);
  });
  document.subTerritoryBorders.forEach(([a, b], index) => {
    if (!linked.has(pairKey(a, b))) issues.add(`subTerritoryBorders[${index}]: ${a} - ${b} has no link (L28)`);
  });
}

/**
 * L29 (D4): a sub-territory's `buildable` list names known buildings, development tracks and
 * improvements, once each, and only what the catalogue allows there (capital only, city only).
 */
export function checkBuildable(
  document: ModularScenarioDocument,
  sub: SubTerritoryDocument,
  path: string,
  site: { readonly capital: boolean; readonly city: boolean },
  issues: Issues
): void {
  const buildings = new Map(document.buildings.map((building) => [building.id, building]));
  const tracks = new Map(document.development.map((track) => [track.id, track]));
  const improvements = document.improvements === undefined ? [] : ["rail", "port"];
  for (const id of duplicates(sub.buildable)) issues.add(`${path}.buildable: "${id}" is listed twice (L29)`);
  for (const id of sub.buildable) {
    const building = buildings.get(id);
    const track = tracks.get(id);
    if (building === undefined && track === undefined && !improvements.includes(id)) issues.add(`${path}.buildable: unknown building, development track or improvement "${id}" (L29)`);
    if (building?.capitalOnly === true && !site.capital) issues.add(`${path}.buildable: "${id}" is built only in a capital (L29)`);
    if ((building?.cityOnly === true || track?.cityOnly === true) && !site.city) issues.add(`${path}.buildable: "${id}" needs a city (L29)`);
  }
}
