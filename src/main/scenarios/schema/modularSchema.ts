import { z } from "zod";
import {
  basisShape,
  markerEntry,
  typedEntry,
  resourcesSchema,
  shareSchema,
  slugSchema,
  textSchema,
  unitTypeShape,
  wholeSchema,
  positiveThousandthsSchema,
  positiveWholeSchema
} from "./coreSchema.ts";

/**
 * Milestone 3 systems: rule modules, unit types, effects,
 * sub-territories and the economy catalogues. The literal lists below must equal their copies
 * in `engine/types` (a unit test checks).
 */

export const ruleAreaNames = ["economy", "recruitment", "weather", "movement", "partition", "air"] as const;

export const rulesSchema = z
  .strictObject(Object.fromEntries(ruleAreaNames.map((area) => [area, slugSchema])) as Record<(typeof ruleAreaNames)[number], typeof slugSchema>)
  .meta({ description: "One named rule module per area. Built-in modules are listed in scenario-package.md; a scenario plugin may register more (L14)." });

export const unitOrderKindSchema = z.enum(["move", "withdraw", "replenish", "disband", "air-mission", "sack"]);
export const unitKindSchema = z.enum(["ground", "air", "general"]);
export const unitSymbolSchema = z.enum([
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
]);
export const airMissionSchema = z.enum(["raid", "patrol", "support", "recon"]);
export const terrainSchema = z.enum(["open", "mountain", "swamp"]);
const roleSchema = z.enum(["attack", "defence"]);
const signedRoll = z.number().int();

export const unitEffectSchema = z.discriminatedUnion("@type", [
  typedEntry("roll-bonus-per-points", {
    role: roleSchema,
    per: positiveWholeSchema,
    bonus: positiveWholeSchema,
    max: positiveWholeSchema,
    exceptWeather: z.array(slugSchema).default([]).meta({ description: "Weather outcomes in which the bonus does not apply." })
  }),
  markerEntry("cannot-attack-alone"),
  typedEntry("transport", { carries: positiveWholeSchema }),
  markerEntry("mobile"),
  typedEntry("raid-defence", { roll: signedRoll.negative() }),
  markerEntry("trains-in-contested"),
  typedEntry("command-bonus", { roll: positiveWholeSchema }),
  markerEntry("rally"),
  typedEntry("battle-support", { roll: positiveWholeSchema }),
  typedEntry("air-battle", { roll: positiveWholeSchema })
]);

export const buildingEffectSchema = z.discriminatedUnion("@type", [
  typedEntry("replenish-cap", { share: shareSchema }),
  typedEntry("replenish-discount", { resource: slugSchema, share: shareSchema }),
  typedEntry("rail-capacity", { units: positiveWholeSchema.meta({ description: "M3, D5: more units that may board at the capital by rail per turn." }) }),
  markerEntry("airbase"),
  markerEntry("all-weather-airbase"),
  typedEntry("defence-roll", { roll: positiveWholeSchema })
]);

const developmentEffectSchema = z.discriminatedUnion("@type", [
  typedEntry("recruit-slots", { extra: positiveWholeSchema.meta({ description: "More Recruit orders a turn in the territory, for each level." }) })
]);

const buildCostShape = {
  cost: resourcesSchema,
  turns: positiveWholeSchema.meta({ description: "Turns of progress the item needs once it heads its queue." })
};

export const modularUnitTypeSchema = z.strictObject({
  ...unitTypeShape,
  attack: wholeSchema.meta({ description: "Attack value of a full-strength unit. 0 for units that add no combat value (trucks, generals)." }),
  defence: wholeSchema.meta({ description: "Defence value of a full-strength unit." }),
  kind: unitKindSchema,
  foot: z.boolean().default(false).meta({ description: "R5: a foot unit may March across a link with no road. Absent means false." }),
  symbol: unitSymbolSchema.meta({ description: "NATO APP-6A function shown on the counter; the map package draws it." }),
  orders: z.array(unitOrderKindSchema).min(1).meta({ description: "Order kinds a unit of this type may take." }),
  effects: z.array(unitEffectSchema).default([]),
  recruit: z
    .strictObject({
      cost: resourcesSchema,
      establishment: positiveWholeSchema.meta({ description: "Men in a newly trained unit: its full strength." }),
      trainingTurns: positiveWholeSchema,
      requires: z.array(slugSchema).default([]).meta({ description: "R3: building ids the capital sub-territory needs, and development track ids the territory needs at level 1 or more in any sub-territory the recruiter holds." }),
      factionIds: z.array(slugSchema).min(1).optional().meta({ description: "Factions that may recruit the type. Absent means all." })
    })
    .optional()
    .meta({ description: "How the type is recruited. Absent means it cannot be recruited." }),
  upkeep: z.record(slugSchema, positiveThousandthsSchema).default({}).meta({ description: "Points of each resource a unit of this type costs every turn, to thousandths, at any strength. Absent means none." }),
  air: z
    .strictObject({ range: positiveWholeSchema, missions: z.array(airMissionSchema).min(1) })
    .optional()
    .meta({ description: "Range in territories and missions. Required for air types, absent otherwise (L17)." }),
  ...basisShape
});

export const subTerritorySchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  territoryId: slugSchema,
  terrain: terrainSchema,
  startHolder: slugSchema.meta({ description: "P1: holder on the start date, whatever the territory's controller." }),
  development: z.record(slugSchema, wholeSchema).default({}).meta({ description: "Starting level per development track. Missing tracks are 0." }),
  buildings: z.array(slugSchema).default([]),
  buildable: z
    .array(slugSchema)
    .meta({ description: "D4: everything the sub-territory may build: building ids, development track ids, and the improvements rail and port. There are no rule defaults (L29)." }),
  port: wholeSchema.max(2),
  ...basisShape
}).meta({ description: "A sub-territory needs sources or a note (L18). Its rail level is read from its links (D3)." });

export const subTerritoryBordersSchema = z
  .array(z.tuple([slugSchema, slugSchema]))
  .meta({ description: "Undirected sub-territory adjacency, inside and across territories. Generated from the map geometry." });

const roadLevelSchema = z.enum(["track", "main"]);
const railLevelSchema = z.enum(["single", "main"]);

/** D2: what a link has, as typed entries. No `road` entry means no road; no `rail` entry, no railway. */
const linkModifierSchema = z.discriminatedUnion("@type", [
  typedEntry("road", { level: roadLevelSchema.meta({ description: "track: an unmetalled road; main: a main road trucks can use." }) }),
  typedEntry("rail", { level: railLevelSchema.meta({ description: "single: a single-track or secondary line; main: a trunk line." }) }),
  typedEntry("pass", { name: textSchema.meta({ description: "The pass's name, shown to players." }) })
]);

export const linkSchema = z
  .strictObject({
    a: slugSchema,
    b: slugSchema,
    modifiers: z.array(linkModifierSchema).default([]),
    ...basisShape
  })
  .meta({ description: "D2: the link between two bordering sub-territories. Every border has exactly one link; each needs sources or a note (L28)." });

/** D2: what each link modifier kind does, defined by the scenario. Each kind at most once (L28). */
export const linkModifierRuleSchema = z.discriminatedUnion("@type", [
  typedEntry("road", {
    label: textSchema,
    motorLevel: roadLevelSchema.meta({ description: "R5: the road level Motor moves need." }),
    motorRange: positiveWholeSchema.meta({ description: "R5: territories a Motor move may cover." })
  }),
  typedEntry("rail", {
    label: textSchema,
    rangeByLevel: z
      .strictObject({ single: positiveWholeSchema, main: positiveWholeSchema })
      .meta({ description: "R5: rail range in territories, by the weakest rail level on the route." }),
    unitsPerLevel: positiveWholeSchema.meta({ description: "D5: units that may board at a station per turn, for each of its levels." })
  }),
  typedEntry("pass", {
    label: textSchema,
    noMotor: z.boolean().meta({ description: "R5, R6: Motor moves may not cross the link." }),
    defenderRoll: z.number().int().nonpositive().meta({ description: "R6: the attacker's roll change when every attacking ground unit crosses such a link. Stacks with dug-in." }),
    lostToFlanking: z.boolean().meta({ description: "R6: one attacking ground unit over another kind of link cancels the change." })
  })
]);

/** R7: the works a link may take, with their prices and build times. */
export const linkProjectsSchema = z.strictObject({
  "new-rail": z.strictObject(buildCostShape).meta({ description: "A new single-track line on a link with none." }),
  "rail-upgrade": z.strictObject(buildCostShape).meta({ description: "A single line upgraded to main." }),
  "road-upgrade": z.strictObject(buildCostShape).meta({ description: "A road built (to track) or upgraded (track to main)." }),
  ...basisShape
});

export const developmentSchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  resource: slugSchema,
  yieldPerLevel: positiveThousandthsSchema.meta({ description: "Points a turn for each level, to thousandths." }),
  maxLevel: positiveWholeSchema,
  cityOnly: z.boolean().default(false),
  effects: z.array(developmentEffectSchema).default([]).meta({ description: "What each level does beyond its yield." }),
  upgrade: z.strictObject(buildCostShape),
  ...basisShape
});

export const buildingSchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  ...buildCostShape,
  capitalOnly: z.boolean().default(false),
  cityOnly: z.boolean().default(false),
  upgradeOf: slugSchema.optional(),
  effects: z.array(buildingEffectSchema).default([]),
  ...basisShape
});

const improvementSchema = z.strictObject({ ...buildCostShape, maxLevel: positiveWholeSchema });

export const improvementsSchema = z.strictObject({
  rail: improvementSchema,
  port: improvementSchema,
  railDamageOnContest: wholeSchema.meta({ description: "$8: rail levels lost in attacker-held sub-territories when a territory becomes contested." }),
  ...basisShape
});

export const recruitmentSchema = z.strictObject({
  maxPerTerritory: positiveWholeSchema,
  replenishCostShare: shareSchema.meta({ description: "Replenish price per value point, as a share of the Recruit price per point." }),
  replenishShare: shareSchema.meta({ description: "Most men a Replenish order restores per turn, as a share of establishment." }),
  ...basisShape
});

export const upkeepSchema = z.strictObject({
  maxLossShare: shareSchema.meta({ description: "When upkeep cannot be paid: most men a unit loses in a turn, as a share of full strength." }),
  minStrengthShare: shareSchema.meta({ description: "When upkeep cannot be paid: no unit falls below this share of full strength." }),
  ...basisShape
});

export const movementSchema = z.strictObject({
  landingsPerPortLevel: positiveWholeSchema,
  ...basisShape
});
