import type {
  BuildingId,
  CityId,
  DevelopmentId,
  FactionId,
  ResourceId,
  SubTerritoryId,
  TerritoryId
} from "../ids";
import type { BuildingEffect } from "./effects";
import type { TerrainKind } from "./rules";
import type { SourceCitation } from "./scenario";

/** $1: an amount of each resource, keyed by resource id. Missing ids are zero. */
export type Resources = Readonly<Record<ResourceId, number>>;

export interface ResourceDefinition {
  readonly id: ResourceId;
  readonly name: string;
}

/** $3: one development track (Farms, Mines, Industry), levels 0 to `maxLevel`. */
export interface DevelopmentDefinition {
  /** Industry may be developed only in a sub-territory with a city. */
  readonly cityOnly: boolean;
  readonly id: DevelopmentId;
  readonly maxLevel: number;
  readonly name: string;
  /** The resource each level yields per turn. */
  readonly resource: ResourceId;
  /** Price and build time of one level, queued like a building ($5). */
  readonly upgrade: BuildCost;
  readonly yieldPerLevel: number;
}

export interface BuildCost {
  readonly cost: Resources;
  readonly turns: number;
}

/** $4: a building a sub-territory may hold. Buildings are captured intact ($5). */
export interface BuildingDefinition extends BuildCost {
  /** Only a territory's capital sub-territory may build it. */
  readonly capitalOnly: boolean;
  /** Only a sub-territory with a city may build it. */
  readonly cityOnly: boolean;
  readonly effects: readonly BuildingEffect[];
  readonly id: BuildingId;
  readonly name: string;
  /** An upgrade (the paved airfield) needs this building first. */
  readonly upgradeOf?: BuildingId;
}

/** $4: the levelled improvements every sub-territory has. Rail 0-3, port 0-2. */
export interface ImprovementRules {
  readonly port: BuildCost & { readonly maxLevel: number };
  readonly rail: BuildCost & { readonly maxLevel: number };
  /** $8: levels lost by rail in attacker-held sub-territories when a territory becomes contested. */
  readonly railDamageOnContest: number;
}

/** Where a sub-territory's numbers come from (every number has a source or a design note). */
export interface DataBasis {
  readonly note?: string;
  readonly sources: readonly SourceCitation[];
}

/** W2: a province, or a scenario override. Units never stand in one. */
export interface SubTerritoryDefinition {
  readonly basis: DataBasis;
  readonly buildings: readonly BuildingId[];
  readonly cityIds: readonly CityId[];
  readonly development: Readonly<Record<DevelopmentId, number>>;
  readonly id: SubTerritoryId;
  readonly name: string;
  readonly port: number;
  readonly rail: number;
  /** P1: the holder on the scenario's start date, whatever the territory's controller. */
  readonly startHolder: FactionId;
  readonly terrain: TerrainKind;
  readonly territoryId: TerritoryId;
}

/** R2, R5, D7: the numbers of the Recruit and Replenish orders. */
export interface RecruitmentRules {
  /** Recruit orders a territory may take per turn, before building bonuses. */
  readonly maxPerTerritory: number;
  /** Replenish price per value point, as a share of the Recruit price per point. */
  readonly replenishCostShare: number;
  /** Most men a Replenish order restores per turn, as a share of establishment. */
  readonly replenishShare: number;
}

/** M1-M5, D7: the numbers of the movement module. */
export interface MovementRules {
  /** M5: armies a friendly port lands per turn, per port level. */
  readonly landingsPerPortLevel: number;
  /** M3: rail range in territories, per level of the lowest rail on the route. */
  readonly railRangePerLevel: number;
}
