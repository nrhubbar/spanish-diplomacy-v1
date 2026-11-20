import type {
  BuildingId,
  CityId,
  FactionId,
  GeneralId,
  SourceId,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitTypeId,
  WeatherZoneId
} from "../ids";
import type { UnitEffect } from "./effects";
import type { Resources } from "./economy";
import type { AirMissionKind, UnitKind, UnitOrderKind, UnitSymbol } from "./rules";

export type ActorKind = "local-human" | "computer" | "online-human";
export type FormationKind = "regiment" | "battalion" | "column" | "security" | "other";
export type ConnectionKind = "land" | "sea";
export type VictoryCondition = "cities" | "territories";

/** The value an army fights with: its attack when attacking, its defence when defending. */
export type CombatRole = "attack" | "defence";

/** Player-facing briefing text for one faction. */
export interface FactionBriefing {
  readonly firstTurnHint: string;
  readonly objective: string;
}

export interface FactionDefinition {
  readonly abbreviation: string;
  readonly briefing: FactionBriefing;
  readonly color: string;
  readonly defaultActor: ActorKind;
  readonly id: FactionId;
  readonly motivation: string;
  readonly name: string;
  readonly objectiveTerritoryIds: readonly TerritoryId[];
  /** D7: where a replacement general appears. Present when the scenario has generals. */
  readonly seatTerritoryId?: TerritoryId;
  /** $7: the treasury on turn 1. Present when the economy module is on. */
  readonly startingStock?: Resources;
}

export type TerritoryControl =
  | { readonly kind: "controlled"; readonly factionId: FactionId }
  | { readonly kind: "contested"; readonly factionIds: readonly FactionId[] };

export interface TerritoryDefinition {
  /** W3: the capital sub-territory. Present when the scenario has sub-territories. */
  readonly capitalSubTerritoryId?: SubTerritoryId;
  readonly countsForVictory: boolean;
  readonly id: TerritoryId;
  readonly initialControl: TerritoryControl;
  readonly isolatedReason?: string;
  readonly name: string;
  /** T2: the territory's climate zone. Present when the weather module is on. */
  readonly weatherZoneId?: WeatherZoneId;
}

export interface ConnectionDefinition {
  readonly between: readonly [TerritoryId, TerritoryId];
  /** P8: the sub-territory entered on each side, in `between` order. Present with sub-territories. */
  readonly entry?: readonly [SubTerritoryId, SubTerritoryId];
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
  /** The sub-territory the city is a feature of. Present with sub-territories. */
  readonly subTerritoryId?: SubTerritoryId;
  readonly territoryId: TerritoryId;
}

/** R2-R4: how a unit type is recruited. Present when the recruitment module is on. */
export interface RecruitRules {
  /** R3: a type may be limited to some factions; absent means every faction. */
  readonly factionIds?: readonly FactionId[];
  /** Men in a new unit of the type: its full strength. */
  readonly establishment: number;
  readonly cost: Resources;
  /** R3: buildings the capital sub-territory needs. */
  readonly requires: readonly BuildingId[];
  readonly trainingTurns: number;
}

export interface UnitTypeDefinition {
  /** U2: aircraft range in territories and the missions they fly. Present for air types. */
  readonly air?: { readonly missions: readonly AirMissionKind[]; readonly range: number };
  /** Combat value of a full-strength army of this type when it attacks (C4). */
  readonly attack: number;
  /** Combat value of a full-strength army of this type when it defends (C4). */
  readonly defence: number;
  /** E6: special effects, most types none or one. */
  readonly effects: readonly UnitEffect[];
  readonly id: UnitTypeId;
  readonly kind: UnitKind;
  readonly name: string;
  /** W5: the order kinds a unit of this type may take. */
  readonly orders: readonly UnitOrderKind[];
  readonly recruit?: RecruitRules;
  /** W5: the NATO function its counter shows. Absent under `m2-strength`. */
  readonly symbol?: UnitSymbol;
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
  /** U5: the roster entry a general unit stands for. Present exactly on units of a `general` type. */
  readonly generalId?: GeneralId;
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
