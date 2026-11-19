import { z } from "zod";

/**
 * Parts of the scenario schema that every ruleset shares. Imports only zod (and sibling schema
 * files by their `.ts` path), so `npm run spec:build` can run it directly under Node.
 */

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Ids are lowercase kebab-case.")
  .meta({ description: "Stable kebab-case identifier. Never shown to players." });

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors are #rrggbb hex values.");
export const wholeSchema = z.number().int().nonnegative();
export const positiveWholeSchema = z.number().int().positive();
export const shareSchema = z.number().gte(0).lte(1);
export const textSchema = z.string().min(1);

export const citationSchema = z.strictObject({ sourceId: slugSchema, reference: textSchema.optional() });

/** An amount of each resource, keyed by resource id. */
export const resourcesSchema = z
  .record(slugSchema, wholeSchema)
  .meta({ description: "Whole amounts keyed by resource id. A missing resource is zero." });

const controlSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("controlled"), factionId: slugSchema }),
  z.strictObject({
    kind: z.literal("contested"),
    factionIds: z.array(slugSchema).min(2).meta({ description: "Factions with a meaningful presence. At least two." })
  })
]);

/** The seven battle results. Must equal `battleResults` in `engine/types` (a unit test checks). */
export const battleResultSchema = z.enum([
  "attacker-eliminated",
  "attacker-attrition",
  "attacker-demoralized",
  "both-demoralized",
  "defender-demoralized",
  "defender-exchange",
  "defender-eliminated"
]);

export const factionModifierSchema = z.strictObject({
  id: slugSchema,
  name: textSchema.meta({ description: "Player-facing name shown in battle breakdowns." }),
  factionId: slugSchema,
  when: z
    .enum(["holds-controlled-city"])
    .meta({ description: "holds-controlled-city: the battle territory has a city the faction controlled at the start of the turn." }),
  attack: wholeSchema.optional().meta({ description: "Roll bonus when the faction attacks. Defaults to 0." }),
  defence: wholeSchema.optional().meta({ description: "Roll bonus when the faction defends. Defaults to 0." })
});

export const combatSchema = z
  .strictObject({
    table: z
      .array(z.array(battleResultSchema).length(7).meta({ description: "Results for modified rolls 0 to 6." }))
      .length(7)
      .meta({ description: "Seven odds columns: below 1:1, then 1:1 to 6:1. Each lists the result for modified rolls 0 to 6." }),
    belowOneToOne: z
      .strictObject({ kind: z.literal("halving"), rollPenalty: wholeSchema })
      .meta({ description: "Below 1:1 the attacker's roll takes rollPenalty for each halving of the odds." }),
    diggingIn: z
      .strictObject({ perTurn: positiveWholeSchema, max: positiveWholeSchema })
      .meta({ description: "Defence roll bonus a territory gains, up to max, each turn its holder keeps it without a battle while at least one of the holder's armies there entrenches (is healthy and has no move order)." }),
    demoralizationFactor: z
      .number()
      .gt(0)
      .lte(1)
      .meta({ description: "Multiplier applied to a demoralized army's attack and defence." }),
    factionModifiers: z.array(factionModifierSchema).meta({ description: "Named roll modifiers for particular factions." })
  })
  .meta({ description: "Tunable numbers of the d6 battle rules (the d6-table dice module)." });

export const victorySchema = z.strictObject({
  territoryShare: z.number().gt(0).lte(1),
  cityShare: z.number().gt(0).lte(1),
  tieBreak: z
    .array(z.enum(["cities", "territories"]))
    .min(1)
    .meta({ description: "Order in which qualifying factions are compared. A remaining tie is a shared victory." })
});

export const factionShape = {
  id: slugSchema,
  name: textSchema,
  abbreviation: z.string().min(1).max(4),
  color: colorSchema,
  motivation: textSchema,
  defaultActor: z.enum(["local-human", "computer"]),
  objectiveTerritoryIds: z.array(slugSchema),
  aiProfile: slugSchema.meta({ description: "The AI profile (ai.profiles) the computer player uses for this faction." }),
  briefing: z
    .strictObject({
      objective: textSchema.meta({ description: "What the faction is fighting for and how it wins. Shown in the Briefing." }),
      firstTurnHint: textSchema.meta({ description: "Turn 1 intelligence report that ends in a choice, never a move to copy. Shown in the Briefing on turn 1." })
    })
    .meta({ description: "Player-facing briefing text for this faction." })
};

export const territoryShape = {
  id: slugSchema,
  name: textSchema,
  countsForVictory: z.boolean(),
  initialControl: controlSchema,
  isolated: z
    .strictObject({ reason: textSchema })
    .optional()
    .meta({ description: "Required when a territory deliberately has no connections." })
};

export const connectionShape = {
  between: z.tuple([slugSchema, slugSchema]),
  kind: z.enum(["land", "sea"]),
  label: textSchema.optional()
};

export const cityShape = {
  id: slugSchema,
  name: textSchema,
  territoryId: slugSchema,
  countsForVictory: z.boolean(),
  initialController: slugSchema.optional()
};

export const unitTypeShape = {
  id: slugSchema,
  name: textSchema,
  attack: positiveWholeSchema.meta({ description: "Attack value of a full-strength army of this type." }),
  defence: positiveWholeSchema.meta({ description: "Defence value of a full-strength army of this type." })
};

export const unitSchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  designation: z
    .string()
    .regex(/^[A-Z0-9]{1,4}$/)
    .optional()
    .meta({ description: "Short counter label, up to 4 capitals or digits. Derived from the name when absent." }),
  factionId: slugSchema,
  type: slugSchema,
  formationKind: z.enum(["regiment", "battalion", "column", "security", "other"]),
  strength: positiveWholeSchema.meta({ description: "Men at the scenario snapshot. At most fullStrength." }),
  fullStrength: positiveWholeSchema.meta({ description: "Men at full establishment; the type's values apply at this strength." }),
  territoryId: slugSchema,
  cityId: slugSchema.optional(),
  sources: z.array(citationSchema).min(1),
  historicalNote: textSchema.optional()
});

export const sourceSchema = z.strictObject({ id: slugSchema, title: textSchema, url: z.url().optional() });
