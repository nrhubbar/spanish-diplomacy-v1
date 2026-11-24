import type { FactionId, GeneralId, GradeId, SeasonId, TraitId, WeatherId, WeatherZoneId } from "../ids";
import type { TraitEffect, WeatherEffect } from "./effects";
import type { FactionModifier, SourceCitation } from "./scenario";

/** D2: how hard a grade hits one side. `lossPercent` 100 destroys the side. */
export interface GradeSideEffect {
  readonly demoralized: "none" | "half" | "all";
  /** Share of each army's men lost, in percent: the 10, 20 and 35 steps, or 100. */
  readonly lossPercent: number;
}

/** D2: one entry of the grade catalogue. */
export interface GradeDefinition {
  readonly attacker: GradeSideEffect;
  readonly defender: GradeSideEffect & {
    /** "Defender broken": the weakest defending unit is destroyed. */
    readonly weakestDestroyed: boolean;
  };
  /** P4: sub-territories that change hands: 0, 1, 2, or the whole territory. */
  readonly ground: 0 | 1 | 2 | "all";
  readonly id: GradeId;
  readonly name: string;
}

/** D3, D4, D7, C6: the named d20 roll modifiers, signed from the attacker's view where it matters. */
export interface D20Modifiers {
  /** M5, D7: an amphibious assault (negative). */
  readonly amphibious: number;
  /** D4: city barricades, for the defender. */
  readonly barricades: number;
  /** D3: per halving of the odds below 1:1 (positive, subtracted). */
  readonly belowOneToOnePenalty: number;
  /** C6, D6: a fatigued side (negative). */
  readonly fatigued: number;
  /** R8: what one pip of works takes off the attacker's roll (`worksPerTurn`), and the most all pips may take (`worksMax`). */
  readonly worksMax: number;
  readonly worksPerTurn: number;
}

/** C6: the fatigue track, 0 to `demoralizedLevel`. */
export interface FatigueRules {
  /** C6, D6: units at this level or above count as fatigued. */
  readonly fatiguedLevel: number;
  /** C6: reaching this level demoralizes the unit. */
  readonly demoralizedLevel: number;
}

/** D1-D7: the d20 battle rules. */
export interface D20Rules {
  /** D6: a unit below this share of its full strength is destroyed. */
  readonly breakUpShare: number;
  readonly factionModifiers: readonly FactionModifier[];
  readonly fatigue: FatigueRules;
  readonly grades: readonly GradeDefinition[];
  readonly modifiers: D20Modifiers;
  /** `table[column][score]`: seven odds columns by 21 modified scores (0 to 20), naming grades. */
  readonly table: readonly (readonly GradeId[])[];
}

/** T2: one weather outcome, with its attack modifier (D7) and effects (T4). */
export interface WeatherOutcome {
  readonly attackRoll: number;
  readonly effects: readonly WeatherEffect[];
  readonly id: WeatherId;
  readonly name: string;
}

export interface Season {
  readonly id: SeasonId;
  /** Calendar months (1-12) in the season. Seasons cover the year exactly once. */
  readonly months: readonly number[];
  readonly name: string;
}

/** One row of a zone's seasonal table: rolls up to `upTo` (inclusive) give `outcome`. */
export interface WeatherBand {
  readonly outcome: WeatherId;
  readonly upTo: number;
}

/** T2: a climate zone. Each seasonal table runs from the best weather to the worst, ending at 20. */
export interface WeatherZone {
  readonly coastal: boolean;
  readonly id: WeatherZoneId;
  readonly name: string;
  readonly tables: Readonly<Record<SeasonId, readonly WeatherBand[]>>;
}

export interface WeatherRules {
  readonly outcomes: readonly WeatherOutcome[];
  readonly seasons: readonly Season[];
  readonly zones: readonly WeatherZone[];
}

/** T1: half-month turns from a start date. Turn 1 is the start. */
export interface CalendarRules {
  readonly start: { readonly half: "early" | "late"; readonly month: number; readonly year: number };
  readonly turnsPerYear: 24;
}

/** U3: the raid roll's outcomes. */
export const raidOutcomes = ["air-eliminated", "nothing-hit", "income-cut", "building-hit"] as const;
export type RaidOutcome = (typeof raidOutcomes)[number];

/** U2-U4, D7: the air module's numbers. */
export interface AirRules {
  /**
   * U5 (AG-8): a general whose army is destroyed or routed dies on a d20 roll at or under this
   * (0 when absent: generals never die). Generals have no rule area of their own (CT-4).
   */
  readonly generalDeathRoll?: number | undefined;
  /** U3: each enemy fighter intercepting a raid takes this (negative) from its roll. */
  readonly interceptRoll: number;
  /** U3: the d20 raid table, best for the defender first, ending at 20. */
  readonly raidTable: readonly { readonly outcome: RaidOutcome; readonly upTo: number }[];
  /** U4, D7: turns a recon reveal lasts. */
  readonly reconTurns: number;
  /** R11: the most aircraft whose Ground Support counts for one side; absent means no cap. */
  readonly supportMax?: number | undefined;
}

/** U5: a general's trait. */
export interface GeneralTrait {
  readonly effects: readonly TraitEffect[];
  readonly id: TraitId;
  readonly name: string;
}

/** U5: one named commander. A faction's roster is its generals in scenario order. */
export interface GeneralDefinition {
  readonly factionId: FactionId;
  readonly id: GeneralId;
  readonly name: string;
  readonly sources: readonly SourceCitation[];
  readonly traitId: TraitId;
}

/**
 * E7, EB-15: how much of what Recruit orders leave a computer player spends on Build orders. It
 * builds only where a sub-territory's queue is empty.
 */
export interface AiBuildBudget {
  /** New items one sub-territory with an empty queue may take in a turn. */
  readonly itemsPerEmptyQueue: number;
  /** Build orders a turn, so a rich treasury does not vanish into queues at once. */
  readonly maxOrdersPerTurn: number;
  /** Share of each resource left after this turn's Recruit orders that builds may spend. */
  readonly spendShare: number;
  /**
   * M5: share of each resource that builds cost which the Recruit planner leaves unspent. It
   * leaves at least the price of the development item it saves for (`developmentProjects`).
   */
  readonly reserveShare: number;
  /**
   * M5: development items (Farms, Mines, Industry) the faction keeps in its queues. While it has
   * fewer, Recruit orders leave the best one's price and Build orders buy it first.
   */
  readonly developmentProjects: number;
  /** M5: the most of a resource's balance the saved-for development item may take; above it, Recruit orders come first. */
  readonly developmentShare: number;
}

/** E7: a computer player's weights for one faction. The strategy logic stays in code. */
export interface AiProfile {
  /** EB-15: the Build budget; required with an economy module (L27). */
  readonly builds?: AiBuildBudget;
  readonly computer: {
    readonly approachObjective: number;
    readonly bouncedLastTurn: number;
    readonly caution: number;
    readonly demoralizedShare: number;
    readonly enemyLoss: number;
    readonly ownLoss: number;
  };
  readonly offensive: {
    readonly focus: number;
    readonly oddsTieBreak: number;
    readonly reach: number;
    readonly stallCap: number;
    readonly stallStep: number;
    readonly staging: number;
  };
  readonly recruits: {
    /** Turns of upkeep, at today's income, that Recruit orders leave in stock. */
    readonly upkeepTurns: number;
  };
  readonly stakes: { readonly city: number; readonly objective: number; readonly territory: number };
  /**
   * `steps` and `perStep` raise the stakes of a rival's territories as it nears victory, so the
   * faction attacks the leader. `critical` raises, by stake times (1 + critical), a territory whose
   * change of hands alone would decide the game (D23): ground, whoever holds it, that a rival in
   * reach or the faction itself would win by taking.
   */
  readonly victoryAlarm: {
    readonly critical: number;
    readonly perStep: number;
    /** The least share of own losses and of the danger at home that count when attacking a rival near victory. */
    readonly riskFloor: number;
    /** A rival this many steps short of victory, or fewer, is spent against at once (`ai/alarm.ts`). */
    readonly spendSteps: number;
    readonly steps: number;
  };
  /**
   * C1, D24: when to Withdraw from contested ground, by the chance (from the engine's odds for
   * the standing battle) that the enemy takes the territory whole this turn. `lastStandTakeChance`
   * applies to the faction's seat, its last objective and a victory-critical territory.
   */
  readonly withdraw: { readonly hopelessTakeChance: number; readonly lastStandTakeChance: number };
}

/** E7, H6: computer players' data. */
export interface AiRules {
  /** E7: one profile per faction, keyed by faction id. */
  readonly profiles: Readonly<Record<FactionId, AiProfile>>;
}
