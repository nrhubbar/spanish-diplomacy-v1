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

/** The seven battle results. Must equal `battleResults` in `engine/types.ts` (a unit test checks). */
export const battleResultSchema = z.enum([
  "attacker-eliminated",
  "attacker-attrition",
  "attacker-demoralized",
  "both-demoralized",
  "defender-demoralized",
  "defender-exchange",
  "defender-eliminated"
]);

const combatValueSchema = z.number().int().positive();
const rollBonusSchema = z.number().int().nonnegative();

const combatSchema = z
  .strictObject({
    table: z
      .array(z.array(battleResultSchema).length(7).meta({ description: "Results for modified rolls 0 to 6." }))
      .length(7)
      .meta({ description: "Seven odds columns: below 1:1, then 1:1 to 6:1. Each lists the result for modified rolls 0 to 6." }),
    belowOneToOne: z
      .strictObject({ kind: z.literal("halving"), rollPenalty: rollBonusSchema })
      .meta({ description: "Below 1:1 the attacker's roll takes rollPenalty for each halving of the odds." }),
    diggingIn: z
      .strictObject({ perTurn: combatValueSchema, max: combatValueSchema })
      .meta({ description: "Defence roll bonus a territory gains, up to max, each turn its holder keeps it without a battle while at least one of the holder's armies there entrenches (is healthy and has no move order)." }),
    demoralizationFactor: z
      .number()
      .gt(0)
      .lte(1)
      .meta({ description: "Multiplier applied to a demoralized army's attack and defence." }),
    factionModifiers: z
      .array(
        z.strictObject({
          id: slugSchema,
          name: z.string().min(1).meta({ description: "Player-facing name shown in battle breakdowns." }),
          factionId: slugSchema,
          when: z
            .enum(["holds-controlled-city"])
            .meta({ description: "holds-controlled-city: the battle territory has a city the faction controlled at the start of the turn." }),
          attack: rollBonusSchema.optional().meta({ description: "Roll bonus when the faction attacks. Defaults to 0." }),
          defence: rollBonusSchema.optional().meta({ description: "Roll bonus when the faction defends. Defaults to 0." })
        })
      )
      .meta({ description: "Named roll modifiers for particular factions." })
  })
  .meta({ description: "Tunable numbers of the m2-strength battle rules." });

export const scenarioSchema = z
  .strictObject({
    $schema: z.string().optional(),
    specVersion: z.literal(1),
    id: slugSchema,
    name: z.string().min(1),
    snapshotLabel: z.string().min(1).meta({ description: "Starting date or moment, shown on setup and turn 1." }),
    ruleset: z.literal("m2-strength").meta({ description: "Rules the engine applies. Unknown rulesets fail to load." }),
    map: z.string().min(1).meta({ description: "Path to the map package, relative to this file." }),
    victory: z.strictObject({
      territoryShare: z.number().gt(0).lte(1),
      cityShare: z.number().gt(0).lte(1),
      tieBreak: z
        .array(z.enum(["cities", "territories"]))
        .min(1)
        .meta({ description: "Order in which qualifying factions are compared. A remaining tie is a shared victory." })
    }),
    combat: combatSchema,
    unitTypes: z
      .array(
        z.strictObject({
          id: slugSchema,
          name: z.string().min(1),
          attack: combatValueSchema.meta({ description: "Attack value of a full-strength army of this type." }),
          defence: combatValueSchema.meta({ description: "Defence value of a full-strength army of this type." })
        })
      )
      .min(1),
    factions: z
      .array(
        z.strictObject({
          id: slugSchema,
          name: z.string().min(1),
          abbreviation: z.string().min(1).max(4),
          color: colorSchema,
          motivation: z.string().min(1),
          defaultActor: z.enum(["local-human", "computer"]),
          objectiveTerritoryIds: z.array(slugSchema),
          briefing: z
            .strictObject({
              objective: z.string().min(1).meta({ description: "What the faction is fighting for and how it wins. Shown in the Briefing." }),
              firstTurnHint: z
                .string()
                .min(1)
                .meta({ description: "Turn 1 intelligence report that ends in a choice, never a move to copy. Shown in the Briefing on turn 1." })
            })
            .meta({ description: "Player-facing briefing text for this faction." })
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
        designation: z
          .string()
          .regex(/^[A-Z0-9]{1,4}$/)
          .optional()
          .meta({ description: "Short counter label, up to 4 capitals or digits. Derived from the name when absent." }),
        factionId: slugSchema,
        type: slugSchema,
        formationKind: z.enum(["regiment", "battalion", "column", "security", "other"]),
        strength: z.number().int().positive().meta({ description: "Men at the scenario snapshot. At most fullStrength." }),
        fullStrength: z.number().int().positive().meta({ description: "Men at full establishment; the type's values apply at this strength." }),
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
