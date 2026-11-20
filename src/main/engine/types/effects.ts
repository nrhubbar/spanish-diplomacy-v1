import type { ResourceId, WeatherId } from "../ids";
import type { CombatRole } from "./scenario";

/**
 * E6: effects are named in data from coded lists of kinds, each with its numbers. The schema
 * repeats the kind lists as literals; a unit test keeps the copies identical.
 */

export const unitEffectKinds = [
  "roll-bonus-per-points",
  "cannot-attack-alone",
  "transport",
  "mobile",
  "raid-defence",
  "trains-in-contested",
  "command-bonus",
  "rally",
  "battle-support"
] as const;

/** A unit type's special effect (unit sheet, Q-MR-26). */
export type UnitEffect =
  /** D5: +`bonus` on the d20 per `per` points of this type's `role` value on its side, at most `max`; none in `exceptWeather`. */
  | {
      readonly bonus: number;
      readonly exceptWeather: readonly WeatherId[];
      readonly kind: "roll-bonus-per-points";
      readonly max: number;
      readonly per: number;
      readonly role: CombatRole;
    }
  /** D5: a side made only of this type cannot attack. */
  | { readonly kind: "cannot-attack-alone" }
  /** M1: one unit of this type carries `carries` other units, for the army's +1 move. */
  | { readonly carries: number; readonly kind: "transport" }
  /** M1: needs no transport for the +1 move, and ignores the terrain penalty. */
  | { readonly kind: "mobile" }
  /** U3: enemy raids on this unit's territory take `roll` (negative) on their roll. */
  | { readonly kind: "raid-defence"; readonly roll: number }
  /** C8: training finishes even when the territory becomes contested. */
  | { readonly kind: "trains-in-contested" }
  /** D4, U5: +`roll` on the d20 for the army the unit is in; only the best one counts per side (D5). */
  | { readonly kind: "command-bonus"; readonly roll: number }
  /** C5, U5: restores the morale of the army the unit is in. */
  | { readonly kind: "rally" }
  /** D7: a bomber supporting a battle adds `roll` for its side. */
  | { readonly kind: "battle-support"; readonly roll: number };

export const buildingEffectKinds = [
  "recruit-slots",
  "replenish-cap",
  "replenish-discount",
  "rail-departures",
  "airbase",
  "all-weather-airbase",
  "defence-roll"
] as const;

/** What a building does beyond gating unit types ($4). */
export type BuildingEffect =
  /** D7 defaults: `extra` more Recruit orders a turn in the territory. */
  | { readonly extra: number; readonly kind: "recruit-slots" }
  /** R5, D28.1 (Hospital): the per-turn Replenish cap rises by `share` of establishment. */
  | { readonly kind: "replenish-cap"; readonly share: number }
  /** R5, D28.1 (Depot): Replenish costs `share` less of `resource`. */
  | { readonly kind: "replenish-discount"; readonly resource: ResourceId; readonly share: number }
  /** M3: `extra` more armies may leave the capital by rail per turn. */
  | { readonly extra: number; readonly kind: "rail-departures" }
  /** U2: aircraft may be based here. */
  | { readonly kind: "airbase" }
  /** U2: aircraft based here fly in every weather. */
  | { readonly kind: "all-weather-airbase" }
  /** The defender of the territory gains `roll` on the d20 while it holds this sub-territory. */
  | { readonly kind: "defence-roll"; readonly roll: number };

export const weatherEffectKinds = ["blocks-digging-in", "grounds-aircraft", "movement-penalty", "frostbite", "closes-sea"] as const;

/** T4: what a weather outcome does, beyond its attack modifier. */
export type WeatherEffect =
  | { readonly kind: "blocks-digging-in" }
  /** U2: aircraft are grounded unless based at an all-weather airbase. */
  | { readonly kind: "grounds-aircraft" }
  /** M1: the movement allowance drops by `amount` (never below 1). */
  | { readonly amount: number; readonly kind: "movement-penalty" }
  /** T4, D7: a unit that moves loses `share` of its men. */
  | { readonly kind: "frostbite"; readonly share: number }
  /** T4: sea connections touching a coastal zone with this outcome close in these months (1-12). */
  | { readonly kind: "closes-sea"; readonly months: readonly number[] };

export const traitEffectKinds = ["roll-modifier", "no-rally"] as const;

/** U5: a general's one trait, good or bad. */
export type TraitEffect =
  /** A signed change to the d20 for the general's side when it takes `role`. */
  | { readonly kind: "roll-modifier"; readonly role: CombatRole; readonly roll: number }
  /** The general cannot rally his army. */
  | { readonly kind: "no-rally" };
