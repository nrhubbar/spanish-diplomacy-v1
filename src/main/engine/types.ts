export type FactionId = "player-1" | "player-2" | "player-3";

export type TerritoryId = "north" | "center" | "southwest" | "eastern-port";

export type UnitId = "soldier-1" | "soldier-2" | "soldier-3";

export type UnitType = "soldier";

export interface FactionDefinition {
  readonly id: FactionId;
  readonly name: string;
}

export interface TerritoryDefinition {
  readonly id: TerritoryId;
  readonly name: string;
  readonly adjacent: readonly TerritoryId[];
}

export interface UnitState {
  readonly id: UnitId;
  readonly factionId: FactionId;
  readonly type: UnitType;
  readonly territoryId: TerritoryId;
}

export interface GameState {
  readonly turnNumber: number;
  readonly units: Record<UnitId, UnitState>;
}

export interface ScenarioDefinition {
  readonly factions: readonly FactionDefinition[];
  readonly territories: readonly TerritoryDefinition[];
  readonly units: Record<UnitId, UnitState>;
}

export interface MoveOrder {
  readonly kind: "move";
  readonly factionId: FactionId;
  readonly unitId: UnitId;
  readonly from: TerritoryId;
  readonly to: TerritoryId;
}

export interface NoMoveOrder {
  readonly kind: "no-move";
  readonly factionId: FactionId;
  readonly unitId: UnitId;
}

export type Order = MoveOrder | NoMoveOrder;

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

export interface NoMoveOutcome {
  readonly kind: "no-move";
  readonly order: NoMoveOrder;
}

export type TurnOutcome = SuccessfulMoveOutcome | BouncedMoveOutcome | NoMoveOutcome;

export interface TurnResolutionResult {
  readonly outcomes: readonly TurnOutcome[];
  readonly finalUnits: Record<UnitId, UnitState>;
  readonly summaryLines: readonly string[];
}
