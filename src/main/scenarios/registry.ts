import { createModuleRegistry, type ModuleRegistry, type ScenarioPlugin } from "../engine/modules";
import type { ScenarioId, UnitTypeId } from "../engine/types";
import { checkGeometry, loadPackage, type MapRect, PackageValidationError, type ScenarioPackage } from "./loader";

/**
 * Raw package sources, keyed by repository-relative path. In the app these come from
 * `import.meta.glob`; tests pass plain objects.
 */
export interface PackageSources {
  readonly maps: Readonly<Record<string, unknown>>;
  /** Each scenario folder's optional `plugin.ts` export `plugin` (E3), keyed by its path. */
  readonly plugins?: Readonly<Record<string, ScenarioPlugin>>;
  readonly rawAssets: Readonly<Record<string, () => Promise<string>>>;
  readonly scenarios: Readonly<Record<string, unknown>>;
  readonly urlAssets: Readonly<Record<string, () => Promise<string>>>;
}

/** A relief image resolved to a loadable URL. */
export interface TerrainLayerAsset {
  readonly bounds: MapRect;
  readonly url: string;
}

export interface MapAssets {
  readonly geometrySvg: string;
  readonly terrain?: { readonly layers: readonly TerrainLayerAsset[] };
  readonly unitSymbols: ReadonlyMap<UnitTypeId, string>;
}

export interface ScenarioSummary {
  readonly id: ScenarioId;
  readonly name: string;
  readonly snapshotLabel: string;
}

export interface ScenarioRegistry {
  /** Packages that failed validation, with their issues. Empty in a healthy build. */
  readonly problems: readonly PackageValidationError[];
  list(): readonly ScenarioSummary[];
  loadAssets(id: ScenarioId): Promise<MapAssets>;
  peekAssets(id: ScenarioId): MapAssets | undefined;
  require(id: ScenarioId): ScenarioPackage;
}

export function normalizeSourcePath(path: string): string {
  return path.replace(/^\/+/, "");
}

function normalizeKeys<Value>(record: Readonly<Record<string, Value>>): Map<string, Value> {
  return new Map(Object.entries(record).map(([path, value]) => [normalizeSourcePath(path), value]));
}

function resolveRelative(fromFile: string, relative: string): string {
  const parts = fromFile.split("/").slice(0, -1);
  for (const segment of relative.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return parts.join("/");
}

function mapReference(document: unknown): string | undefined {
  if (typeof document !== "object" || document === null || !("map" in document)) return undefined;
  const { map } = document;
  return typeof map === "string" ? map : undefined;
}

/** The modules a package may select: the built-in ones plus its plugin's. A clash is a package problem. */
function packageModules(scenarioPath: string, plugin: ScenarioPlugin | undefined): ModuleRegistry {
  try {
    return createModuleRegistry(plugin === undefined ? [] : [plugin]);
  } catch (error) {
    throw new PackageValidationError(scenarioPath, [`plugin: ${error instanceof Error ? error.message : String(error)}`]);
  }
}

export function createScenarioRegistry(...sourceSets: readonly PackageSources[]): ScenarioRegistry {
  const maps = new Map<string, unknown>();
  const rawAssets = new Map<string, () => Promise<string>>();
  const urlAssets = new Map<string, () => Promise<string>>();
  const scenarioDocuments: [string, unknown][] = [];
  const plugins = new Map<string, ScenarioPlugin>();
  for (const sources of sourceSets) {
    for (const [path, value] of normalizeKeys(sources.maps)) maps.set(path, value);
    for (const [path, value] of normalizeKeys(sources.rawAssets)) rawAssets.set(path, value);
    for (const [path, value] of normalizeKeys(sources.urlAssets)) urlAssets.set(path, value);
    for (const [path, value] of normalizeKeys(sources.plugins ?? {})) plugins.set(path, value);
    scenarioDocuments.push(...normalizeKeys(sources.scenarios));
  }
  const assetPaths = new Set([...rawAssets.keys(), ...urlAssets.keys()]);

  const packages = new Map<ScenarioId, ScenarioPackage>();
  const problems: PackageValidationError[] = [];
  for (const [scenarioPath, scenarioDocument] of scenarioDocuments) {
    const reference = mapReference(scenarioDocument);
    const mapPath = reference === undefined ? "(missing map)" : resolveRelative(scenarioPath, reference);
    try {
      const modules = packageModules(scenarioPath, plugins.get(resolveRelative(scenarioPath, "plugin.ts")));
      const loaded = loadPackage({ assetPaths, mapDocument: maps.get(mapPath), mapPath, modules, scenarioDocument, scenarioPath });
      if (packages.has(loaded.scenario.id)) {
        throw new PackageValidationError(scenarioPath, [`duplicate scenario id "${loaded.scenario.id}"`]);
      }
      packages.set(loaded.scenario.id, loaded);
    } catch (error) {
      if (!(error instanceof PackageValidationError)) throw error;
      problems.push(error);
    }
  }

  const assetCache = new Map<ScenarioId, Promise<MapAssets>>();
  const loadedAssets = new Map<ScenarioId, MapAssets>();

  const loadRaw = (path: string): Promise<string> => {
    const loader = rawAssets.get(path);
    return loader === undefined ? Promise.reject(new Error(`Missing asset ${path}`)) : loader();
  };
  const loadUrl = (path: string): Promise<string> => {
    const loader = urlAssets.get(path);
    return loader === undefined ? Promise.reject(new Error(`Missing asset ${path}`)) : loader();
  };

  const registry: ScenarioRegistry = {
    problems,
    list: () => [...packages.values()].map(({ scenario }) => ({
      id: scenario.id,
      name: scenario.name,
      snapshotLabel: scenario.snapshotLabel
    })),
    require: (id) => {
      const loaded = packages.get(id);
      if (loaded === undefined) throw new Error(`Unknown scenario "${id}".`);
      return loaded;
    },
    peekAssets: (id) => loadedAssets.get(id),
    loadAssets: (id) => {
      const cached = assetCache.get(id);
      if (cached !== undefined) return cached;
      const { map } = registry.require(id);
      const pending = (async (): Promise<MapAssets> => {
        const geometrySvg = await loadRaw(map.geometryPath);
        const geometryIssues = checkGeometry(map, geometrySvg);
        if (geometryIssues.length > 0) throw new PackageValidationError(map.geometryPath, geometryIssues);
        const symbols = await Promise.all(
          [...map.unitSymbolPaths].map(async ([typeId, path]) => [typeId, await loadRaw(path)] as const)
        );
        const terrain = map.terrain === undefined
          ? undefined
          : {
              layers: await Promise.all(map.terrain.layers.map(async (layer) => ({ bounds: layer.bounds, url: await loadUrl(layer.imagePath) })))
            };
        const assets: MapAssets = {
          geometrySvg,
          unitSymbols: new Map(symbols),
          ...(terrain === undefined ? {} : { terrain })
        };
        loadedAssets.set(id, assets);
        return assets;
      })();
      pending.catch(() => assetCache.delete(id));
      assetCache.set(id, pending);
      return pending;
    }
  };
  return registry;
}
