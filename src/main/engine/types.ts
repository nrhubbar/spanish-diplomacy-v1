/**
 * The engine's types (spec version 2), split by area under `types/`. Import from here so the
 * split stays an implementation detail.
 */
export type {
  AiProfileId,
  BuildingId,
  CityId,
  DevelopmentId,
  FactionId,
  GeneralId,
  GradeId,
  ResourceId,
  ScenarioId,
  SeasonId,
  SourceId,
  SubTerritoryId,
  TerritoryId,
  TraitId,
  UnitId,
  UnitTypeId,
  WeatherId,
  WeatherZoneId
} from "./ids";
export * from "./types/economy";
export * from "./types/effects";
export * from "./types/orders";
export * from "./types/outcomes";
export * from "./types/package";
export * from "./types/rules";
export * from "./types/scenario";
export * from "./types/state";
export * from "./types/systems";
