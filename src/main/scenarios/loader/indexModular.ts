import type {
  BuildingDefinition,
  BuildingId,
  CityId,
  DevelopmentDefinition,
  DevelopmentId,
  FactionId,
  GeneralDefinition,
  GeneralId,
  GradeId,
  ResourceId,
  Resources,
  Scenario,
  ScenarioIndex,
  SeasonId,
  SubTerritoryDefinition,
  SubTerritoryId,
  TerritoryId,
  TraitId,
  UnitTypeDefinition,
  UnitTypeId,
  WeatherId,
  WeatherRules,
  WeatherZoneId
} from "../../engine/types";
import type { ModularScenarioDocument, ScenarioDocument } from "../schema/scenarioSchema";
import { citations, factionModifier } from "./convert";

type SystemFields =
  | "air" | "buildings" | "calendar" | "d20" | "development" | "generalTraits" | "generals" | "improvements"
  | "movement" | "recruitment" | "resources" | "subTerritories" | "subTerritoryBorders" | "weather";
type SystemIndex = "buildings" | "development" | "generals" | "generalsByFaction" | "subTerritories" | "subTerritoriesByTerritory" | "subTerritoryNeighbors";

export interface ModularParts {
  readonly index: Pick<ScenarioIndex, SystemIndex>;
  readonly scenario: Pick<Scenario, SystemFields>;
}

const resources = (record: Readonly<Record<string, number>>): Resources => record;

/** The systems of an `m2-strength` package: none. */
export function emptySystems(): ModularParts {
  return indexSystems(undefined);
}

export function indexSystems(document: ModularScenarioDocument | undefined): ModularParts {
  const subTerritories = (document?.subTerritories ?? []).map((sub): SubTerritoryDefinition => ({
    basis: { sources: citations(sub.sources), ...(sub.note === undefined ? {} : { note: sub.note }) },
    buildings: sub.buildings as BuildingId[],
    cityIds: (document?.cities ?? []).filter((city) => city.subTerritoryId === sub.id).map((city) => city.id as CityId),
    development: sub.development as Record<DevelopmentId, number>,
    id: sub.id as SubTerritoryId,
    name: sub.name,
    port: sub.port,
    rail: sub.rail,
    startHolder: sub.startHolder as FactionId,
    terrain: sub.terrain,
    territoryId: sub.territoryId as TerritoryId
  }));
  const borders = (document?.subTerritoryBorders ?? []).map(([a, b]) => [a as SubTerritoryId, b as SubTerritoryId] as const);
  const development = (document?.development ?? []).map((track): DevelopmentDefinition => ({
    ...track,
    id: track.id as DevelopmentId,
    resource: track.resource as ResourceId,
    upgrade: { cost: resources(track.upgrade.cost), turns: track.upgrade.turns }
  }));
  const buildings = (document?.buildings ?? []).map((building): BuildingDefinition => ({
    capitalOnly: building.capitalOnly,
    cityOnly: building.cityOnly,
    cost: resources(building.cost),
    effects: building.effects,
    id: building.id as BuildingId,
    name: building.name,
    turns: building.turns,
    ...(building.upgradeOf === undefined ? {} : { upgradeOf: building.upgradeOf as BuildingId })
  }));
  const generals = (document?.generals?.roster ?? []).map((general): GeneralDefinition => ({
    factionId: general.factionId as FactionId,
    id: general.id as GeneralId,
    name: general.name,
    sources: citations(general.sources),
    traitId: general.trait as TraitId
  }));

  const neighbors = new Map<SubTerritoryId, SubTerritoryId[]>(subTerritories.map((sub) => [sub.id, []]));
  for (const [a, b] of borders) {
    neighbors.get(a)?.push(b);
    neighbors.get(b)?.push(a);
  }
  const group = <Item, Key>(items: readonly Item[], key: (item: Item) => Key): Map<Key, Item[]> => {
    const groups = new Map<Key, Item[]>();
    for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
    return groups;
  };

  return {
    index: {
      buildings: new Map(buildings.map((building) => [building.id, building])),
      development: new Map(development.map((track) => [track.id, track])),
      generals: new Map(generals.map((general) => [general.id, general])),
      generalsByFaction: group(generals, (general) => general.factionId),
      subTerritories: new Map(subTerritories.map((sub) => [sub.id, sub])),
      subTerritoriesByTerritory: group(subTerritories, (sub) => sub.territoryId),
      subTerritoryNeighbors: neighbors
    },
    scenario: {
      buildings,
      development,
      generalTraits: (document?.generals?.traits ?? []).map((trait) => ({ ...trait, id: trait.id as TraitId })),
      generals,
      resources: (document?.resources ?? []).map((resource) => ({
        ...(resource.display === undefined ? {} : { display: resource.display }),
        id: resource.id as ResourceId,
        name: resource.name
      })),
      subTerritories,
      subTerritoryBorders: borders,
      ...optionalBlocks(document)
    }
  };
}

function optionalBlocks(document: ModularScenarioDocument | undefined): Partial<Pick<Scenario, SystemFields>> {
  if (document === undefined) return {};
  const { air, calendar, d20, improvements, movement, recruitment, weather } = document;
  return {
    ...(air === undefined ? {} : { air }),
    ...(calendar === undefined ? {} : { calendar }),
    ...(d20 === undefined
      ? {}
      : {
          d20: {
            ...d20,
            factionModifiers: d20.factionModifiers.map(factionModifier),
            grades: d20.grades.map((grade) => ({ ...grade, id: grade.id as GradeId })),
            table: d20.table as GradeId[][]
          }
        }),
    ...(improvements === undefined
      ? {}
      : {
          improvements: {
            port: { ...improvements.port, cost: resources(improvements.port.cost) },
            rail: { ...improvements.rail, cost: resources(improvements.rail.cost) },
            railDamageOnContest: improvements.railDamageOnContest
          }
        }),
    ...(movement === undefined ? {} : { movement }),
    ...(recruitment === undefined ? {} : { recruitment }),
    ...(weather === undefined ? {} : { weather: indexWeather(weather) })
  };
}

function indexWeather(weather: NonNullable<ModularScenarioDocument["weather"]>): WeatherRules {
  return {
    outcomes: weather.outcomes.map((outcome) => ({
      attackRoll: outcome.attackRoll,
      effects: outcome.effects,
      id: outcome.id as WeatherId,
      name: outcome.name
    })),
    seasons: weather.seasons.map((season) => ({ ...season, id: season.id as SeasonId })),
    zones: weather.zones.map((zone) => ({
      coastal: zone.coastal,
      id: zone.id as WeatherZoneId,
      name: zone.name,
      tables: Object.fromEntries(Object.entries(zone.tables).map(([season, bands]) => [
        season,
        bands.map((band) => ({ outcome: band.outcome as WeatherId, upTo: band.upTo }))
      ])) as WeatherRules["zones"][number]["tables"]
    }))
  };
}

/** W5: `m2-strength` types are ground units that may only move, with no effects. */
export function indexUnitTypes(document: ScenarioDocument): UnitTypeDefinition[] {
  if (document.ruleset === "m2-strength") {
    return document.unitTypes.map((type) => ({ ...type, effects: [], id: type.id as UnitTypeId, kind: "ground", orders: ["move"] }));
  }
  return document.unitTypes.map((type): UnitTypeDefinition => ({
    attack: type.attack,
    defence: type.defence,
    effects: type.effects.map((effect) => (effect.kind === "roll-bonus-per-points" ? { ...effect, exceptWeather: effect.exceptWeather as WeatherId[] } : effect)),
    id: type.id as UnitTypeId,
    kind: type.kind,
    name: type.name,
    orders: type.orders,
    symbol: type.symbol,
    ...(type.air === undefined ? {} : { air: type.air }),
    ...(type.recruit === undefined
      ? {}
      : {
          recruit: {
            cost: resources(type.recruit.cost),
            establishment: type.recruit.establishment,
            requires: type.recruit.requires as BuildingId[],
            trainingTurns: type.recruit.trainingTurns,
            ...(type.recruit.factionIds === undefined ? {} : { factionIds: type.recruit.factionIds as FactionId[] })
          }
        })
  }));
}
