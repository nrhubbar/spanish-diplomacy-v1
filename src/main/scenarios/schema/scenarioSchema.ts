import { z } from "zod";

/**
 * Scenario package schema (spec version 1). This file is the single source of truth for the
 * published `scenario.schema.json`; it deliberately imports nothing but zod so the schema
 * generator can run it directly under Node.
 */

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Ids are lowercase kebab-case.")
  .meta({ description: "Stable kebab-case identifier. Never shown to players." });

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors are #rrggbb hex values.");

const controlSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("controlled"), factionId: slugSchema }),
  z.strictObject({
    kind: z.literal("contested"),
    factionIds: z.array(slugSchema).min(2).meta({ description: "Factions with a meaningful presence. At least two." })
  })
]);

export const scenarioSchema = z
  .strictObject({
    $schema: z.string().optional(),
    specVersion: z.literal(1),
    id: slugSchema,
    name: z.string().min(1),
    snapshotLabel: z.string().min(1).meta({ description: "Starting date or moment, shown on setup and turn 1." }),
    ruleset: z.literal("m2-movement").meta({ description: "Rules the engine applies. Unknown rulesets fail to load." }),
    map: z.string().min(1).meta({ description: "Path to the map package, relative to this file." }),
    victory: z.strictObject({
      territoryShare: z.number().gt(0).lte(1),
      cityShare: z.number().gt(0).lte(1),
      tieBreak: z
        .array(z.enum(["cities", "territories"]))
        .min(1)
        .meta({ description: "Order in which qualifying factions are compared. A remaining tie is a shared victory." })
    }),
    unitTypes: z.array(z.strictObject({ id: slugSchema, name: z.string().min(1) })).min(1),
    factions: z
      .array(
        z.strictObject({
          id: slugSchema,
          name: z.string().min(1),
          abbreviation: z.string().min(1).max(4),
          color: colorSchema,
          motivation: z.string().min(1),
          defaultActor: z.enum(["local-human", "computer"]),
          objectiveTerritoryIds: z.array(slugSchema)
        })
      )
      .min(2),
    territories: z
      .array(
        z.strictObject({
          id: slugSchema,
          name: z.string().min(1),
          countsForVictory: z.boolean(),
          initialControl: controlSchema,
          isolated: z
            .strictObject({ reason: z.string().min(1) })
            .optional()
            .meta({ description: "Required when a territory deliberately has no connections." })
        })
      )
      .min(2),
    connections: z.array(
      z.strictObject({
        between: z.tuple([slugSchema, slugSchema]),
        kind: z.enum(["land", "sea"]),
        label: z.string().min(1).optional()
      })
    ),
    cities: z.array(
      z.strictObject({
        id: slugSchema,
        name: z.string().min(1),
        territoryId: slugSchema,
        countsForVictory: z.boolean(),
        initialController: slugSchema.optional()
      })
    ),
    units: z.array(
      z.strictObject({
        id: slugSchema,
        name: z.string().min(1),
        factionId: slugSchema,
        type: slugSchema,
        formationKind: z.enum(["regiment", "battalion", "column", "security", "other"]),
        approximateStrength: z
          .number()
          .int()
          .positive()
          .optional()
          .meta({ description: "Display-only. Has no rules effect under m2-movement." }),
        territoryId: slugSchema,
        cityId: slugSchema.optional(),
        sources: z.array(z.strictObject({ sourceId: slugSchema, reference: z.string().min(1).optional() })).min(1),
        historicalNote: z.string().min(1).optional()
      })
    ),
    sources: z.array(z.strictObject({ id: slugSchema, title: z.string().min(1), url: z.url().optional() }))
  })
  .meta({ title: "Spanish Diplomacy scenario package", description: "Rules data interpreted by the game engine." });

export type ScenarioDocument = z.infer<typeof scenarioSchema>;
