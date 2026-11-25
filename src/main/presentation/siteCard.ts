import { allProjects, buildableId, buildRefusal, isCapital } from "../engine/economy/catalogue";
import { subTerritoryYield } from "../engine/economy/income";
import { requireBuilding } from "../engine/lookup";
import { isContested } from "../engine/partition/holders";
import type { BuildingDefinition, BuildOrder, BuildProject, CityId, DevelopmentDefinition, FactionId, GameState, Scenario, SubTerritoryDefinition, SubTerritoryId, TerrainKind } from "../engine/types";
import { isRevealed } from "../engine/visibility";
import { projectName, projectTerms, signedAmountText } from "./economy";
import { glyphs } from "./glyphs";
import { buildEntries, type QueueEntry } from "./queues";
import { refusalText } from "./refusals";
import { factionName } from "./text";

/** U9 (note 15), X3, X7: one sub-territory in the Buildings tab: its card, and the projects to add. */

const terrainNames: Readonly<Record<TerrainKind, string>> = { mountain: "Mountains", open: "Open ground", swamp: "Marsh" };

interface SiteLevel {
  readonly level: number;
  readonly max: number;
}

export interface SiteCardView {
  readonly buildings: readonly BuildingDefinition[];
  readonly capital: boolean;
  readonly cities: readonly string[];
  readonly contested: boolean;
  readonly entries: readonly QueueEntry[];
  /** "Held by ..." for another faction's. */
  readonly holder?: string | undefined;
  readonly name: string;
  readonly own: boolean;
  /** Set once the sub-territory has, or may build, a port. */
  readonly port?: SiteLevel | undefined;
  readonly portLevel: number;
  /** $6, U4: what stands for another faction's queue that shows nothing. */
  readonly queueNote?: string | undefined;
  readonly rail?: SiteLevel | undefined;
  readonly railLevel: number;
  /** The closed card's line: the queue's head. */
  readonly summary?: { readonly name: string; readonly status: string } | undefined;
  readonly terrain: { readonly kind: TerrainKind; readonly name: string };
  readonly tracks: readonly (SiteLevel & { readonly track: DevelopmentDefinition })[];
  readonly yieldText: string;
}

/** The card of one sub-territory as the viewer sees it; undefined when the board has none by that id. */
export function siteCard(
  scenario: Scenario,
  state: GameState,
  subTerritoryId: SubTerritoryId,
  viewer: FactionId,
  planned: readonly { readonly index: number; readonly order: BuildOrder }[]
): SiteCardView | undefined {
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  const site = state.subTerritories[subTerritoryId];
  if (sub === undefined || site === undefined) return undefined;
  const own = site.holder === viewer;
  const contested = isContested(scenario, state, sub.territoryId);
  const entries = buildEntries(scenario, site, planned, contested);
  const head = entries[0];
  const improvements = scenario.improvements;
  const amount = signedAmountText(scenario, subTerritoryYield(scenario, site));
  return {
    buildings: site.buildings.map((id) => requireBuilding(scenario, id)),
    capital: isCapital(scenario, sub),
    cities: sub.cityIds.map((id) => cityName(scenario, id)),
    contested,
    entries,
    holder: own ? undefined : `Held by ${factionName(scenario, site.holder)}`,
    name: sub.name,
    own,
    port: improvements === undefined || (site.port === 0 && sub.port === 0) ? undefined : { level: site.port, max: improvements.port.maxLevel },
    portLevel: site.port,
    // U4: the viewer's recon shows this territory's queues, so an empty one reads empty.
    queueNote: own || entries.length > 0 ? undefined : isRevealed(state, viewer, sub.territoryId) ? "Queue empty (recon)" : "Queue hidden",
    rail: improvements === undefined ? undefined : { level: site.rail, max: improvements.rail.maxLevel },
    railLevel: site.rail,
    summary: head === undefined ? undefined : { name: head.name, status: `${head.status}${entries.length > 1 ? ` ${glyphs.dot} +${String(entries.length - 1)} queued` : ""}` },
    terrain: { kind: sub.terrain, name: terrainNames[sub.terrain] },
    tracks: scenario.development
      .filter((track) => !track.cityOnly || sub.cityIds.length > 0)
      .map((track) => ({ level: site.development[track.id] ?? 0, max: track.maxLevel, track })),
    yieldText: amount === "nothing" ? "no yield" : amount
  };
}

function cityName(scenario: Scenario, id: CityId): string {
  const city = scenario.index.cities.get(id);
  if (city === undefined) throw new Error(`Unknown city "${id}".`);
  return city.name;
}

export interface BuildOption {
  readonly name: string;
  readonly order: BuildOrder;
  readonly project: BuildProject;
  /** Why it cannot be queued. */
  readonly refusal?: string | undefined;
  readonly terms: string;
}

/** X3: the projects the viewer may add to a sub-territory's queue, the ones that can be queued first; undefined when it isn't the viewer's. */
export function buildOptions(scenario: Scenario, state: GameState, subTerritoryId: SubTerritoryId, viewer: FactionId): readonly BuildOption[] | undefined {
  const site = state.subTerritories[subTerritoryId];
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  if (site === undefined || sub === undefined || site.holder !== viewer) return undefined;
  const options = allProjects(scenario).filter((project) => possibleHere(scenario, sub, project)).map((project): BuildOption => {
    const order: BuildOrder = { factionId: viewer, kind: "build", project, subTerritoryId };
    const refusal = buildRefusal(scenario, state, order);
    return { name: projectName(scenario, site, project), order, project, refusal: refusal === undefined ? undefined : refusalText(scenario, refusal), terms: projectTerms(scenario, project) };
  });
  return options.sort((a, b) => Number(a.refusal !== undefined) - Number(b.refusal !== undefined));
}

/** Projects this sub-territory can never take (a capital-only building elsewhere, a city-only one without a city) are left out. */
function possibleHere(scenario: Scenario, sub: SubTerritoryDefinition, project: BuildProject): boolean {
  const hasCity = sub.cityIds.length > 0;
  const id = buildableId(project);
  if (id === undefined || !sub.buildable.includes(id)) return false;
  switch (project.kind) {
    case "building": {
      const building = requireBuilding(scenario, project.buildingId);
      return (!building.capitalOnly || isCapital(scenario, sub)) && (!building.cityOnly || hasCity);
    }
    case "development":
      return hasCity || scenario.index.development.get(project.developmentId)?.cityOnly !== true;
    default:
      // Improvements: the list decides. Link works never get here (they have no `buildable` id).
      return true;
  }
}
