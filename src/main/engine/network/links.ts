import type {
  GameState,
  LinkDefinition,
  LinkModifier,
  LinkWork,
  RailLevel,
  RoadLevel,
  Scenario,
  SubTerritoryId,
  TerritoryId
} from "../types";

/**
 * D2: links between bordering sub-territories, as combat (the pass bonus), movement and the map
 * read them. Owned by `network-engine`; everyone else calls these and never re-reads the data.
 * The functions that take a state read the links as they are now: R7's link works change a
 * link's modifiers in `GameState.builtLinks`.
 */

/** The part of the state the links are read from. */
export type LinkState = Pick<GameState, "builtLinks">;

/** The key `index.links` files a link under: its two sub-territory ids, sorted, joined by `|`. */
export function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** The link between two sub-territories, either way round; undefined when they do not border. */
export function linkBetween(scenario: Scenario, a: SubTerritoryId, b: SubTerritoryId): LinkDefinition | undefined {
  return scenario.index.links.get(linkKey(a, b));
}

/** The link's modifiers: its road, rail and pass, those it has. With a state, as built in play (R7). */
export function linkModifiers(link: LinkDefinition, state?: LinkState): readonly LinkModifier[] {
  return state?.builtLinks?.[linkKey(link.a, link.b)] ?? link.modifiers;
}

/** R6: the link crosses a mountain pass. */
export function isPass(link: LinkDefinition): boolean {
  return passName(link) !== undefined;
}

/** R6: the name of the pass the link crosses, if it does. */
export function passName(link: LinkDefinition): string | undefined {
  for (const modifier of link.modifiers) if (modifier.kind === "pass") return modifier.name;
  return undefined;
}

/** R5: the link's road now; undefined for no road. */
export function roadOn(state: LinkState, link: LinkDefinition): RoadLevel | undefined {
  for (const modifier of linkModifiers(link, state)) if (modifier.kind === "road") return modifier.level;
  return undefined;
}

/** R5: the link's railway now; undefined for none. */
export function railOn(state: LinkState, link: LinkDefinition): RailLevel | undefined {
  for (const modifier of linkModifiers(link, state)) if (modifier.kind === "rail") return modifier.level;
  return undefined;
}

/** Road levels in order, for "at least" checks: no road 0, track 1, main 2. */
export function roadRank(level: RoadLevel | undefined): number {
  return level === undefined ? 0 : level === "main" ? 2 : 1;
}

/** Rail levels in order: none 0, single 1, main 2. A station's level counts the same way (D3). */
export function railRank(level: RailLevel | undefined): number {
  return level === undefined ? 0 : level === "main" ? 2 : 1;
}

/** The scenario models links: movement reads them (R5) rather than territory connections alone. */
export function hasLinks(scenario: Scenario): boolean {
  return scenario.links.length > 0;
}

/** Every link of a sub-territory, with the sub-territory at its other end, in index order. */
export function linksOf(scenario: Scenario, subTerritoryId: SubTerritoryId): readonly { readonly link: LinkDefinition; readonly to: SubTerritoryId }[] {
  return (scenario.index.subTerritoryNeighbors.get(subTerritoryId) ?? []).flatMap((to) => {
    const link = linkBetween(scenario, subTerritoryId, to);
    return link === undefined ? [] : [{ link, to }];
  });
}

/** The territory a sub-territory lies in. */
export function territoryOfSub(scenario: Scenario, subTerritoryId: SubTerritoryId): TerritoryId | undefined {
  return scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
}

/**
 * D3, declog D12: the highest station level a sub-territory's links allow, its best rail link
 * now (single 1, main 2), within the rail improvement's `maxLevel`. Repairs never go above it.
 */
export function stationCap(scenario: Scenario, state: LinkState, subTerritoryId: SubTerritoryId): number {
  const best = Math.max(0, ...linksOf(scenario, subTerritoryId).map(({ link }) => railRank(railOn(state, link))));
  return Math.min(best, scenario.improvements?.rail.maxLevel ?? best);
}

/** R7: the link's modifiers once a work is done; undefined when the work does not fit the link. */
export function afterWork(modifiers: readonly LinkModifier[], work: LinkWork): readonly LinkModifier[] | undefined {
  const rail = modifiers.find((modifier) => modifier.kind === "rail");
  const road = modifiers.find((modifier) => modifier.kind === "road");
  const others = (kind: LinkModifier["kind"]): readonly LinkModifier[] => modifiers.filter((modifier) => modifier.kind !== kind);
  switch (work) {
    case "new-rail":
      return rail === undefined ? [...modifiers, { kind: "rail", level: "single" }] : undefined;
    case "rail-upgrade":
      return rail?.level === "single" ? [...others("rail"), { kind: "rail", level: "main" }] : undefined;
    case "road-upgrade":
      if (road?.level === "main") return undefined;
      return [...others("road"), { kind: "road", level: road === undefined ? "track" : "main" }];
  }
}

/** R7: why a work does not fit the link as it stands; undefined when it does. */
export function workMisfit(modifiers: readonly LinkModifier[], work: LinkWork): string | undefined {
  if (afterWork(modifiers, work) !== undefined) return undefined;
  switch (work) {
    case "new-rail":
      return "There is a railway here already.";
    case "rail-upgrade":
      return modifiers.some((modifier) => modifier.kind === "rail") ? "This is a main line already." : "Needs a railway first.";
    case "road-upgrade":
      return "This is a main road already.";
  }
}
