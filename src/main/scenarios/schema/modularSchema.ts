import { z } from "zod";
import {
  citationSchema,
  resourcesSchema,
  shareSchema,
  slugSchema,
  textSchema,
  unitTypeShape,
  wholeSchema,
  positiveWholeSchema
} from "./coreSchema.ts";

/**
 * Milestone 3 systems of the `m3-modular` ruleset: rule modules, unit types, effects,
 * sub-territories and the economy catalogues. The literal lists below must equal their copies
 * in `engine/types` (a unit test checks).
 */

export const ruleAreaNames = ["dice", "economy", "recruitment", "weather", "movement", "partition", "air"] as const;

export const rulesSchema = z
  .strictObject(Object.fromEntries(ruleAreaNames.map((area) => [area, slugSchema])) as Record<(typeof ruleAreaNames)[number], typeof slugSchema>)
  .meta({ description: "One named rule module per area. Built-in modules are listed in scenario-package.md; a scenario plugin may register more (L14)." });

export const unitOrderKindSchema = z.enum(["move", "withdraw", "replenish", "air-mission", "sack"]);
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
export const airMissionSchema = z.enum(["raid", "intercept", "support", "recon"]);
export const terrainSchema = z.enum(["open", "mountain", "swamp"]);
const roleSchema = z.enum(["attack", "defence"]);
const signedRoll = z.number().int();

export const unitEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("roll-bonus-per-points"),
    role: roleSchema,
    per: positiveWholeSchema,
    bonus: positiveWholeSchema,
    max: positiveWholeSchema,
    exceptWeather: z.array(slugSchema).default([]).meta({ description: "Weather outcomes in which the bonus does not apply." })
  }),
  z.strictObject({ kind: z.literal("cannot-attack-alone") }),
  z.strictObject({ kind: z.literal("transport"), carries: positiveWholeSchema }),
  z.strictObject({ kind: z.literal("mobile") }),
  z.strictObject({ kind: z.literal("raid-defence"), roll: signedRoll.negative() }),
  z.strictObject({ kind: z.literal("trains-in-contested") }),
  z.strictObject({ kind: z.literal("command-bonus"), roll: positiveWholeSchema }),
  z.strictObject({ kind: z.literal("rally") }),
  z.strictObject({ kind: z.literal("battle-support"), roll: positiveWholeSchema })
]);

export const buildingEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("recruit-slots"), extra: positiveWholeSchema }),
  z.strictObject({ kind: z.literal("replenish-rate"), share: shareSchema }),
  z.strictObject({ kind: z.literal("replenish-cap"), share: shareSchema }),
  z.strictObject({ kind: z.literal("rail-departures"), extra: positiveWholeSchema }),
  z.strictObject({ kind: z.literal("airbase") }),
  z.strictObject({ kind: z.literal("all-weather-airbase") }),
  z.strictObject({ kind: z.literal("defence-roll"), roll: positiveWholeSchema })
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
  symbol: unitSymbolSchema.meta({ description: "NATO APP-6A function shown on the counter; the map package draws it." }),
  orders: z.array(unitOrderKindSchema).min(1).meta({ description: "Order kinds a unit of this type may take." }),
  effects: z.array(unitEffectSchema).default([]),
  recruit: z
    .strictObject({
      cost: resourcesSchema,
      establishment: positiveWholeSchema.meta({ description: "Men in a newly trained unit: its full strength." }),
      trainingTurns: positiveWholeSchema,
      requires: z.array(slugSchema).default([]).meta({ description: "Buildings the capital sub-territory needs (R3)." }),
      factionIds: z.array(slugSchema).min(1).optional().meta({ description: "Factions that may recruit the type. Absent means all." })
    })
    .optional()
    .meta({ description: "How the type is recruited. Absent means it cannot be recruited." }),
  air: z
    .strictObject({ range: positiveWholeSchema, missions: z.array(airMissionSchema).min(1) })
    .optional()
    .meta({ description: "Range in territories and missions. Required for air types, absent otherwise (L17)." }),
  basis: textSchema.optional().meta({ description: "Design note or source summary for the type's numbers." })
});

export const subTerritorySchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  territoryId: slugSchema,
  terrain: terrainSchema,
  startHolder: slugSchema.meta({ description: "P1: holder on the start date, whatever the territory's controller." }),
  development: z.record(slugSchema, wholeSchema).default({}).meta({ description: "Starting level per development track. Missing tracks are 0." }),
  buildings: z.array(slugSchema).default([]),
  rail: wholeSchema.max(3),
  port: wholeSchema.max(2),
  sources: z.array(citationSchema).default([]),
  note: textSchema.optional().meta({ description: "Design note for numbers no source gives. A sub-territory needs sources or a note (L18)." })
});

export const subTerritoryBordersSchema = z
  .array(z.tuple([slugSchema, slugSchema]))
  .meta({ description: "Undirected sub-territory adjacency, inside and across territories. Generated from the map geometry." });

export const developmentSchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  resource: slugSchema,
  yieldPerLevel: positiveWholeSchema,
  maxLevel: positiveWholeSchema,
  cityOnly: z.boolean().default(false),
  upgrade: z.strictObject(buildCostShape)
});

export const buildingSchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  ...buildCostShape,
  capitalOnly: z.boolean().default(false),
  cityOnly: z.boolean().default(false),
  upgradeOf: slugSchema.optional(),
  effects: z.array(buildingEffectSchema).default([])
});

const improvementSchema = z.strictObject({ ...buildCostShape, maxLevel: positiveWholeSchema });

export const improvementsSchema = z.strictObject({
  rail: improvementSchema,
  port: improvementSchema,
  railDamageOnContest: wholeSchema.meta({ description: "$8: rail levels lost in attacker-held sub-territories when a territory becomes contested." })
});

export const recruitmentSchema = z.strictObject({
  maxPerTerritory: positiveWholeSchema,
  replenishCostShare: shareSchema.meta({ description: "Replenish price per value point, as a share of the Recruit price per point." }),
  replenishShare: shareSchema.meta({ description: "Most men a Replenish order restores per turn, as a share of establishment." })
});

export const movementSchema = z.strictObject({
  landingsPerPortLevel: positiveWholeSchema,
  railRangePerLevel: positiveWholeSchema
});
