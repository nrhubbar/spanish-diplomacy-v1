// Builds sub-territory geometry for a map package: each territory's region rings cut into parts by
// province borders or hand-drawn lines (`partition.ts`), with a label point and a capital point per
// part. Package-agnostic; the iberia-1936 inputs are in `iberia-1936-sub-territories.ts`.
import { containsPoint, distanceToEdges, type Point, poleOfInaccessibility, type Ring, ringArea } from "./geometry.ts";
import { evenOddArea, type LabelSpec, partitionRegion, type PartitionOptions } from "./partition.ts";

export interface SubTerritoryInput {
  readonly territoryId: string;
  /** Polygon rings (map units) of the source province, for territories split along province borders. */
  readonly province?: readonly Ring[];
  /** Capital point in map units; also the seed of a hand-drawn split. */
  readonly capital: Point;
}

export interface BuiltSubTerritory {
  readonly id: string;
  readonly territoryId: string;
  readonly rings: Point[][];
  readonly label: Point;
  readonly capital: Point;
  /** Area in square map units. */
  readonly area: number;
}

export interface SubTerritoryBuild {
  /** Region rings of every territory, as drawn for the territory (the region SVG paths or the enclave land). */
  readonly territoryRings: ReadonlyMap<string, readonly Ring[]>;
  /** Sub-territories by id, in output order. */
  readonly subTerritories: Readonly<Record<string, SubTerritoryInput>>;
  /** Territories cut by hand-drawn lines (map units), instead of province borders. */
  readonly handSplits: Readonly<Record<string, { readonly lines: readonly (readonly Point[])[] }>>;
  readonly options: PartitionOptions;
  /** Largest relative difference allowed between a province part's area and its source province's. */
  readonly provinceAreaTolerance: number;
  /** Capital points closer than this to their part's edge (or outside it) move inward. */
  readonly capitalInset: number;
}

/**
 * A capital point that lies well inside its part: the given point when it does, else the nearest
 * point that does, searched on rings 0.1 map units apart (a coastal town on a spit the simplified
 * coast leaves out, for example). Falls back to the label point.
 */
function insetCapital(rings: readonly Ring[], capital: Point, label: Point, inset: number): Point {
  const fits = (point: Point): boolean => containsPoint(rings, point) && distanceToEdges(rings, point) >= inset;
  for (let radius = 0; radius <= 20; radius = Math.round((radius + 0.1) * 10) / 10) {
    const count = Math.max(1, Math.ceil(2 * Math.PI * radius / 0.1));
    for (let step = 0; step < count; step += 1) {
      const angle = 2 * Math.PI * step / count;
      const point = { x: capital.x + radius * Math.cos(angle), y: capital.y + radius * Math.sin(angle) };
      if (fits(point)) return point;
    }
  }
  return label;
}

export function buildSubTerritories(build: SubTerritoryBuild): BuiltSubTerritory[] {
  const byTerritory = new Map<string, string[]>();
  for (const [id, entry] of Object.entries(build.subTerritories)) byTerritory.set(entry.territoryId, [...(byTerritory.get(entry.territoryId) ?? []), id]);
  // Partition parts are traced faces (positive) and holes (negative), so their signed areas add up.
  const parts = new Map<string, { readonly rings: Point[][]; readonly area: number }>();
  const signedArea = (rings: readonly Ring[]): number => rings.reduce((total, ring) => total + ringArea(ring), 0);
  for (const [territoryId, ids] of byTerritory) {
    const rings = build.territoryRings.get(territoryId);
    if (rings === undefined) throw new Error(`Sub-territories name territory ${territoryId}, which has no region rings.`);
    if (ids.length === 1) {
      parts.set(ids[0] as string, { area: evenOddArea(rings), rings: rings.map((ring) => [...ring]) });
      continue;
    }
    const entries = ids.map((id) => ({ id, ...(build.subTerritories[id] as SubTerritoryInput) }));
    const hand = build.handSplits[territoryId];
    let spec: LabelSpec;
    if (hand !== undefined) {
      spec = { kind: "lines", lines: hand.lines, seeds: entries.map((entry) => ({ id: entry.id, point: entry.capital })) };
    } else {
      const sources = entries.map((entry) => {
        if (entry.province === undefined) throw new Error(`Sub-territory ${entry.id} has neither a province nor a hand-drawn split.`);
        return { id: entry.id, rings: entry.province };
      });
      spec = { kind: "polygons", sources };
    }
    const built = partitionRegion(rings, spec, build.options);
    for (const id of ids) {
      const part = built.find((candidate) => candidate.id === id);
      if (part === undefined) throw new Error(`Territory ${territoryId} has no part for sub-territory ${id}.`);
      parts.set(id, { area: signedArea(part.rings), rings: part.rings });
    }
  }

  const problems: string[] = [];
  const result = Object.entries(build.subTerritories).map(([id, entry]): BuiltSubTerritory => {
    const { area, rings } = parts.get(id) as { rings: Point[][]; area: number };
    if (entry.province !== undefined) {
      const expected = evenOddArea(entry.province);
      const difference = Math.abs(area - expected) / expected;
      if (difference > build.provinceAreaTolerance) problems.push(`${id} covers ${area.toFixed(0)} against its province's ${expected.toFixed(0)} (${(difference * 100).toFixed(1)}%)`);
    }
    const ordered = [...rings].sort((left, right) => Math.abs(ringArea(right)) - Math.abs(ringArea(left)));
    const label = poleOfInaccessibility(ordered, 0.25);
    const capital = insetCapital(rings, entry.capital, label, build.capitalInset);
    return { area, capital, id, label, rings, territoryId: entry.territoryId };
  });
  if (problems.length > 0) throw new Error(`Sub-territory areas disagree with their provinces: ${problems.join("; ")}.`);
  return result;
}
