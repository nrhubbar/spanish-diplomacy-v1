import { z } from "zod";
import {
  cityShape,
  combatSchema,
  connectionShape,
  factionShape,
  resourcesSchema,
  slugSchema,
  sourceSchema,
  territoryShape,
  textSchema,
  unitSchema,
  unitTypeShape,
  victorySchema
} from "./coreSchema.ts";
import {
  buildingSchema,
  developmentSchema,
  improvementsSchema,
  modularUnitTypeSchema,
  movementSchema,
  recruitmentSchema,
  rulesSchema,
  subTerritoryBordersSchema,
  subTerritorySchema
} from "./modularSchema.ts";
import { aiSchema, airSchema, calendarSchema, d20Schema, generalsSchema, weatherSchema } from "./systemsSchema.ts";

/**
 * Scenario package schema (spec version 2). These files are the single source of truth for the
 * published `scenario.schema.json`; they import nothing but zod so the schema generator can
 * run them directly under Node. The two rulesets are separate variants, so the JSON Schema
 * states which blocks each one takes.
 */

export { battleResultSchema, slugSchema } from "./coreSchema.ts";

const sharedShape = {
  $schema: z.string().optional(),
  specVersion: z.literal(2),
  id: slugSchema,
  name: textSchema,
  snapshotLabel: textSchema.meta({ description: "Starting date or moment, shown on setup and turn 1." }),
  map: textSchema.meta({ description: "Path to the map package, relative to this file." }),
  victory: victorySchema,
  combat: combatSchema,
  ai: aiSchema,
  sources: z.array(sourceSchema)
};

const m2StrengthSchema = z
  .strictObject({
    ...sharedShape,
    ruleset: z.literal("m2-strength").meta({ description: "The Milestone 2 preset: the d6 table and none of the Milestone 3 systems." }),
    units: z.array(unitSchema),
    unitTypes: z.array(z.strictObject(unitTypeShape)).min(1),
    factions: z.array(z.strictObject(factionShape)).min(2),
    territories: z.array(z.strictObject(territoryShape)).min(2),
    connections: z.array(z.strictObject(connectionShape)),
    cities: z.array(z.strictObject(cityShape))
  })
  .meta({ title: "m2-strength scenario" });

const m3ModularSchema = z
  .strictObject({
    ...sharedShape,
    ruleset: z.literal("m3-modular").meta({ description: "Rules chosen per area by the rules object." }),
    rules: rulesSchema,
    units: z.array(
      unitSchema.extend({
        generalId: slugSchema.optional().meta({ description: "U5: the roster general this unit is. Required exactly on units of a general type (L21)." })
      })
    ),
    unitTypes: z.array(modularUnitTypeSchema).min(1),
    factions: z
      .array(
        z.strictObject({
          ...factionShape,
          startingStock: resourcesSchema.optional().meta({ description: "$7: treasury on turn 1. Required with an economy module (L15)." }),
          seatTerritoryId: slugSchema.optional().meta({ description: "D7: where replacement generals appear. Required with generals (L21)." })
        })
      )
      .min(2),
    territories: z
      .array(
        z.strictObject({
          ...territoryShape,
          capitalSubTerritoryId: slugSchema.optional().meta({ description: "W3: the capital sub-territory. Required with sub-territories (L16)." }),
          weatherZone: slugSchema.optional().meta({ description: "T2: climate zone. Required with a weather module (L20)." })
        })
      )
      .min(2),
    connections: z.array(
      z.strictObject({
        ...connectionShape,
        entry: z
          .tuple([slugSchema, slugSchema])
          .optional()
          .meta({ description: "P8: sub-territory entered on each side, in between order. Required with sub-territories (L19)." })
      })
    ),
    cities: z.array(
      z.strictObject({
        ...cityShape,
        subTerritoryId: slugSchema.optional().meta({ description: "The sub-territory the city stands in. Required with sub-territories (L16)." })
      })
    ),
    subTerritories: z.array(subTerritorySchema).default([]),
    subTerritoryBorders: subTerritoryBordersSchema.default([]),
    resources: z.array(z.strictObject({ id: slugSchema, name: textSchema })).default([]),
    development: z.array(developmentSchema).default([]),
    buildings: z.array(buildingSchema).default([]),
    improvements: improvementsSchema.optional(),
    recruitment: recruitmentSchema.optional(),
    movement: movementSchema.optional(),
    d20: d20Schema.optional(),
    weather: weatherSchema.optional(),
    calendar: calendarSchema.optional(),
    air: airSchema.optional(),
    generals: generalsSchema.optional()
  })
  .meta({ title: "m3-modular scenario" });

export const scenarioSchema = z
  .discriminatedUnion("ruleset", [m2StrengthSchema, m3ModularSchema])
  .meta({ title: "Spanish Diplomacy scenario package", description: "Rules data interpreted by the game engine." });

export type ScenarioDocument = z.infer<typeof scenarioSchema>;
export type ModularScenarioDocument = z.infer<typeof m3ModularSchema>;
