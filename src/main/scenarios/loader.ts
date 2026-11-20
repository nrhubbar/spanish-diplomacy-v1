import type { ZodError } from "zod";
import { builtInModuleRegistry, type ModuleRegistry } from "../engine/modules";
import { initialGameState } from "../engine/resolution";
import type { CityId, Scenario, TerritoryId, UnitTypeId } from "../engine/types";
import { victoryProgress } from "../engine/victory";
import { checkCore } from "./loader/coreChecks";
import { indexScenario } from "./loader/indexScenario";
import { createIssues } from "./loader/issues";
import { checkMap, indexMap } from "./loader/map";
import { checkModular } from "./loader/modularChecks";
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
  readonly terrain?: { readonly layers: readonly TerrainLayerSource[] };
  readonly territories: ReadonlyMap<TerritoryId, MapTerritory>;
  readonly unitSymbolPaths: ReadonlyMap<UnitTypeId, string>;
  readonly viewBox: MapRect;
  readonly waterLabels: readonly WaterLabel[];
}

export interface ScenarioPackage {
  readonly map: MapPackage;
  readonly scenario: Scenario;
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

/** Validates a scenario and its map (rules L1-L25 except SVG element checks) and indexes them. */
export function loadPackage(input: PackageInput): ScenarioPackage {
  const scenarioResult = scenarioSchema.safeParse(input.scenarioDocument);
  if (!scenarioResult.success) {
    throw new PackageValidationError(input.scenarioPath, formatZodIssues(scenarioResult.error));
  }
  const mapResult = mapSchema.safeParse(input.mapDocument);
  if (!mapResult.success) {
    throw new PackageValidationError(input.mapPath, formatZodIssues(mapResult.error));
  }

  const modules = input.modules ?? builtInModuleRegistry;
  const scenarioIssues = checkScenario(scenarioResult.data, modules);
  if (scenarioIssues.length > 0) {
    throw new PackageValidationError(input.scenarioPath, scenarioIssues);
  }
  const scenario = indexScenario(scenarioResult.data, modules);
  const startIssues = checkStartingPosition(scenario);
  const mapIssues = checkMap(scenarioResult.data, mapResult.data, input.assetPaths);
  if (startIssues.length + mapIssues.length > 0) {
    throw new PackageValidationError(input.scenarioPath, [...startIssues, ...mapIssues]);
  }
  return { map: indexMap(mapResult.data), scenario };
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
  if (document.ruleset === "m3-modular") {
    checkModular(document, issues, modules);
    checkSystems(document, issues);
  }
  return issues.list;
}

function checkStartingPosition(scenario: Scenario): readonly string[] {
  return victoryProgress(scenario, initialGameState(scenario)).flatMap((entry) =>
    entry.territoriesControlled >= entry.territoryThreshold || entry.citiesControlled >= entry.cityThreshold
      ? [`victory: faction "${entry.factionId}" starts at or above a victory threshold (L9)`]
      : []
  );
}
