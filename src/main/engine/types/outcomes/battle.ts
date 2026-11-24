import type { BuildingId, FactionId, GeneralId, GradeId, SubTerritoryId, TerritoryId, TraitId, UnitId, UnitTypeId, WeatherId } from "../../ids";
import type { CombatRole } from "../scenario";

/** Battle outcomes (M12-M21, M27; D1-D8 for the d20), owned by the combat phases. */

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
  | { readonly halvings: number; readonly kind: "odds-halving"; readonly roll: number }
  /** D4, U5, D5 (declog): the best general on a side, +1 for his side. */
  | { readonly factionId: FactionId; readonly generalId: GeneralId; readonly kind: "general"; readonly role: CombatRole; readonly roll: number }
  /** U5: the trait of the general whose bonus counts. */
  | { readonly generalId: GeneralId; readonly kind: "trait"; readonly role: CombatRole; readonly roll: number; readonly traitId: TraitId }
  /** D4: city barricades for the defender (negative). */
  | { readonly kind: "barricades"; readonly roll: number }
  /** D5: a unit type's per-points bonus, such as artillery or tanks, for one side. */
  | { readonly kind: "unit-bonus"; readonly points: number; readonly role: CombatRole; readonly roll: number; readonly unitTypeId: UnitTypeId }
  /** C6, D6 (declog): a fatigued side (negative for the attacker, positive when the defender is fatigued). */
  | { readonly factionId: FactionId; readonly kind: "fatigue"; readonly role: CombatRole; readonly roll: number }
  /** D7: the battle zone's weather. */
  | { readonly kind: "weather"; readonly roll: number; readonly weatherId: WeatherId }
  /** M5, D7: an amphibious assault. */
  | { readonly kind: "amphibious"; readonly roll: number }
  /** R6: every attacking ground unit crossed a mountain pass, named `name`, into the territory. */
  | { readonly kind: "pass"; readonly name: string; readonly roll: number }
  /** R10, R11: aircraft on Ground Support for the side that won the air (or flew unopposed). */
  | { readonly factionId: FactionId; readonly kind: "air-support"; readonly role: CombatRole; readonly roll: number; readonly unitIds: readonly UnitId[] }
  /** $4: a defending building, such as Fortifications, in a sub-territory the defender holds. */
  | { readonly buildingId: BuildingId; readonly kind: "building"; readonly roll: number; readonly subTerritoryId: SubTerritoryId };

/** One army's contribution to a battle side. */
export interface BattleArmy {
  /** Its morale as it fought; a demoralized army's value counts at the scenario's reduced share. */
  readonly demoralized: boolean;
  readonly factionId: FactionId;
  /** Where the army fought from: its origin when it moved this turn, else the battle territory. */
  readonly from: TerritoryId;
  /** Its men at full strength, and the men it fought with. `value` is rounded from their share. */
  readonly fullMen: number;
  readonly men: number;
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

/**
 * One battle on the d20 table (D1, D2, P4). `losses` (men lost and units destroyed, per unit)
 * and `demoralizedUnitIds` are the one record of what a battle did to units; the harness reads them.
 */
export interface BattleOutcome {
  readonly attacker: BattleSide;
  readonly attackerFactionId: FactionId;
  /** The odds column, 0 (below 1:1) to 6 (6:1). */
  readonly column: number;
  readonly defender: BattleSide;
  readonly demoralizedUnitIds: readonly UnitId[];
  /** The die as rolled, 1 to 20. */
  readonly die: number;
  readonly grade: GradeId;
  /** P4: sub-territories that changed hands: 0, 1, 2 or the whole territory. */
  readonly ground: 0 | 1 | 2 | "all";
  readonly kind: "battle";
  readonly losses: readonly ArmyLoss[];
  readonly modifiers: readonly CombatModifier[];
  /** The odds as players read them, for example "2:1" or "1:3". */
  readonly oddsLabel: string;
  readonly retreats: readonly Retreat[];
  /** The table score used: the die plus every modifier, clamped to 0..20. */
  readonly score: number;
  readonly site: BattleSite;
  /** The men who surrendered with each unit of `surrenderedUnitIds`, beyond its battle losses. Absent: none surrendered. */
  readonly surrenderedMen?: Readonly<Record<UnitId, number>>;
  readonly surrenderedUnitIds: readonly UnitId[];
}
