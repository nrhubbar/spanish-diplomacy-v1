declare const brand: unique symbol;

/**
 * Nominal string identifiers. Only the scenario loader mints these from validated data,
 * so engine code can trust that every id refers to an existing record.
 */
export type Brand<Value, Name extends string> = Value & { readonly [brand]: Name };

export type ScenarioId = Brand<string, "ScenarioId">;
export type FactionId = Brand<string, "FactionId">;
export type TerritoryId = Brand<string, "TerritoryId">;
export type CityId = Brand<string, "CityId">;
export type UnitId = Brand<string, "UnitId">;
export type UnitTypeId = Brand<string, "UnitTypeId">;
export type SourceId = Brand<string, "SourceId">;
export type SubTerritoryId = Brand<string, "SubTerritoryId">;
export type ResourceId = Brand<string, "ResourceId">;
export type DevelopmentId = Brand<string, "DevelopmentId">;
export type BuildingId = Brand<string, "BuildingId">;
export type GradeId = Brand<string, "GradeId">;
export type WeatherId = Brand<string, "WeatherId">;
export type WeatherZoneId = Brand<string, "WeatherZoneId">;
export type SeasonId = Brand<string, "SeasonId">;
export type GeneralId = Brand<string, "GeneralId">;
export type TraitId = Brand<string, "TraitId">;
export type AiProfileId = Brand<string, "AiProfileId">;
