import { z } from "zod";

/**
 * The core of the scenario schema. Imports only zod (and sibling schema
 * files by their `.ts` path), so `npm run spec:build` can run it directly under Node.
 */

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Ids are lowercase kebab-case.")
  .meta({ description: "Stable kebab-case identifier. Never shown to players." });

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colors are #rrggbb hex values.");
export const wholeSchema = z.number().int().nonnegative();
export const positiveWholeSchema = z.number().int().positive();
/** Points of a resource, to thousandths of a point. */
export const positiveThousandthsSchema = z.number().positive().multipleOf(0.001);
export const shareSchema = z.number().gte(0).lte(1);
export const textSchema = z.string().min(1);

export const citationSchema = z.strictObject({ sourceId: slugSchema, reference: textSchema.optional() });

/**
 * Where a block's numbers come from: every number in data has a source or a design note. The
 * same two fields, `sources` and `note`, are used on every block and entry that carries numbers.
 */
export const basisShape = {
  sources: z.array(citationSchema).default([]).meta({ description: "Citations for the numbers." }),
  note: textSchema.optional().meta({ description: "Design note for numbers no source gives." })
};

/**
 * D1: a typed entry, `{"@type": kind, "@data": {...}}`. Every discriminated union in the
 * scenario and map JSON is written this way. Parsing reads it as the engine's `{kind, ...data}`,
 * so the published (input) schema shows `@type`/`@data` and the engine types stay as they are.
 */
export function typedEntry<const Kind extends string, Shape extends z.ZodRawShape>(kind: Kind, shape: Shape) {
  return z
    .strictObject({ "@type": z.literal(kind), "@data": z.strictObject(shape) })
    .transform(({ "@data": data }) => ({ kind, ...data }));
}

/** D1: a typed entry that carries no data; `@data` may be left out or empty. */
export function markerEntry<const Kind extends string>(kind: Kind) {
  return z
    .strictObject({ "@type": z.literal(kind), "@data": z.strictObject({}).optional() })
    .transform(() => ({ kind }));
}

/** D1: the `@type` values of a union of typed entries, in schema order. */
export function entryKinds(union: { readonly options: readonly { readonly in: { readonly shape: { readonly "@type": { readonly value: string } } } }[] }): string[] {
  return union.options.map((option) => option.in.shape["@type"].value);
}

/** An amount of each resource, keyed by resource id. */
export const resourcesSchema = z
  .record(slugSchema, wholeSchema)
  .meta({ description: "Whole amounts keyed by resource id. A missing resource is zero." });

const controlSchema = z.discriminatedUnion("@type", [
  typedEntry("controlled", { factionId: slugSchema }),
  typedEntry("contested", {
    factionIds: z.array(slugSchema).min(2).meta({ description: "Factions with a meaningful presence. At least two." })
  })
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
    diggingIn: z
      .strictObject({ perTurn: positiveWholeSchema, max: positiveWholeSchema })
      .meta({ description: "Defence roll bonus a territory gains, up to max, each turn its holder keeps it without a battle while at least one of the holder's armies there entrenches (is healthy and has no move order)." }),
    demoralizationFactor: z
      .number()
      .gt(0)
      .lte(1)
      .meta({ description: "Multiplier applied to a demoralized army's attack and defence." })
  })
  .meta({ description: "Digging in and demoralization." });

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

const connectionShape = {
  between: z.tuple([slugSchema, slugSchema]),
  label: textSchema.optional()
};

/** D1: a land or sea connection, as a typed entry. `extra` adds fields to both kinds. */
export function connectionSchema<Extra extends z.ZodRawShape>(extra: Extra) {
  return z.discriminatedUnion("@type", [
    typedEntry("land", { ...connectionShape, ...extra }),
    typedEntry("sea", { ...connectionShape, ...extra })
  ]);
}

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
  sources: z.array(citationSchema).default([]).meta({ description: "At least one in an authored scenario; the shipped copy leaves them out." }),
  historicalNote: textSchema.optional()
});

export const sourceSchema = z.strictObject({ id: slugSchema, title: textSchema, url: z.url().optional() });
