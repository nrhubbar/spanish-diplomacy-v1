export type FactionId = "com" | "roy" | "fas";

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

export type UnitType = "infantry";

export interface FactionDefinition {
  readonly abbreviation: string;
  readonly color: string;
  readonly id: FactionId;
  readonly name: string;
}

export interface TerritoryDefinition {
  readonly id: TerritoryId;
  readonly name: string;
  readonly adjacent: readonly TerritoryId[];
}

export interface UnitState {
  readonly displayName: string;
  readonly factionId: FactionId;
  readonly id: UnitId;
  readonly type: UnitType;
  readonly territoryId: TerritoryId;
}

export interface GameState {
  readonly control: Partial<Record<TerritoryId, FactionId>>;
  readonly turnNumber: number;
  readonly units: Record<UnitId, UnitState>;
}

export interface ScenarioDefinition {
  readonly factions: readonly FactionDefinition[];
  readonly territories: readonly TerritoryDefinition[];
  readonly units: Record<UnitId, UnitState>;
  readonly initialControl: Partial<Record<TerritoryId, FactionId>>;
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

export interface TurnResolutionResult {
  readonly controlChanges: readonly ControlChange[];
  readonly finalControl: Partial<Record<TerritoryId, FactionId>>;
  readonly finalUnits: Record<UnitId, UnitState>;
  readonly outcomes: readonly TurnOutcome[];
  readonly submittedOrders: readonly MoveOrder[];
  readonly summaryLines: readonly string[];
}
