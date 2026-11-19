import type { CityId, FactionId, TerritoryId, UnitId } from "../ids";
import type { MoveOrder, Order } from "./orders";
import type { BattleResult, CombatRole, TerritoryControl, VictoryCondition } from "./scenario";
import type { GameState } from "./state";

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
  /** M21: another faction took the origin, so the army fell back here instead of returning. */
  readonly retreatedTo?: TerritoryId;
}

/** Interim M8, and M21 surrender: the army bounced and another faction holds its origin. */
export interface DisbandedMoveOutcome {
  readonly capturedByFactionId: FactionId;
  readonly cause: BounceCause;
  readonly kind: "disbanded-move";
  readonly order: MoveOrder;
}

/** M9: an impossible move; its army is disbanded. */
export interface InvalidOrderOutcome {
  readonly kind: "invalid-order";
  readonly order: MoveOrder;
  readonly reason: string;
}

/**
 * Section 2 step 1: an order other than a move that failed validation at reveal. Nothing is
 * disbanded, and anything it paid for is refunded.
 */
export interface RejectedOrderOutcome {
  readonly kind: "rejected-order";
  readonly order: Exclude<Order, MoveOrder>;
  readonly reason: string;
}

export interface NoMoveOutcome {
  readonly factionId: FactionId;
  readonly kind: "no-move";
  readonly unitId?: UnitId;
}

/** C10: a move into territory its faction holds or controls; it always arrives. */
export interface ReinforcementArrivedOutcome {
  readonly kind: "reinforcement-arrived";
  readonly order: MoveOrder;
}

/** C6: a demoralized army recovered after a turn of rest (O4). */
export interface RecoveredOutcome {
  readonly factionId: FactionId;
  readonly kind: "recovered";
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** A named change to the attacker's die roll. `roll` is signed: negative favours the defender. */
export type CombatModifier =
  /** C7: the defender's works. `roll` is `-level`. */
  | { readonly kind: "dug-in"; readonly level: number; readonly roll: number }
  /** A scenario faction modifier, such as popular resistance (C17). */
  | {
      readonly factionId: FactionId;
      readonly kind: "faction";
      readonly modifierId: string;
      readonly name: string;
      readonly role: CombatRole;
      readonly roll: number;
    }
  /** Odds above 6:1: each step beyond the last column adds one to the roll. */
  | { readonly kind: "odds-overflow"; readonly roll: number }
  /** C3: below 1:1, the penalty for each halving of the odds. */
  | { readonly halvings: number; readonly kind: "odds-halving"; readonly roll: number };

/** One army's contribution to a battle side. */
export interface BattleArmy {
  readonly factionId: FactionId;
  /** Where the army fought from: its origin when it moved this turn, else the battle territory. */
  readonly from: TerritoryId;
  readonly unitId: UnitId;
  /** Its combat value in this battle (C5): attack or defence, after strength and morale. */
  readonly value: number;
}

export interface BattleSide {
  readonly armies: readonly BattleArmy[];
  /** Sum of the armies' values. */
  readonly value: number;
}

/** Who holds a fought-over territory once every battle there is resolved (section 1.6). */
export type Occupation =
  | { readonly kind: "held" }
  | { readonly factionId: FactionId; readonly kind: "taken" }
  | { readonly kind: "left-empty" };

/**
 * M27: a seeded roll that settled a tie for the attacker or the defender of a standing battle.
 * `factionIds` are the tied factions in id order; the roll, from 1 to their number, picks
 * `factionIds[roll - 1]`.
 */
export interface StandingTieBreak {
  readonly factionIds: readonly FactionId[];
  readonly role: CombatRole;
  readonly roll: number;
}

/** Where a battle was fought. */
export type BattleSite =
  /** A defended territory (section 1.6 step 1). */
  | { readonly kind: "assault"; readonly occupation: Occupation; readonly territoryId: TerritoryId }
  /** An empty territory entered by several factions (section 1.6 step 3). */
  | { readonly kind: "entry"; readonly occupation: Occupation; readonly territoryId: TerritoryId }
  /** A head-on swap on the road between two territories (C9). `winner` continues its move. */
  | { readonly between: readonly [TerritoryId, TerritoryId]; readonly kind: "meeting"; readonly winner?: FactionId }
  /** M27: factions still sharing a territory after every other battle fight where they stand. */
  | {
      readonly kind: "standing";
      readonly occupation: Occupation;
      /** Ties broken by a seeded roll; empty when no tie decided who fights. */
      readonly tieBreaks: readonly StandingTieBreak[];
      readonly territoryId: TerritoryId;
    };

export interface ArmyLoss {
  readonly destroyed: boolean;
  readonly men: number;
  readonly unitId: UnitId;
}

export interface Retreat {
  readonly from: TerritoryId;
  readonly to: TerritoryId;
  readonly unitId: UnitId;
}

/** One battle: the sides, the roll, the result, and everything that result did. */
export interface BattleOutcome {
  readonly attacker: BattleSide;
  readonly attackerFactionId: FactionId;
  /** The odds column, 0 (below 1:1) to 6 (6:1). */
  readonly column: number;
  readonly defender: BattleSide;
  /** The die as rolled, 1 to 6. */
  readonly die: number;
  readonly demoralizedUnitIds: readonly UnitId[];
  readonly kind: "battle";
  readonly losses: readonly ArmyLoss[];
  readonly modifiers: readonly CombatModifier[];
  /** The odds as players read them, for example "2:1" or "1:3". */
  readonly oddsLabel: string;
  readonly result: BattleResult;
  readonly retreats: readonly Retreat[];
  /** The table row used: the die plus every modifier, clamped to 0..6. */
  readonly row: number;
  readonly site: BattleSite;
  readonly surrenderedUnitIds: readonly UnitId[];
}

export type TurnOutcome =
  | SuccessfulMoveOutcome
  | BouncedMoveOutcome
  | DisbandedMoveOutcome
  | InvalidOrderOutcome
  | RejectedOrderOutcome
  | NoMoveOutcome
  | ReinforcementArrivedOutcome
  | RecoveredOutcome
  | BattleOutcome;

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
  readonly submittedOrders: readonly Order[];
  readonly victory?: VictoryResult;
}
