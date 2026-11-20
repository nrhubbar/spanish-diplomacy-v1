import { z } from "zod";
import { basisShape, citationSchema, factionModifierSchema, positiveWholeSchema, shareSchema, slugSchema, textSchema, wholeSchema } from "./coreSchema.ts";

/**
 * Milestone 3 systems with their own blocks: the d20 battle rules, weather, the calendar, air,
 * generals, and the computer players' profiles. Literal lists must equal their copies in
 * `engine/types` (a unit test checks).
 */

const signedRoll = z.number().int();
const lossPercentSchema = z
  .union([z.literal(0), z.literal(10), z.literal(20), z.literal(35), z.literal(100)])
  .meta({ description: "Share of each army's men lost, in percent: 0, the 10, 20 and 35 steps, or 100 (destroyed)." });
const demoralizedSchema = z.enum(["none", "half", "all"]);

export const gradeSchema = z.strictObject({
  id: slugSchema,
  name: textSchema,
  attacker: z.strictObject({ lossPercent: lossPercentSchema, demoralized: demoralizedSchema }),
  defender: z.strictObject({
    lossPercent: lossPercentSchema,
    demoralized: demoralizedSchema,
    weakestDestroyed: z.boolean().default(false)
  }),
  ground: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal("all")]).meta({ description: "P4: sub-territories that change hands." })
});

export const d20Schema = z
  .strictObject({
    grades: z.array(gradeSchema).min(1).meta({ description: "D2: the grade catalogue." }),
    table: z
      .array(z.array(slugSchema).length(21).meta({ description: "Grade ids for modified scores 0 to 20." }))
      .length(7)
      .meta({ description: "D1: seven odds columns (below 1:1, then 1:1 to 6:1) by 21 modified scores." }),
    modifiers: z.strictObject({
      worksPerTurn: positiveWholeSchema,
      worksMax: positiveWholeSchema,
      belowOneToOnePenalty: wholeSchema,
      barricades: wholeSchema,
      fatigued: signedRoll.nonpositive(),
      amphibious: signedRoll.nonpositive()
    }),
    fatigue: z.strictObject({ fatiguedLevel: positiveWholeSchema, demoralizedLevel: positiveWholeSchema }),
    breakUpShare: shareSchema.meta({ description: "D6: a unit below this share of its full strength is destroyed." }),
    factionModifiers: z.array(factionModifierSchema).default([]),
    ...basisShape
  })
  .meta({ description: "The d20 battle rules (the d20-graded dice module)." });

const monthSchema = z.number().int().min(1).max(12);

export const weatherEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("blocks-digging-in") }),
  z.strictObject({ kind: z.literal("grounds-aircraft") }),
  z.strictObject({ kind: z.literal("movement-penalty"), amount: positiveWholeSchema }),
  z.strictObject({ kind: z.literal("frostbite"), share: shareSchema }),
  z.strictObject({ kind: z.literal("closes-sea"), months: z.array(monthSchema).min(1) })
]);

const bandSchema = z.strictObject({ outcome: slugSchema, upTo: z.number().int().min(1).max(20) });

export const weatherSchema = z
  .strictObject({
    outcomes: z.array(
      z.strictObject({ id: slugSchema, name: textSchema, attackRoll: signedRoll.nonpositive(), effects: z.array(weatherEffectSchema).default([]) })
    ),
    seasons: z.array(z.strictObject({ id: slugSchema, name: textSchema, months: z.array(monthSchema).min(1) })).min(1),
    zones: z
      .array(
        z.strictObject({
          id: slugSchema,
          name: textSchema,
          coastal: z.boolean(),
          tables: z.record(slugSchema, z.array(bandSchema).min(1)).meta({ description: "Per season: bands from the best weather to the worst, the last ending at 20." })
        })
      )
      .min(1),
    ...basisShape
  })
  .meta({ description: "T2: one d20 roll a turn, read against each zone's seasonal table." });

export const calendarSchema = z.strictObject({
  start: z.strictObject({ year: z.number().int(), month: monthSchema, half: z.enum(["early", "late"]) }),
  turnsPerYear: z.literal(24),
  ...basisShape
});

export const raidOutcomeSchema = z.enum(["air-eliminated", "nothing-hit", "income-cut", "building-hit"]);

export const airSchema = z.strictObject({
  raidTable: z.array(z.strictObject({ outcome: raidOutcomeSchema, upTo: z.number().int().min(1).max(20) })).min(1),
  interceptRoll: signedRoll.negative(),
  reconTurns: positiveWholeSchema,
  generalDeathRoll: z.number().int().min(0).max(20).optional().meta({ description: "U5: a general whose army is destroyed or routed dies on a d20 at or under this." }),
  ...basisShape
});

export const traitEffectSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("roll-modifier"), role: z.enum(["attack", "defence"]), roll: signedRoll }),
  z.strictObject({ kind: z.literal("no-rally") })
]);

export const generalsSchema = z.strictObject({
  traits: z.array(z.strictObject({ id: slugSchema, name: textSchema, effects: z.array(traitEffectSchema).min(1) })),
  roster: z
    .array(z.strictObject({ id: slugSchema, name: textSchema, factionId: slugSchema, trait: slugSchema, sources: z.array(citationSchema).min(1) }))
    .meta({ description: "U5: each faction's commanders in roster order, 3 to 5 per faction (L21)." }),
  ...basisShape
});

const weight = z.number();

export const aiSchema = z
  .strictObject({
    blunderChance: shareSchema.meta({ description: "H6: chance that one computer order is a blunder." }),
    profiles: z
      .record(
        slugSchema,
        z.strictObject({
          computer: z.strictObject({
            approachObjective: weight,
            bouncedLastTurn: weight,
            caution: weight,
            demoralizedShare: weight,
            enemyLoss: weight,
            ownLoss: weight
          }),
          offensive: z.strictObject({
            reach: positiveWholeSchema,
            oddsTieBreak: weight,
            staging: weight,
            focus: weight,
            stallStep: weight,
            stallCap: wholeSchema
          }),
          stakes: z.strictObject({ city: weight, objective: weight, territory: weight }),
          victoryAlarm: z.strictObject({ critical: weight, perStep: weight, steps: wholeSchema }),
          withdraw: z.strictObject({ hopelessTakeChance: shareSchema, lastStandTakeChance: shareSchema })
        })
      )
      .meta({ description: "E7: one profile per faction, keyed by faction id (L23)." }),
    ...basisShape
  })
  .meta({ description: "E7, H6: the computer players' weights per faction, and the blunder chance." });
