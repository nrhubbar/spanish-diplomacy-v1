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
