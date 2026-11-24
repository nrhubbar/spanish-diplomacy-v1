import type { ScenarioDocument } from "./schema/scenarioSchema";

/**
 * What an authored scenario must say about where its numbers come from, beyond what the game needs
 * to load it: the tests and the build ask for it, the loader does not. The shipped copy leaves the
 * citations out (`withoutCitations`), since no screen reads them.
 */

interface Basis {
  readonly note?: string | undefined;
  readonly sources: readonly unknown[];
}

const unfounded = ({ note, sources }: Basis): boolean => sources.length === 0 && note === undefined;

/** Units and generals without a source, and sub-territories (L18) and links (L28) with neither sources nor a note. */
export function citationProblems(document: ScenarioDocument): readonly string[] {
  return [
    ...document.units.filter((unit) => unit.sources.length === 0).map((unit) => `units: "${unit.id}" needs a source`),
    ...(document.generals?.roster ?? []).filter((general) => general.sources.length === 0).map((general) => `generals.roster: "${general.id}" needs a source`),
    ...document.subTerritories.filter(unfounded).map((sub) => `subTerritories: "${sub.id}" needs sources or a note (L18)`),
    ...document.links.filter(unfounded).map((link) => `links: ${link.a} - ${link.b} needs sources or a note (L28)`)
  ];
}

const citationKeys = new Set(["historicalNote", "note", "sources"]);

/** The same JSON with every citation and note left out. */
export function withoutCitations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutCitations);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !citationKeys.has(key)).map(([key, entry]) => [key, withoutCitations(entry)]));
}
