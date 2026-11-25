import type { ZodError } from "zod";
import { builtInModuleRegistry, type ModuleRegistry } from "../engine/modules";
import { initialGameState } from "../engine/resolution";
import type { CityId, Scenario, SubTerritoryId, TerritoryId, UnitTypeId } from "../engine/types";
import { victoryProgress } from "../engine/victory";
import { checkCore } from "./loader/coreChecks";
import { indexScenario } from "./loader/indexScenario";
import { createIssues } from "./loader/issues";
import { checkMap, indexMap } from "./loader/map";
import { checkModular } from "./loader/modularChecks";
import { checkPersonas } from "./loader/personas";
import { checkSystems } from "./loader/systemChecks";
import { mapSchema } from "./schema/mapSchema";
import { type ScenarioDocument, scenarioSchema } from "./schema/scenarioSchema";
import type { MapRiver, WaterLabel } from "./water";

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface MapRect extends MapPoint {
  readonly height: number;
  readonly width: number;
}

export type LabelTier = "overview" | "detail";

export interface MapTerritory {
  readonly label: MapPoint & { readonly tier: LabelTier };
  readonly shape?: MapPoint & { readonly kind: "circle"; readonly r: number };
  readonly unitAnchor: MapPoint;
}

/** X2: where a sub-territory's name and capital star are drawn; its path is in the lazy `svgPath`. */
export interface MapSubTerritory {
  readonly capital: MapPoint;
  readonly label: MapPoint;
  readonly territoryId: TerritoryId;
}

/** One relief image and the view box rectangle it covers. */
export interface TerrainLayerSource {
  readonly bounds: MapRect;
  readonly imagePath: string;
}

/** A validated map package. Asset paths are resolved lazily by the registry. */
export interface MapPackage {
  readonly attribution: readonly { readonly text: string; readonly url?: string }[];
  readonly background: string;
  readonly cities: ReadonlyMap<CityId, MapPoint & { readonly tier: LabelTier }>;
  readonly contextLabels: readonly (MapPoint & { readonly text: string })[];
  readonly focus: MapRect;
  readonly geometryPath: string;
  readonly id: string;
  readonly regions: ReadonlyMap<string, TerritoryId>;
  readonly rivers: readonly MapRiver[];
  readonly stripSelectors: readonly string[];
  /** X2: the sub-territory geometry (one path per id, read even-odd) and its label and capital points. */
  readonly subTerritories?: { readonly entries: ReadonlyMap<SubTerritoryId, MapSubTerritory>; readonly svgPath: string };
  readonly terrain?: { readonly layers: readonly TerrainLayerSource[] };
  readonly territories: ReadonlyMap<TerritoryId, MapTerritory>;
  readonly unitSymbolPaths: ReadonlyMap<UnitTypeId, string>;
  readonly viewBox: MapRect;
  readonly waterLabels: readonly WaterLabel[];
}

export interface ScenarioPackage {
  readonly map: MapPackage;
  readonly scenario: Scenario;
  /** A fingerprint of the scenario data, so a saved game knows the data it was made with. */
  readonly version: string;
}

export class PackageValidationError extends Error {
  readonly issues: readonly string[];

  constructor(packagePath: string, issues: readonly string[]) {
    super(`Invalid package ${packagePath}:\n- ${issues.join("\n- ")}`);
    this.name = "PackageValidationError";
    this.issues = issues;
  }
}

export interface PackageInput {
  readonly assetPaths: ReadonlySet<string>;
  readonly mapDocument: unknown;
  readonly mapPath: string;
  /** The rule modules known to this package: the built-in ones plus its plugin's (E3). */
  readonly modules?: ModuleRegistry;
  readonly scenarioDocument: unknown;
  readonly scenarioPath: string;
}

export type RulesInput = Pick<PackageInput, "modules" | "scenarioDocument" | "scenarioPath">;

function readRules({ modules = builtInModuleRegistry, scenarioDocument, scenarioPath }: RulesInput): { readonly document: ScenarioDocument; readonly scenario: Scenario; readonly version: string } {
  const parsed = scenarioSchema.safeParse(scenarioDocument);
  if (!parsed.success) throw new PackageValidationError(scenarioPath, formatZodIssues(parsed.error));
  const issues = checkScenario(parsed.data, modules);
  if (issues.length > 0) throw new PackageValidationError(scenarioPath, issues);
  const scenario = indexScenario(parsed.data, modules);
  return { document: parsed.data, scenario, version: fingerprint(JSON.stringify(scenarioDocument)) };
}

/** A scenario's rules alone, for whoever resolves turns and draws nothing: no map, no art, no bundler. */
export function loadRules(input: RulesInput): Pick<ScenarioPackage, "scenario" | "version"> {
  const { scenario, version } = readRules(input);
  const issues = checkStartingPosition(scenario);
  if (issues.length > 0) throw new PackageValidationError(input.scenarioPath, issues);
  return { scenario, version };
}

/** Validates a scenario and its map (rules L1-L25 except SVG element checks) and indexes them. */
export function loadPackage(input: PackageInput): ScenarioPackage {
  const map = mapSchema.safeParse(input.mapDocument);
  const { document, scenario, version } = readRules(input);
  if (!map.success) throw new PackageValidationError(input.mapPath, formatZodIssues(map.error));
  const issues = [...checkStartingPosition(scenario), ...checkMap(document, map.data, input.assetPaths)];
  if (issues.length > 0) throw new PackageValidationError(input.scenarioPath, issues);
  return { map: indexMap(map.data), scenario, version };
}

/** FNV-1a over two lanes: tells one version of a document from another; not a secret. */
function fingerprint(text: string): string {
  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    low = Math.imul(low ^ code, 0x01000193) >>> 0;
    high = Math.imul(high ^ (code + index), 0x01000193) >>> 0;
  }
  return [low, high].map((lane) => lane.toString(16).padStart(8, "0")).join("");
}

/** L10 (geometry part): every bound region must exist as an element in the SVG. */
export function checkGeometry(map: MapPackage, svgSource: string): readonly string[] {
  return [...map.regions.keys()].flatMap((regionId) =>
    svgSource.includes(`id="${regionId}"`) ? [] : [`map.regions.${regionId}: element not found in ${map.geometryPath}`]
  );
}

function formatZodIssues(error: ZodError): readonly string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

function checkScenario(document: ScenarioDocument, modules: ModuleRegistry): readonly string[] {
  const issues = createIssues();
  checkCore(document, issues);
  checkModular(document, issues, modules);
  checkPersonas(document, issues);
  checkSystems(document, issues);
  return issues.list;
}

function checkStartingPosition(scenario: Scenario): readonly string[] {
  return victoryProgress(scenario, initialGameState(scenario)).flatMap((entry) =>
    entry.territoriesControlled >= entry.territoryThreshold || entry.citiesControlled >= entry.cityThreshold
      ? [`victory: faction "${entry.factionId}" starts at or above a victory threshold (L9)`]
      : []
  );
}
