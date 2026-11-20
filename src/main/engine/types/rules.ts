/**
 * Rulesets and rule modules (tasks E2, E5). A scenario names a ruleset; `m3-modular` adds a
 * `rules` object that picks one named module per area. `m2-strength` is a preset of the same
 * areas. The scenario schema repeats these lists as literals (it may import only zod); a unit
 * test keeps the copies identical.
 */

export const supportedRulesets = ["m2-strength", "m3-modular"] as const;
export type RulesetId = (typeof supportedRulesets)[number];

/** The areas a `rules` object chooses a module for, in a fixed order. */
export const ruleAreas = ["dice", "economy", "recruitment", "weather", "movement", "partition", "air"] as const;
export type RuleArea = (typeof ruleAreas)[number];

/**
 * The engine's own modules per area. The first of each list is the `m2-strength` behaviour.
 * A scenario plugin may register more names for an area (CP3, `engine/modules.ts`).
 */
export const builtInModules = {
  dice: ["d6-table", "d20-graded"],
  economy: ["none", "development"],
  recruitment: ["none", "buildings"],
  weather: ["none", "seasonal-zones"],
  movement: ["single-step", "allowance"],
  partition: ["none", "provinces"],
  air: ["none", "missions"]
} as const satisfies Readonly<Record<RuleArea, readonly string[]>>;

/** One module id per area. Ids are kebab-case names; plugins may add names. */
export type RulesSelection = { readonly [Area in RuleArea]: string };

/** The `m2-strength` preset: today's d6 rules and none of the Milestone 3 systems (declog D3). */
export const m2StrengthRules: RulesSelection = {
  air: "none",
  dice: "d6-table",
  economy: "none",
  movement: "single-step",
  partition: "none",
  recruitment: "none",
  weather: "none"
};

/** Every order kind (E8). Entrench, Rest and the contested Attack stay derived, never submitted. */
export const orderKinds = ["move", "withdraw", "replenish", "recruit", "build", "air-mission", "sack"] as const;
export type OrderKind = (typeof orderKinds)[number];

/** Order kinds a unit type may allow; Recruit and Build are given to sites, not units. */
export const unitOrderKinds = ["move", "withdraw", "replenish", "air-mission", "sack"] as const;
export type UnitOrderKind = (typeof unitOrderKinds)[number];

/** W5: what kind of piece a unit type is. */
export const unitKinds = ["ground", "air", "general"] as const;
export type UnitKind = (typeof unitKinds)[number];

/** A unit type's symbol, named by its NATO APP-6A function. The map package draws it. */
export const unitSymbols = [
  "infantry",
  "militia",
  "security",
  "artillery",
  "cavalry",
  "armour",
  "transport",
  "air-defence",
  "fixed-wing",
  "headquarters"
] as const;
export type UnitSymbol = (typeof unitSymbols)[number];

/** U2: the missions an aircraft may fly. */
export const airMissionKinds = ["raid", "intercept", "support", "recon"] as const;
export type AirMissionKind = (typeof airMissionKinds)[number];

/** Sub-territory terrain. Mountain and swamp cost one move on the way in (M1). */
export const terrainKinds = ["open", "mountain", "swamp"] as const;
export type TerrainKind = (typeof terrainKinds)[number];
