import { z } from "zod";
import { basisShape, citationSchema, factionModifierSchema, markerEntry, positiveWholeSchema, shareSchema, slugSchema, textSchema, typedEntry, wholeSchema } from "./coreSchema.ts";

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

const gradeSchema = z.strictObject({
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
    factionModifiers: z.array(factionModifierSchema).default([]).meta({ description: "Named roll modifiers for particular factions." }),
    ...basisShape
  })
  .meta({ description: "The d20 battle rules." });

const monthSchema = z.number().int().min(1).max(12);

export const weatherEffectSchema = z.discriminatedUnion("@type", [
  markerEntry("blocks-digging-in"),
  markerEntry("grounds-aircraft"),
  typedEntry("movement-penalty", { amount: positiveWholeSchema }),
  typedEntry("frostbite", { share: shareSchema }),
  typedEntry("closes-sea", { months: z.array(monthSchema).min(1) })
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
  battleTable: z
    .array(z.strictObject({
      aircraftLost: z.strictObject({ attacker: wholeSchema, defender: wholeSchema }).meta({ description: "How many aircraft over the battle each side loses, at most as many as it has there." }),
      name: textSchema,
      support: z.enum(["attacker", "defender", "none"]).meta({ description: "Whose Ground Support applies; the other side's does not." }),
      upTo: z.number().int().min(0).max(20)
    }))
    .min(1)
    .meta({ description: "R11: what an air battle's score (0 to 20, higher better for the attacker) gives: whose Ground Support applies, and the aircraft each side loses." }),
  raidTable: z.array(z.strictObject({ outcome: raidOutcomeSchema, upTo: z.number().int().min(1).max(20) })).min(1),
  interceptRoll: signedRoll.negative(),
  reconTurns: positiveWholeSchema,
  supportMax: positiveWholeSchema.optional().meta({ description: "R11: the most aircraft whose Ground Support counts for one side of a battle; absent means no cap." }),
  generalDeathRoll: z.number().int().min(0).max(20).optional().meta({ description: "U5: a general whose army is destroyed or routed dies on a d20 at or under this." }),
  ...basisShape
});

export const traitEffectSchema = z.discriminatedUnion("@type", [
  typedEntry("roll-modifier", { role: z.enum(["attack", "defence"]), roll: signedRoll }),
  markerEntry("no-rally")
]);

export const generalsSchema = z.strictObject({
  traits: z.array(z.strictObject({ id: slugSchema, name: textSchema, effects: z.array(traitEffectSchema).min(1) })),
  roster: z
    .array(z.strictObject({ id: slugSchema, name: textSchema, factionId: slugSchema, trait: slugSchema, sources: z.array(citationSchema).default([]) }))
    .meta({ description: "U5: each faction's commanders in roster order, 3 to 5 per faction (L21)." }),
  ...basisShape
});

const weight = z.number();
const nonNegativeSchema = z.number().min(0);

const computerSchema = z.strictObject({
  approachObjective: weight,
  bouncedLastTurn: weight,
  caution: weight,
  demoralizedShare: weight,
  enemyLoss: weight,
  ownLoss: weight
});
const offensiveSchema = z.strictObject({
  reach: positiveWholeSchema,
  oddsTieBreak: weight,
  staging: weight,
  focus: weight,
  stallStep: weight,
  stallCap: wholeSchema,
  thrift: nonNegativeSchema.optional().meta({ description: "Cost per point of attack value sent into an attack on defended ground, so the least force that still scores best goes. Absent: 0." })
});
const aiAirSchema = z.strictObject({
  supportChance: shareSchema.meta({ description: "R11: the least chance that an attack's Ground Support applies after the air battle, for aircraft to fly it." })
});
const stakesSchema = z.strictObject({
  city: weight,
  objective: weight,
  territory: weight,
  income: nonNegativeSchema.optional().meta({ description: "Added to the stake of a territory a rival holds whole, per point of income a turn it pays the rival (every resource alike), which any ground taken there stops. Absent: 0." })
});
const recruitsSchema = z.strictObject({
  delayDrag: weight.meta({ description: "How much each turn until a unit can fight lowers its worth: it is divided by one plus this for each turn." }),
  fightersPerSupport: positiveWholeSchema.meta({ description: "Own units that can fight for each support unit (cannot-attack-alone), at least." }),
  quickTakeChance: shareSchema.meta({ description: "At this chance or more that a rival near victory takes a site, units that train in one turn come first there." }),
  upkeepHorizon: positiveWholeSchema.meta({ description: "Turns of upkeep counted in a unit's price, and of income and upkeep in what the faction can spend on recruits." }),
  upkeepTurns: positiveWholeSchema.meta({ description: "Turns of upkeep the Recruit orders leave in stock, at today's income, for what the unit types' upkeep takes." }),
  aircraftPerTurn: wholeSchema.optional().meta({ description: "Aircraft recruited a turn, at most. Absent: 1." }),
  maxUnits: wholeSchema.optional().meta({ description: "Units that can fight, on the map and in training, at which the faction recruits nothing more of any type; it still replenishes. Absent: no limit." }),
  trucksPerTurn: wholeSchema.optional().meta({ description: "Transport units that cannot fight recruited a turn, at most. Absent: 1." }),
  typeWorth: z.record(slugSchema, nonNegativeSchema).optional().meta({ description: "What a unit type's worth is multiplied by, per type id; 0 is never recruited. A type not listed, and all of them when absent: 1." }),
  variety: shareSchema.optional().meta({ description: "The share of its worth a unit type loses as the faction's force already holds it: half of this share at an even split of the force over the types, nearing all of it beyond. Absent: 0." })
});
const alarmSchema = z.strictObject({
  critical: weight,
  perStep: weight,
  riskFloor: shareSchema.meta({ description: "The least share of own losses and of the danger at home that count when attacking a rival near victory." }),
  spendSteps: wholeSchema.meta({ description: "At this many steps or fewer short of victory, a rival makes the faction spend without a Build reserve, and on the quickest units where they can reach it." }),
  steps: wholeSchema
});
const withdrawSchema = z.strictObject({ hopelessTakeChance: shareSchema, lastStandTakeChance: shareSchema });
const buildsSchema = z.strictObject({
  spendShare: shareSchema.meta({ description: "Share of each resource left after Recruit orders that builds may spend." }),
  reserveShare: shareSchema.meta({ description: "M5: share of each resource that builds cost which Recruit orders leave unspent; at least the price of the development item saved for." }),
  developmentShare: shareSchema.meta({ description: "M5: the most of a resource's balance the saved-for development item may take; above it, Recruit orders come first." }),
  developmentProjects: wholeSchema.meta({ description: "M5: development items the faction keeps queued. While it has fewer, Recruit orders leave the best one's price and Build orders buy it first." }),
  maxOrdersPerTurn: wholeSchema.meta({ description: "Build orders a turn." }),
  itemsPerEmptyQueue: positiveWholeSchema.meta({ description: "New items a sub-territory with an empty queue may take in a turn." })
});

/** E7: one computer player's weights. The loader also reads a seat's persona against it, merged over the faction's own profile (L30). */
export const aiProfileSchema = z.strictObject({
  computer: computerSchema,
  offensive: offensiveSchema,
  air: aiAirSchema,
  stakes: stakesSchema,
  recruits: recruitsSchema,
  victoryAlarm: alarmSchema,
  withdraw: withdrawSchema,
  builds: buildsSchema.optional().meta({ description: "EB-15: the computer player's Build budget. Required with an economy module (L27)." })
});

/** Any part of a profile: the fields a persona changes. */
const aiOverridesSchema = z.strictObject({
  computer: computerSchema.partial().optional(),
  offensive: offensiveSchema.partial().optional(),
  air: aiAirSchema.partial().optional(),
  stakes: stakesSchema.partial().optional(),
  recruits: recruitsSchema.partial().optional(),
  victoryAlarm: alarmSchema.partial().optional(),
  withdraw: withdrawSchema.partial().optional(),
  builds: buildsSchema.partial().optional()
});

export const aiSchema = z
  .strictObject({
    profiles: z.record(slugSchema, aiProfileSchema).meta({ description: "E7: one profile per faction, keyed by faction id (L23)." }),
    personas: z
      .record(slugSchema, z.strictObject({
        name: textSchema,
        note: textSchema.optional().meta({ description: "What the persona plays for, in a sentence." }),
        overrides: aiOverridesSchema.meta({ description: "The profile fields the persona changes; it keeps every other field of its seat's own profile." })
      }))
      .optional()
      .meta({ description: "Strategies a computer player may be given to play, for the simulation harness (L30)." }),
    seats: z.record(slugSchema, slugSchema).optional().meta({ description: "The persona each faction plays, by faction id; a faction not named plays its own profile (L30)." }),
    ...basisShape
  })
  .meta({ description: "E7: the computer players' weights per faction." });
