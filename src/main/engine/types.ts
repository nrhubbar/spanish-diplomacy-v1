import type {
  CityId,
  FactionId,
  ScenarioId,
  SourceId,
  TerritoryId,
  UnitId,
  UnitTypeId
} from "./ids";

export type { CityId, FactionId, ScenarioId, SourceId, TerritoryId, UnitId, UnitTypeId } from "./ids";

export type ActorKind = "local-human" | "computer" | "online-human";
export type FormationKind = "regiment" | "battalion" | "column" | "security" | "other";
export type ConnectionKind = "land" | "sea";
export type VictoryCondition = "cities" | "territories";

/** The only ruleset this engine implements. Packages naming another ruleset fail to load. */
export const supportedRulesets = ["m2-movement"] as const;
export type RulesetId = (typeof supportedRulesets)[number];

export interface FactionDefinition {
  readonly abbreviation: string;
  readonly color: string;
  readonly defaultActor: ActorKind;
  readonly id: FactionId;
  readonly motivation: string;
  readonly name: string;
  readonly objectiveTerritoryIds: readonly TerritoryId[];
}

export type TerritoryControl =
  | { readonly kind: "controlled"; readonly factionId: FactionId }
  | { readonly kind: "contested"; readonly factionIds: readonly FactionId[] };

export interface TerritoryDefinition {
  readonly countsForVictory: boolean;
  readonly id: TerritoryId;
  readonly initialControl: TerritoryControl;
  readonly isolatedReason?: string;
  readonly name: string;
}

export interface ConnectionDefinition {
  readonly between: readonly [TerritoryId, TerritoryId];
  readonly kind: ConnectionKind;
  readonly label?: string;
}

export interface Neighbor {
  readonly kind: ConnectionKind;
  readonly territoryId: TerritoryId;
}

export interface CityDefinition {
  readonly countsForVictory: boolean;
  readonly id: CityId;
  readonly initialController?: FactionId;
  readonly name: string;
  readonly territoryId: TerritoryId;
}

export interface UnitTypeDefinition {
  readonly id: UnitTypeId;
  readonly name: string;
}

export interface SourceDefinition {
  readonly id: SourceId;
  readonly title: string;
  readonly url?: string;
}

export interface SourceCitation {
  readonly reference?: string;
  readonly sourceId: SourceId;
}

export interface UnitDefinition {
  /** Display-only metadata. It has no rules effect under the m2-movement ruleset. */
  readonly approximateStrength?: number;
  readonly cityId?: CityId;
  readonly factionId: FactionId;
  readonly formationKind: FormationKind;
  readonly historicalNote?: string;
  readonly id: UnitId;
  readonly name: string;
  readonly sources: readonly SourceCitation[];
  readonly territoryId: TerritoryId;
  readonly type: UnitTypeId;
}

export interface VictoryRules {
  readonly cityShare: number;
  readonly territoryShare: number;
  readonly tieBreak: readonly VictoryCondition[];
}

export interface ScenarioIndex {
  readonly cities: ReadonlyMap<CityId, CityDefinition>;
  readonly citiesByTerritory: ReadonlyMap<TerritoryId, readonly CityDefinition[]>;
  readonly factions: ReadonlyMap<FactionId, FactionDefinition>;
  readonly neighbors: ReadonlyMap<TerritoryId, readonly Neighbor[]>;
  readonly territories: ReadonlyMap<TerritoryId, TerritoryDefinition>;
  readonly units: ReadonlyMap<UnitId, UnitDefinition>;
}

/** A validated, indexed scenario. Produced only by the scenario loader. */
export interface Scenario {
  readonly cities: readonly CityDefinition[];
  readonly connections: readonly ConnectionDefinition[];
  readonly factions: readonly FactionDefinition[];
  readonly id: ScenarioId;
  readonly index: ScenarioIndex;
  readonly name: string;
  readonly ruleset: RulesetId;
  readonly snapshotLabel: string;
  readonly sources: readonly SourceDefinition[];
  readonly territories: readonly TerritoryDefinition[];
  readonly unitTypes: readonly UnitTypeDefinition[];
  readonly units: readonly UnitDefinition[];
  readonly victory: VictoryRules;
}

export interface UnitState {
  readonly cityId?: CityId;
  readonly factionId: FactionId;
  readonly id: UnitId;
  readonly territoryId: TerritoryId;
}

export interface GameState {
  readonly cityControl: Readonly<Record<CityId, FactionId>>;
  readonly control: Readonly<Record<TerritoryId, TerritoryControl>>;
  readonly turnNumber: number;
  readonly units: Readonly<Record<UnitId, UnitState>>;
}

export interface MoveOrder {
  readonly factionId: FactionId;
  readonly from: TerritoryId;
  readonly kind: "move";
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

export interface PlayerSubmission {
  readonly factionId: FactionId;
  readonly orders: readonly MoveOrder[];
}

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/** Why a move failed to enter its destination. */
export type BounceCause =
  | { readonly kind: "standoff"; readonly opposingFactionIds: readonly FactionId[] }
  | { readonly kind: "held"; readonly holdingFactionIds: readonly FactionId[] }
  | { readonly kind: "head-on"; readonly opposingFactionIds: readonly FactionId[] };

export interface SuccessfulMoveOutcome {
  readonly kind: "successful-move";
  readonly order: MoveOrder;
}

export interface BouncedMoveOutcome {
  readonly cause: BounceCause;
  readonly kind: "bounced-move";
  readonly order: MoveOrder;
}

export interface DisbandedMoveOutcome {
  readonly capturedByFactionId: FactionId;
  readonly cause: BounceCause;
  readonly kind: "disbanded-move";
  readonly order: MoveOrder;
}

export interface InvalidOrderOutcome {
  readonly kind: "invalid-order";
  readonly order: MoveOrder;
  readonly reason: string;
}

export interface NoMoveOutcome {
  readonly factionId: FactionId;
  readonly kind: "no-move";
  readonly unitId?: UnitId;
}

export type TurnOutcome =
  | SuccessfulMoveOutcome
  | BouncedMoveOutcome
  | DisbandedMoveOutcome
  | InvalidOrderOutcome
  | NoMoveOutcome;

export interface ControlChange {
  readonly after: TerritoryControl;
  readonly before: TerritoryControl;
  readonly territoryId: TerritoryId;
}

export interface CityChange {
  readonly after: FactionId;
  readonly before: FactionId | undefined;
  readonly cityId: CityId;
}

export interface VictoryProgress {
  readonly citiesControlled: number;
  readonly cityThreshold: number;
  readonly factionId: FactionId;
  readonly territoriesControlled: number;
  readonly territoryThreshold: number;
}

export interface VictoryResult {
  readonly condition: VictoryCondition | "shared";
  readonly factionIds: readonly FactionId[];
}

export interface TurnResolutionResult {
  readonly cityChanges: readonly CityChange[];
  readonly controlChanges: readonly ControlChange[];
  readonly finalState: GameState;
  readonly outcomes: readonly TurnOutcome[];
  readonly progress: readonly VictoryProgress[];
  readonly submittedOrders: readonly MoveOrder[];
  readonly victory?: VictoryResult;
}
