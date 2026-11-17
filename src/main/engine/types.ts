export type FactionId = "republic" | "north" | "south";

export type TerritoryId =
  | "galicia"
  | "asturias"
  | "cantabria"
  | "pais-vasco"
  | "navarra"
  | "la-rioja"
  | "aragon"
  | "madrid"
  | "castilla-y-leon"
  | "castilla-la-mancha"
  | "extremadura"
  | "catalunya"
  | "valencia"
  | "islas-baleares"
  | "andalucia"
  | "murcia"
  | "ceuta"
  | "melilla"
  | "canarias";

export type UnitId = string;
export type CityId = string;
export type ActorKind = "local-human" | "computer" | "online-human";
export type UnitType = "infantry";
export type FormationKind = "regiment" | "battalion" | "column" | "security" | "other";

export interface FactionDefinition {
  readonly abbreviation: string;
  readonly color: string;
  readonly id: FactionId;
  readonly motivation: string;
  readonly name: string;
  readonly objectiveTerritoryIds: readonly TerritoryId[];
}

export interface TerritoryDefinition {
  readonly id: TerritoryId;
  readonly name: string;
  readonly adjacent: readonly TerritoryId[];
  readonly countsForVictory: boolean;
}

export interface CityDefinition {
  readonly countsForVictory: boolean;
  readonly id: CityId;
  readonly name: string;
  readonly territoryId: TerritoryId;
  readonly x: number;
  readonly y: number;
}

export type TerritoryControl =
  | { readonly kind: "controlled"; readonly factionId: FactionId }
  | { readonly kind: "contested"; readonly factionIds: readonly FactionId[] };

export interface UnitState {
  readonly cityId?: CityId;
  readonly displayName: string;
  readonly factionId: FactionId;
  readonly formationKind: FormationKind;
  readonly historicalNote?: string;
  readonly id: UnitId;
  readonly sourceIds: readonly string[];
  readonly strength: number;
  readonly type: UnitType;
  readonly territoryId: TerritoryId;
}

export interface GameState {
  readonly cityControl: Partial<Record<CityId, FactionId>>;
  readonly control: Record<TerritoryId, TerritoryControl>;
  readonly turnNumber: number;
  readonly units: Record<UnitId, UnitState>;
}

export interface ScenarioDefinition {
  readonly cities: readonly CityDefinition[];
  readonly factions: readonly FactionDefinition[];
  readonly initialCityControl: Partial<Record<CityId, FactionId>>;
  readonly initialControl: Record<TerritoryId, TerritoryControl>;
  readonly id: string;
  readonly snapshotLabel: string;
  readonly territories: readonly TerritoryDefinition[];
  readonly units: Record<UnitId, UnitState>;
}

export interface ActorAssignment {
  readonly factionId: FactionId;
  readonly kind: ActorKind;
}

export interface MoveOrder {
  readonly kind: "move";
  readonly factionId: FactionId;
  readonly from: TerritoryId;
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

export interface SuccessfulMoveOutcome {
  readonly kind: "successful-move";
  readonly order: MoveOrder;
}

export interface BouncedMoveOutcome {
  readonly kind: "bounced-move";
  readonly order: MoveOrder;
  readonly reason: string;
}

export interface DisbandedMoveOutcome {
  readonly kind: "disbanded-move";
  readonly order: MoveOrder;
  readonly reason: string;
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

export interface ControlChange {
  readonly controller: FactionId;
  readonly territoryId: TerritoryId;
}

export type TurnOutcome =
  | SuccessfulMoveOutcome
  | BouncedMoveOutcome
  | DisbandedMoveOutcome
  | InvalidOrderOutcome
  | NoMoveOutcome;

export interface VictoryProgress {
  readonly citiesControlled: number;
  readonly cityThreshold: number;
  readonly factionId: FactionId;
  readonly territoriesControlled: number;
  readonly territoryThreshold: number;
}

export interface VictoryResult {
  readonly condition: "cities" | "territories" | "shared";
  readonly factionIds: readonly FactionId[];
}

export interface TurnResolutionResult {
  readonly cityControl: Partial<Record<CityId, FactionId>>;
  readonly controlChanges: readonly ControlChange[];
  readonly finalControl: Record<TerritoryId, TerritoryControl>;
  readonly finalUnits: Record<UnitId, UnitState>;
  readonly outcomes: readonly TurnOutcome[];
  readonly progress: readonly VictoryProgress[];
  readonly submittedOrders: readonly MoveOrder[];
  readonly summaryLines: readonly string[];
  readonly victory?: VictoryResult;
}
