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
export const supportedRulesets = ["m2-strength"] as const;
export type RulesetId = (typeof supportedRulesets)[number];

/** Player-facing briefing text for one faction. */
export interface FactionBriefing {
  readonly firstTurnHint: string;
  readonly objective: string;
}

/**
 * The seven battle results, from worst to best for the attacker. The scenario schema repeats
 * this list as a literal (it may import only zod); a unit test keeps the copies identical.
 */
export const battleResults = [
  "attacker-eliminated",
  "attacker-attrition",
  "attacker-demoralized",
  "both-demoralized",
  "defender-demoralized",
  "defender-exchange",
  "defender-eliminated"
] as const;
export type BattleResult = (typeof battleResults)[number];

/** The value an army fights with: its attack when attacking, its defence when defending. */
export type CombatRole = "attack" | "defence";

export interface FactionDefinition {
  readonly abbreviation: string;
  readonly briefing: FactionBriefing;
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
  /** Combat value of a full-strength army of this type when it attacks (C4). */
  readonly attack: number;
  /** Combat value of a full-strength army of this type when it defends (C4). */
  readonly defence: number;
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
  readonly cityId?: CityId;
  /** Short counter label; derived from the name when absent. Display only. */
  readonly designation?: string;
  readonly factionId: FactionId;
  readonly formationKind: FormationKind;
  /** Men at full establishment; the type's values apply at this strength. */
  readonly fullStrength: number;
  readonly historicalNote?: string;
  readonly id: UnitId;
  readonly name: string;
  readonly sources: readonly SourceCitation[];
  /** Men at the scenario snapshot. Never greater than `fullStrength`. */
  readonly strength: number;
  readonly territoryId: TerritoryId;
  readonly type: UnitTypeId;
}

export interface VictoryRules {
  readonly cityShare: number;
  readonly territoryShare: number;
  readonly tieBreak: readonly VictoryCondition[];
}

/** When a faction modifier applies. */
export type ModifierCondition = "holds-controlled-city";

/**
 * A named roll modifier for one faction, such as a designed edge. `attack` applies when the
 * faction attacks and `defence` when it defends, each only while `when` holds.
 */
export interface FactionModifier {
  readonly attack: number;
  readonly defence: number;
  readonly factionId: FactionId;
  readonly id: string;
  /** Player-facing name shown in battle breakdowns. */
  readonly name: string;
  readonly when: ModifierCondition;
}

/** The scenario's `combat` block: every tunable number of the m2-strength battle rules. */
export interface CombatRules {
  /** Below 1:1 the attacker's roll takes `rollPenalty` per halving of the odds (C3). */
  readonly belowOneToOne: { readonly kind: "halving"; readonly rollPenalty: number };
  /** Multiplier applied to a demoralized army's values (C6). */
  readonly demoralizationFactor: number;
  /** Defence roll bonus a held territory gains each turn one of its holder's armies entrenches, and its cap (C7, O3). */
  readonly diggingIn: { readonly max: number; readonly perTurn: number };
  readonly factionModifiers: readonly FactionModifier[];
  /** `table[column][row]`: seven odds columns (below 1:1, then 1:1 to 6:1) by seven rows (modified roll 0 to 6). */
  readonly table: readonly (readonly BattleResult[])[];
}

export interface ScenarioIndex {
  readonly cities: ReadonlyMap<CityId, CityDefinition>;
  readonly citiesByTerritory: ReadonlyMap<TerritoryId, readonly CityDefinition[]>;
  readonly factions: ReadonlyMap<FactionId, FactionDefinition>;
  readonly neighbors: ReadonlyMap<TerritoryId, readonly Neighbor[]>;
  readonly territories: ReadonlyMap<TerritoryId, TerritoryDefinition>;
  readonly unitTypes: ReadonlyMap<UnitTypeId, UnitTypeDefinition>;
  readonly units: ReadonlyMap<UnitId, UnitDefinition>;
}

/** A validated, indexed scenario. Produced only by the scenario loader. */
export interface Scenario {
  readonly cities: readonly CityDefinition[];
  readonly combat: CombatRules;
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

/** C6: a demoralized army fights at reduced values and recovers after a turn of rest (O4). */
export interface Morale {
  readonly demoralized: boolean;
  /** Complete turns of rest since the army was last demoralized. Zero while not demoralized. */
  readonly quietTurns: number;
}

/** One army: its own men, morale, and position (C4). */
export interface UnitState {
  readonly cityId?: CityId;
  readonly factionId: FactionId;
  readonly id: UnitId;
  readonly morale: Morale;
  /** Men now. Starts at the definition's `strength` and never rises in Milestone 2 (C13). */
  readonly strength: number;
  readonly territoryId: TerritoryId;
}

/** C7: works a territory holds for the faction that holds it. */
export interface Fortification {
  readonly factionId: FactionId;
  /** Defence roll bonus, from 1 up to the scenario's `diggingIn.max`. */
  readonly level: number;
}

export interface GameState {
  readonly cityControl: Readonly<Record<CityId, FactionId>>;
  readonly control: Readonly<Record<TerritoryId, TerritoryControl>>;
  /** Dug-in territories. A territory with no entry has no works. */
  readonly fortification: Readonly<Record<TerritoryId, Fortification>>;
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
  readonly submittedOrders: readonly MoveOrder[];
  readonly victory?: VictoryResult;
}
