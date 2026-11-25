import { type ModuleRegistry, selectModules } from "../../engine/modules";
import type {
  AiProfile,
  AiRules,
  CityDefinition,
  CityId,
  ConnectionDefinition,
  FactionDefinition,
  FactionId,
  GeneralId,
  Neighbor,
  Scenario,
  ScenarioId,
  SourceId,
  SubTerritoryId,
  TerritoryDefinition,
  TerritoryId,
  UnitDefinition,
  UnitId,
  UnitTypeId,
  WeatherZoneId
} from "../../engine/types";
import type { ScenarioDocument } from "../schema/scenarioSchema";
import { citations } from "./convert";
import { indexSystems, indexUnitTypes } from "./indexModular";
import { seatProfile } from "./personas";

/** Indexes a validated package. */
export function indexScenario(document: ScenarioDocument, modules: ModuleRegistry): Scenario {
  const parts = indexSystems(document);
  const factions = document.factions.map((faction): FactionDefinition => ({
    abbreviation: faction.abbreviation,
    briefing: { firstTurnHint: faction.briefing.firstTurnHint, objective: faction.briefing.objective },
    color: faction.color,
    defaultActor: faction.defaultActor,
    id: faction.id as FactionId,
    motivation: faction.motivation,
    name: faction.name,
    objectiveTerritoryIds: faction.objectiveTerritoryIds as TerritoryId[],
    ...(faction.seatTerritoryId === undefined ? {} : { seatTerritoryId: faction.seatTerritoryId as TerritoryId }),
    ...(faction.startingStock === undefined ? {} : { startingStock: faction.startingStock })
  }));
  const territories = document.territories.map((territory): TerritoryDefinition => ({
    countsForVictory: territory.countsForVictory,
    id: territory.id as TerritoryId,
    initialControl: territory.initialControl.kind === "controlled"
      ? { factionId: territory.initialControl.factionId as FactionId, kind: "controlled" }
      : { factionIds: territory.initialControl.factionIds as FactionId[], kind: "contested" },
    name: territory.name,
    ...(territory.isolated === undefined ? {} : { isolatedReason: territory.isolated.reason }),
    ...(territory.capitalSubTerritoryId === undefined ? {} : { capitalSubTerritoryId: territory.capitalSubTerritoryId as SubTerritoryId }),
    ...(territory.weatherZone === undefined ? {} : { weatherZoneId: territory.weatherZone as WeatherZoneId })
  }));
  const cities = document.cities.map((city): CityDefinition => ({
    countsForVictory: city.countsForVictory,
    id: city.id as CityId,
    name: city.name,
    territoryId: city.territoryId as TerritoryId,
    ...(city.initialController === undefined ? {} : { initialController: city.initialController as FactionId }),
    ...(city.subTerritoryId === undefined ? {} : { subTerritoryId: city.subTerritoryId as SubTerritoryId })
  }));
  const units = document.units.map((unit): UnitDefinition => ({
    factionId: unit.factionId as FactionId,
    formationKind: unit.formationKind,
    fullStrength: unit.fullStrength,
    id: unit.id as UnitId,
    name: unit.name,
    sources: citations(unit.sources),
    strength: unit.strength,
    territoryId: unit.territoryId as TerritoryId,
    type: unit.type as UnitTypeId,
    ...(unit.cityId === undefined ? {} : { cityId: unit.cityId as CityId }),
    ...(unit.historicalNote === undefined ? {} : { historicalNote: unit.historicalNote }),
    ...(unit.designation === undefined ? {} : { designation: unit.designation }),
    ...(unit.generalId === undefined ? {} : { generalId: unit.generalId as GeneralId })
  }));
  const unitTypes = indexUnitTypes(document);
  const connections = document.connections.map((connection): ConnectionDefinition => {
    const { entry } = connection;
    return {
      between: connection.between as [TerritoryId, TerritoryId],
      kind: connection.kind,
      ...(connection.label === undefined ? {} : { label: connection.label }),
      ...(entry === undefined ? {} : { entry: entry as [SubTerritoryId, SubTerritoryId] })
    };
  });

  const neighbors = new Map<TerritoryId, Neighbor[]>(territories.map((territory) => [territory.id, []]));
  for (const connection of connections) {
    const [a, b] = connection.between;
    neighbors.get(a)?.push({ kind: connection.kind, territoryId: b });
    neighbors.get(b)?.push({ kind: connection.kind, territoryId: a });
  }
  const citiesByTerritory = new Map<TerritoryId, CityDefinition[]>();
  for (const city of cities) citiesByTerritory.set(city.territoryId, [...(citiesByTerritory.get(city.territoryId) ?? []), city]);

  return {
    ...parts.scenario,
    ai: aiRules(document.ai),
    cities,
    combat: document.combat,
    connections,
    factions,
    id: document.id as ScenarioId,
    index: {
      ...parts.index,
      cities: new Map(cities.map((city) => [city.id, city])),
      citiesByTerritory,
      factions: new Map(factions.map((faction) => [faction.id, faction])),
      neighbors,
      territories: new Map(territories.map((territory) => [territory.id, territory])),
      unitTypes: new Map(unitTypes.map((type) => [type.id, type])),
      units: new Map(units.map((unit) => [unit.id, unit]))
    },
    name: document.name,
    modules: selectModules(modules, document.rules),
    rules: document.rules,
    ruleset: document.ruleset,
    snapshotLabel: document.snapshotLabel,
    sources: document.sources.map((source) => ({ id: source.id as SourceId, title: source.title, ...(source.url === undefined ? {} : { url: source.url }) })),
    territories,
    unitTypes,
    units,
    victory: document.victory
  };
}

/** E7: the profiles as the engine reads them, each seat's persona merged in; a profile without a Build budget leaves the key out. */
function aiRules(ai: ScenarioDocument["ai"]): AiRules {
  const profiles = Object.fromEntries(Object.keys(ai.profiles).map((id) => {
    const { builds, ...weights } = seatProfile(ai, id) as AiProfile;
    return [id, builds === undefined ? weights : { ...weights, builds }];
  }));
  return { profiles, ...(Object.keys(ai.seats ?? {}).length === 0 ? {} : { seats: ai.seats as Readonly<Record<FactionId, string>> }) };
}
