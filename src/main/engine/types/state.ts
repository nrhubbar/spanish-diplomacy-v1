import type {
  BuildingId,
  CityId,
  DevelopmentId,
  FactionId,
  GeneralId,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitTypeId,
  WeatherId,
  WeatherZoneId
} from "../ids";
import type { Resources } from "./economy";
import type { TerritoryControl, UnitDefinition } from "./scenario";

/** C6: a demoralized army fights at reduced values and recovers after a turn of rest (O4). */
export interface Morale {
  readonly demoralized: boolean;
  /** Complete turns of rest since the army was last demoralized. Zero while not demoralized. */
  readonly quietTurns: number;
}

/** One unit: its own men, morale, fatigue and position (C4, W4). */
export interface UnitState {
  readonly cityId?: CityId;
  readonly factionId: FactionId;
  /** C6: the fatigue track, 0 up to the scenario's demoralizing level. Always 0 under `m2-strength`. */
  readonly fatigue: number;
  readonly id: UnitId;
  readonly morale: Morale;
  /** Men now. Starts at the definition's `strength`; only Replenish raises it (R5). */
  readonly strength: number;
  readonly territoryId: TerritoryId;
}

/** C7: works a territory holds for the faction that holds it. */
export interface Fortification {
  readonly factionId: FactionId;
  /** Defence roll bonus, from 1 up to the scenario's digging-in cap. */
  readonly level: number;
}

/** $5: what a build queue item makes. */
export type BuildProject =
  | { readonly buildingId: BuildingId; readonly kind: "building" }
  | { readonly developmentId: DevelopmentId; readonly kind: "development" }
  | { readonly improvement: "port" | "rail"; readonly kind: "improvement" };

/** $5: one queued item, paid in full when queued. Only the first item of a queue progresses. */
export interface QueueItem {
  /** Who paid; a refund for an unstarted item goes back to them. */
  readonly factionId: FactionId;
  readonly paid: Resources;
  readonly project: BuildProject;
  /** Turns of progress so far; the item finishes when it reaches the project's turns. */
  readonly progress: number;
}

/** W2, $3-$5, M3: a sub-territory in play. */
export interface SubTerritoryState {
  readonly buildings: readonly BuildingId[];
  readonly development: Readonly<Record<DevelopmentId, number>>;
  readonly holder: FactionId;
  readonly port: number;
  readonly queue: readonly QueueItem[];
  readonly rail: number;
}

/** R4, R7, C8: a unit in training. It appears as `unitId` when its turns run out. */
export interface TrainingItem {
  readonly factionId: FactionId;
  readonly paid: Resources;
  /** C8: training paused while its territory is contested. */
  readonly paused: boolean;
  readonly territoryId: TerritoryId;
  readonly turnsLeft: number;
  readonly typeId: UnitTypeId;
  readonly unitId: UnitId;
}

/** R6: a unit raised in play has no scenario definition, so the state carries it. */
export type RaisedUnitDefinition = Pick<UnitDefinition, "factionId" | "fullStrength" | "generalId" | "id" | "name" | "type">;

/** T2: this turn's weather. The forecast (T3) is derived from next turn's season tables. */
export interface WeatherState {
  readonly outcomes: Readonly<Record<WeatherZoneId, WeatherId>>;
  /** The single d20 roll read against every zone's table (Q-WX-1). */
  readonly roll: number;
}

/** D7: a replacement general on his way, after a death or a sacking. */
export interface PendingGeneral {
  /** The turn at whose end he appears in the faction's seat territory. */
  readonly arrivesOnTurn: number;
  readonly factionId: FactionId;
  readonly generalId: GeneralId;
}

/** U5: where each faction is in its roster of generals. */
export interface GeneralsState {
  /** Index into the faction's roster of the next general to bring in. */
  readonly nextIndex: number;
  /** Replacements due, in the order they were called. */
  readonly pending: readonly PendingGeneral[];
}

/** U4: what a recon flight showed a viewer, until the end of `untilTurn`. */
export interface ReconReveal {
  readonly territoryId: TerritoryId;
  readonly untilTurn: number;
  readonly viewerFactionId: FactionId;
}

/** U3: a raid's one-turn income cut on a sub-territory. */
export interface RaidCut {
  /** B3: the faction raided, the sub-territory's holder when the raid flew; only its income is cut. */
  readonly factionId: FactionId;
  readonly subTerritoryId: SubTerritoryId;
  readonly turnNumber: number;
}

export interface GameState {
  readonly cityControl: Readonly<Record<CityId, FactionId>>;
  readonly control: Readonly<Record<TerritoryId, TerritoryControl>>;
  /** Dug-in territories. A territory with no entry has no works. */
  readonly fortification: Readonly<Record<TerritoryId, Fortification>>;
  readonly generals: Readonly<Record<FactionId, GeneralsState>>;
  readonly raidCuts: readonly RaidCut[];
  readonly raised: Readonly<Record<UnitId, RaisedUnitDefinition>>;
  readonly reveals: readonly ReconReveal[];
  /** Every sub-territory, keyed by id. Empty without sub-territories. */
  readonly subTerritories: Readonly<Record<SubTerritoryId, SubTerritoryState>>;
  readonly training: readonly TrainingItem[];
  /** $6: each faction's balances. Hidden from other viewers (per-viewer filtering). Empty without an economy. */
  readonly treasuries: Readonly<Record<FactionId, Resources>>;
  readonly turnNumber: number;
  readonly units: Readonly<Record<UnitId, UnitState>>;
  /** Absent without the weather module, and before the first roll. */
  readonly weather?: WeatherState;
}
