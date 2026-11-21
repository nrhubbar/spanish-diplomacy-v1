import { type ModuleRegistry, selectModules } from "../../engine/modules";
import { m2StrengthRules } from "../../engine/types";
import type {
  AiProfile,
  CityDefinition,
  CityId,
  CombatRules,
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
import { citations, factionModifier } from "./convert";
import { emptySystems, indexSystems, indexUnitTypes, type ModularParts } from "./indexModular";


/** Indexes a validated package. Under `m2-strength` the Milestone 3 systems are empty (declog D3). */
export function indexScenario(document: ScenarioDocument, modules: ModuleRegistry): Scenario {
  const modular = document.ruleset === "m3-modular" ? document : undefined;
  const parts: ModularParts = modular === undefined ? emptySystems() : indexSystems(modular);
  const byId = <Item extends { readonly id: string }>(items: readonly Item[] | undefined) => new Map((items ?? []).map((item) => [item.id, item]));
  const modularFactions = byId(modular?.factions);
  const modularTerritories = byId(modular?.territories);
  const modularCities = byId(modular?.cities);
  const factions = document.factions.map((faction): FactionDefinition => {
    const extra = modularFactions.get(faction.id);
    return {
      abbreviation: faction.abbreviation,
      briefing: { firstTurnHint: faction.briefing.firstTurnHint, objective: faction.briefing.objective },
      color: faction.color,
      defaultActor: faction.defaultActor,
      id: faction.id as FactionId,
      motivation: faction.motivation,
      name: faction.name,
      objectiveTerritoryIds: faction.objectiveTerritoryIds as TerritoryId[],
      ...(extra?.seatTerritoryId === undefined ? {} : { seatTerritoryId: extra.seatTerritoryId as TerritoryId }),
      ...(extra?.startingStock === undefined ? {} : { startingStock: extra.startingStock })
    };
  });
  const territories = document.territories.map((territory): TerritoryDefinition => {
    const extra = modularTerritories.get(territory.id);
    return {
      countsForVictory: territory.countsForVictory,
      id: territory.id as TerritoryId,
      initialControl: territory.initialControl.kind === "controlled"
        ? { factionId: territory.initialControl.factionId as FactionId, kind: "controlled" }
        : { factionIds: territory.initialControl.factionIds as FactionId[], kind: "contested" },
      name: territory.name,
      ...(territory.isolated === undefined ? {} : { isolatedReason: territory.isolated.reason }),
      ...(extra?.capitalSubTerritoryId === undefined ? {} : { capitalSubTerritoryId: extra.capitalSubTerritoryId as SubTerritoryId }),
      ...(extra?.weatherZone === undefined ? {} : { weatherZoneId: extra.weatherZone as WeatherZoneId })
    };
  });
  const cities = document.cities.map((city): CityDefinition => {
    const extra = modularCities.get(city.id);
    return {
      countsForVictory: city.countsForVictory,
      id: city.id as CityId,
      name: city.name,
      territoryId: city.territoryId as TerritoryId,
      ...(city.initialController === undefined ? {} : { initialController: city.initialController as FactionId }),
      ...(extra?.subTerritoryId === undefined ? {} : { subTerritoryId: extra.subTerritoryId as SubTerritoryId })
    };
  });
  const units = document.units.map((unit, index): UnitDefinition => ({
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
    ...(modular?.units[index]?.generalId === undefined ? {} : { generalId: modular.units[index].generalId as GeneralId })
  }));
  const unitTypes = indexUnitTypes(document);
  const combat: CombatRules = {
    belowOneToOne: document.combat.belowOneToOne,
    demoralizationFactor: document.combat.demoralizationFactor,
    diggingIn: document.combat.diggingIn,
    factionModifiers: document.combat.factionModifiers.map(factionModifier),
    table: document.combat.table
  };
  const connections = document.connections.map((connection, index): ConnectionDefinition => {
    const entry = modular?.connections[index]?.entry;
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
    ai: { profiles: aiProfiles(document.ai.profiles) },
    cities,
    combat,
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
    modules: selectModules(modules, modular?.rules ?? m2StrengthRules),
    rules: modular?.rules ?? m2StrengthRules,
    ruleset: document.ruleset,
    snapshotLabel: document.snapshotLabel,
    sources: document.sources.map((source) => ({ id: source.id as SourceId, title: source.title, ...(source.url === undefined ? {} : { url: source.url }) })),
    territories,
    unitTypes,
    units,
    victory: document.victory
  };
}

/** E7: the profiles as the engine reads them; a profile without a Build budget leaves the key out. */
function aiProfiles(profiles: ScenarioDocument["ai"]["profiles"]): Readonly<Record<FactionId, AiProfile>> {
  return Object.fromEntries(Object.entries(profiles).map(([id, { builds, ...weights }]) => [id, builds === undefined ? weights : { ...weights, builds }]));
}
