import type { ZodError } from "zod";
import { initialGameState } from "../engine/resolution";
import type {
  CityDefinition,
  CityId,
  CombatRules,
  FactionDefinition,
  FactionId,
  Neighbor,
  Scenario,
  ScenarioId,
  SourceId,
  TerritoryDefinition,
  TerritoryId,
  UnitDefinition,
  UnitId,
  UnitTypeDefinition,
  UnitTypeId
} from "../engine/types";
import { victoryProgress } from "../engine/victory";
import { type MapDocument, mapSchema } from "./schema/mapSchema";
import { type ScenarioDocument, scenarioSchema } from "./schema/scenarioSchema";
import { checkWater, indexWater, type MapRiver, type WaterLabel } from "./water";

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
  readonly scenarioDocument: unknown;
  readonly scenarioPath: string;
}

/** Validates a scenario and its map (rules L1-L13 except SVG element checks) and indexes them. */
export function loadPackage(input: PackageInput): ScenarioPackage {
  const scenarioResult = scenarioSchema.safeParse(input.scenarioDocument);
  if (!scenarioResult.success) {
    throw new PackageValidationError(input.scenarioPath, formatZodIssues(scenarioResult.error));
  }
  const mapResult = mapSchema.safeParse(input.mapDocument);
  if (!mapResult.success) {
    throw new PackageValidationError(input.mapPath, formatZodIssues(mapResult.error));
  }

  const scenarioIssues = checkScenario(scenarioResult.data);
  if (scenarioIssues.length > 0) {
    throw new PackageValidationError(input.scenarioPath, scenarioIssues);
  }
  const scenario = indexScenario(scenarioResult.data);
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

function duplicates(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

function checkScenario(document: ScenarioDocument): readonly string[] {
  const issues: string[] = [];
  const collections = {
    cities: document.cities,
    "combat.factionModifiers": document.combat.factionModifiers,
    factions: document.factions,
    sources: document.sources,
    territories: document.territories,
    unitTypes: document.unitTypes,
    units: document.units
  };
  for (const [name, items] of Object.entries(collections)) {
    for (const id of duplicates(items.map((item) => item.id))) {
      issues.push(`${name}: duplicate id "${id}" (L2)`);
    }
  }

  const factions = new Set(document.factions.map((faction) => faction.id));
  const territories = new Set(document.territories.map((territory) => territory.id));
  const cities = new Map(document.cities.map((city) => [city.id, city]));
  const unitTypes = new Set(document.unitTypes.map((type) => type.id));
  const sources = new Set(document.sources.map((source) => source.id));
  const ref = (path: string, id: string, known: ReadonlySet<string> | ReadonlyMap<string, unknown>, kind: string): void => {
    if (!known.has(id)) issues.push(`${path}: unknown ${kind} "${id}" (L3)`);
  };

  document.factions.forEach((faction, index) => {
    faction.objectiveTerritoryIds.forEach((id) => { ref(`factions[${index}].objectiveTerritoryIds`, id, territories, "territory"); });
  });
  document.territories.forEach((territory, index) => {
    const control = territory.initialControl;
    if (control.kind === "controlled") {
      ref(`territories[${index}].initialControl.factionId`, control.factionId, factions, "faction");
    } else {
      control.factionIds.forEach((id) => { ref(`territories[${index}].initialControl.factionIds`, id, factions, "faction"); });
      if (new Set(control.factionIds).size !== control.factionIds.length) {
        issues.push(`territories[${index}].initialControl: contested factions must be distinct (L5)`);
      }
    }
  });
  document.cities.forEach((city, index) => {
    ref(`cities[${index}].territoryId`, city.territoryId, territories, "territory");
    if (city.initialController !== undefined) {
      ref(`cities[${index}].initialController`, city.initialController, factions, "faction");
    }
  });
  document.units.forEach((unit, index) => {
    const path = `units[${index}]`;
    ref(`${path}.factionId`, unit.factionId, factions, "faction");
    ref(`${path}.territoryId`, unit.territoryId, territories, "territory");
    ref(`${path}.type`, unit.type, unitTypes, "unit type");
    if (unit.strength > unit.fullStrength) {
      issues.push(`${path}.strength: ${String(unit.strength)} men exceeds fullStrength ${String(unit.fullStrength)} (L12)`);
    }
    unit.sources.forEach((source) => { ref(`${path}.sources`, source.sourceId, sources, "source"); });
    if (unit.cityId !== undefined) {
      const city = cities.get(unit.cityId);
      if (city === undefined) {
        issues.push(`${path}.cityId: unknown city "${unit.cityId}" (L3)`);
      } else if (city.territoryId !== unit.territoryId) {
        issues.push(`${path}.cityId: city "${unit.cityId}" is not in territory "${unit.territoryId}" (L4)`);
      }
    }
  });

  document.combat.factionModifiers.forEach((modifier, index) => {
    const path = `combat.factionModifiers[${index}]`;
    ref(`${path}.factionId`, modifier.factionId, factions, "faction");
    if ((modifier.attack ?? 0) === 0 && (modifier.defence ?? 0) === 0) {
      issues.push(`${path}: "${modifier.id}" changes nothing; give it an attack or defence bonus (L13)`);
    }
  });

  const edges = new Set<string>();
  const degree = new Map<string, number>();
  document.connections.forEach((connection, index) => {
    const [a, b] = connection.between;
    ref(`connections[${index}].between`, a, territories, "territory");
    ref(`connections[${index}].between`, b, territories, "territory");
    if (a === b) issues.push(`connections[${index}]: a territory cannot connect to itself (L6)`);
    const key = [a, b].sort().join("|");
    if (edges.has(key)) issues.push(`connections[${index}]: duplicate connection ${a} - ${b} (L6)`);
    edges.add(key);
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  });
  document.territories.forEach((territory, index) => {
    const connected = (degree.get(territory.id) ?? 0) > 0;
    if (!connected && territory.isolated === undefined) {
      issues.push(`territories[${index}]: "${territory.id}" has no connections; add one or declare "isolated" (L7)`);
    }
    if (connected && territory.isolated !== undefined) {
      issues.push(`territories[${index}]: "${territory.id}" is declared isolated but has connections (L7)`);
    }
  });

  for (const faction of document.factions) {
    const hasUnit = document.units.some((unit) => unit.factionId === faction.id);
    const hasTerritory = document.territories.some(
      (territory) => territory.initialControl.kind === "controlled" && territory.initialControl.factionId === faction.id
    );
    if (!hasUnit && !hasTerritory) issues.push(`factions: "${faction.id}" starts with no units and no territory (L8)`);
  }
  return issues;
}

function checkStartingPosition(scenario: Scenario): readonly string[] {
  return victoryProgress(scenario, initialGameState(scenario)).flatMap((entry) =>
    entry.territoriesControlled >= entry.territoryThreshold || entry.citiesControlled >= entry.cityThreshold
      ? [`victory: faction "${entry.factionId}" starts at or above a victory threshold (L9)`]
      : []
  );
}

function checkMap(document: ScenarioDocument, map: MapDocument, assetPaths: ReadonlySet<string>): readonly string[] {
  const issues: string[] = [];
  const territories = new Set(document.territories.map((territory) => territory.id));
  const boundTerritories = new Set(Object.values(map.regions).map((region) => region.territoryId));
  const inside = (point: MapPoint): boolean =>
    point.x >= map.viewBox.x && point.x <= map.viewBox.x + map.viewBox.width
    && point.y >= map.viewBox.y && point.y <= map.viewBox.y + map.viewBox.height;

  for (const [regionId, region] of Object.entries(map.regions)) {
    if (!territories.has(region.territoryId)) issues.push(`map.regions.${regionId}: unknown territory "${region.territoryId}" (L10)`);
  }
  for (const territory of document.territories) {
    const entry = map.territories[territory.id];
    if (entry === undefined) {
      issues.push(`map.territories: missing "${territory.id}" (L10)`);
      continue;
    }
    if (!boundTerritories.has(territory.id) && entry.shape === undefined) {
      issues.push(`map.territories.${territory.id}: needs a bound SVG region or a shape (L10)`);
    }
    if (!inside(entry.unitAnchor)) issues.push(`map.territories.${territory.id}.unitAnchor: outside the view box (L10)`);
  }
  for (const id of Object.keys(map.territories)) {
    if (!territories.has(id)) issues.push(`map.territories.${id}: unknown territory (L10)`);
  }
  const cityIds = new Set(document.cities.map((city) => city.id));
  for (const city of document.cities) {
    const position = map.cities[city.id];
    if (position === undefined) issues.push(`map.cities: missing "${city.id}" (L10)`);
    else if (!inside(position)) issues.push(`map.cities.${city.id}: outside the view box (L10)`);
  }
  for (const id of Object.keys(map.cities)) {
    if (!cityIds.has(id)) issues.push(`map.cities.${id}: unknown city (L10)`);
  }
  for (const type of document.unitTypes) {
    if (map.unitSymbols[type.id] === undefined) issues.push(`map.unitSymbols: missing "${type.id}" (L10)`);
  }

  const assets = [
    map.geometry.svg,
    ...Object.values(map.unitSymbols),
    ...(map.terrain?.layers.map((layer) => layer.image) ?? [])
  ];
  for (const asset of assets) {
    if (!assetPaths.has(asset)) issues.push(`map: asset "${asset}" not found (L11)`);
  }
  issues.push(...checkWater(map));
  return issues;
}

function indexScenario(document: ScenarioDocument): Scenario {
  const factions: FactionDefinition[] = document.factions.map((faction) => ({
    abbreviation: faction.abbreviation,
    briefing: { firstTurnHint: faction.briefing.firstTurnHint, objective: faction.briefing.objective },
    color: faction.color,
    defaultActor: faction.defaultActor,
    id: faction.id as FactionId,
    motivation: faction.motivation,
    name: faction.name,
    objectiveTerritoryIds: faction.objectiveTerritoryIds as TerritoryId[]
  }));
  const territories: TerritoryDefinition[] = document.territories.map((territory) => ({
    countsForVictory: territory.countsForVictory,
    id: territory.id as TerritoryId,
    initialControl: territory.initialControl.kind === "controlled"
      ? { factionId: territory.initialControl.factionId as FactionId, kind: "controlled" }
      : { factionIds: territory.initialControl.factionIds as FactionId[], kind: "contested" },
    name: territory.name,
    ...(territory.isolated === undefined ? {} : { isolatedReason: territory.isolated.reason })
  }));
  const cities: CityDefinition[] = document.cities.map((city) => ({
    countsForVictory: city.countsForVictory,
    id: city.id as CityId,
    name: city.name,
    territoryId: city.territoryId as TerritoryId,
    ...(city.initialController === undefined ? {} : { initialController: city.initialController as FactionId })
  }));
  const units: UnitDefinition[] = document.units.map((unit) => ({
    factionId: unit.factionId as FactionId,
    formationKind: unit.formationKind,
    fullStrength: unit.fullStrength,
    id: unit.id as UnitId,
    name: unit.name,
    sources: unit.sources.map((source) => ({
      sourceId: source.sourceId as SourceId,
      ...(source.reference === undefined ? {} : { reference: source.reference })
    })),
    strength: unit.strength,
    territoryId: unit.territoryId as TerritoryId,
    type: unit.type as UnitTypeId,
    ...(unit.cityId === undefined ? {} : { cityId: unit.cityId as CityId }),
    ...(unit.historicalNote === undefined ? {} : { historicalNote: unit.historicalNote }),
    ...(unit.designation === undefined ? {} : { designation: unit.designation })
  }));
  const unitTypes: UnitTypeDefinition[] = document.unitTypes.map((type) => ({
    attack: type.attack,
    defence: type.defence,
    id: type.id as UnitTypeId,
    name: type.name
  }));
  const combat: CombatRules = {
    belowOneToOne: document.combat.belowOneToOne,
    demoralizationFactor: document.combat.demoralizationFactor,
    diggingIn: document.combat.diggingIn,
    factionModifiers: document.combat.factionModifiers.map((modifier) => ({
      attack: modifier.attack ?? 0,
      defence: modifier.defence ?? 0,
      factionId: modifier.factionId as FactionId,
      id: modifier.id,
      name: modifier.name,
      when: modifier.when
    })),
    table: document.combat.table
  };
  const connections = document.connections.map((connection) => ({
    between: connection.between as [TerritoryId, TerritoryId],
    kind: connection.kind,
    ...(connection.label === undefined ? {} : { label: connection.label })
  }));

  const neighbors = new Map<TerritoryId, Neighbor[]>(territories.map((territory) => [territory.id, []]));
  for (const connection of connections) {
    const [a, b] = connection.between;
    neighbors.get(a)?.push({ kind: connection.kind, territoryId: b });
    neighbors.get(b)?.push({ kind: connection.kind, territoryId: a });
  }
  const citiesByTerritory = new Map<TerritoryId, CityDefinition[]>();
  for (const city of cities) {
    citiesByTerritory.set(city.territoryId, [...(citiesByTerritory.get(city.territoryId) ?? []), city]);
  }

  return {
    cities,
    combat,
    connections,
    factions,
    id: document.id as ScenarioId,
    index: {
      cities: new Map(cities.map((city) => [city.id, city])),
      citiesByTerritory,
      factions: new Map(factions.map((faction) => [faction.id, faction])),
      neighbors,
      territories: new Map(territories.map((territory) => [territory.id, territory])),
      unitTypes: new Map(unitTypes.map((type) => [type.id, type])),
      units: new Map(units.map((unit) => [unit.id, unit]))
    },
    name: document.name,
    ruleset: document.ruleset,
    snapshotLabel: document.snapshotLabel,
    sources: document.sources.map((source) => ({
      id: source.id as SourceId,
      title: source.title,
      ...(source.url === undefined ? {} : { url: source.url })
    })),
    territories,
    unitTypes,
    units,
    victory: document.victory
  };
}

function indexMap(document: MapDocument): MapPackage {
  return {
    attribution: document.attribution.map((entry) => ({ text: entry.text, ...(entry.url === undefined ? {} : { url: entry.url }) })),
    background: document.background,
    cities: new Map(Object.entries(document.cities).map(([id, city]) => [id as CityId, city])),
    contextLabels: document.contextLabels,
    focus: document.focus,
    geometryPath: document.geometry.svg,
    id: document.id,
    regions: new Map(Object.entries(document.regions).map(([regionId, region]) => [regionId, region.territoryId as TerritoryId])),
    stripSelectors: document.geometry.stripSelectors,
    ...(document.terrain === undefined
      ? {}
      : {
          terrain: { layers: document.terrain.layers.map((layer) => ({ bounds: layer.bounds, imagePath: layer.image })) }
        }),
    territories: new Map(Object.entries(document.territories).map(([id, territory]) => [
      id as TerritoryId,
      {
        label: territory.label,
        unitAnchor: territory.unitAnchor,
        ...(territory.shape === undefined ? {} : { shape: territory.shape })
      }
    ])),
    unitSymbolPaths: new Map(Object.entries(document.unitSymbols).map(([id, path]) => [id as UnitTypeId, path])),
    viewBox: document.viewBox,
    ...indexWater(document)
  };
}
