import type { OutcomeKey } from "./outcomes";

/**
 * Field-dispatch flavor text for battle results and army statuses: restrained, factual, and
 * in English, with every name arriving through a placeholder so place names keep their
 * Spanish spelling and no scenario is named in code.
 *
 * Faction placeholders (`{attacker}`, `{defender}`) carry full faction names, and may carry
 * several joined, so lines put "the" or "forces of the" before them and never use them as
 * adjectives. `{army}` is one army's name, `{losses}` a formatted count of men.
 */

export const outcomePlaceholders = ["attacker", "defender", "army", "territory", "city", "origin", "retreat", "losses"] as const;

export type OutcomePlaceholder = (typeof outcomePlaceholders)[number];

/** Values the presenter supplies, by placeholder. */
export type OutcomeValues = Partial<Readonly<Record<OutcomePlaceholder, string>>>;

export interface OutcomeTextEntry {
  /** A short name for the outcome, for headings and accessible labels. */
  readonly title: string;
  /** Placeholders the presenter always supplies for this key. */
  readonly required: readonly OutcomePlaceholder[];
  /** Placeholders supplied only when they apply; lines using them are chosen only then. */
  readonly optional: readonly OutcomePlaceholder[];
  readonly lines: readonly string[];
}

const battle = ["attacker", "defender", "territory"] as const satisfies readonly OutcomePlaceholder[];
const armyStatus = ["army", "territory"] as const satisfies readonly OutcomePlaceholder[];

export const outcomeText: Readonly<Record<OutcomeKey, OutcomeTextEntry>> = {
  "attacker-eliminated": {
    title: "Attacker eliminated",
    required: battle,
    optional: ["city"],
    lines: [
      "The attack on {territory} failed. The forces of the {defender} held, and no attacking unit returned to its lines.",
      "Forces of the {attacker} sent against {territory} were lost to the last unit.",
      "Nothing more has been heard of the columns sent against {city}."
    ]
  },
  "attacker-attrition": {
    title: "Attacker attrition",
    required: [...battle, "losses"],
    optional: ["city", "origin"],
    lines: [
      "Forces of the {attacker} pressed the attack on {territory} and gained no ground. Losses: {losses} men.",
      "Repeated assaults on {territory} broke against prepared positions, at a cost of {losses} men.",
      "The line before {city} held through the day. The attackers returned to {origin} having lost {losses} men."
    ]
  },
  "attacker-demoralized": {
    title: "Attacker demoralized",
    required: battle,
    optional: ["city", "origin"],
    lines: [
      "The assault on {territory} stalled under steady fire. Forces of the {attacker} fell back in disorder.",
      "The {defender} held {territory}. The attackers withdrew, shaken, and are in no state to attack again soon.",
      "The attack came apart short of {city}. Its columns are regrouping at {origin}."
    ]
  },
  "both-demoralized": {
    title: "Both sides demoralized",
    required: battle,
    optional: ["city"],
    lines: [
      "Neither side could hold the field at {territory}. Both withdrew, shaken and short of ammunition.",
      "A day of confused fighting around {territory} settled nothing. Forces of the {attacker} fell back; those of the {defender} held their ground, badly shaken.",
      "Fighting before {city} ended in exhaustion on both sides."
    ]
  },
  "defender-demoralized": {
    title: "Defender demoralized",
    required: battle,
    optional: ["retreat"],
    lines: [
      "The line at {territory} gave way under steady pressure. Its defenders withdrew in poor order.",
      "Forces of the {defender} fell back from {territory} on {retreat}, shaken but intact.",
      "Forces of the {attacker} occupied {territory} after its defenders withdrew."
    ]
  },
  "defender-exchange": {
    title: "Exchange",
    required: [...battle, "losses"],
    optional: ["city"],
    lines: [
      "Forces of the {attacker} took {territory}, but the defenders contested every street. Losses: {losses} men.",
      "{territory} has changed hands at heavy cost to both sides. The attackers lost {losses} men.",
      "{city} was taken after a hard fight. No unit of the {defender} remains in {territory}."
    ]
  },
  "defender-eliminated": {
    title: "Defender eliminated",
    required: battle,
    optional: ["city"],
    lines: [
      "{territory} has fallen. None of its defenders got away.",
      "The position of the {defender} at {territory} was overrun. Forces of the {attacker} now hold the ground.",
      "By nightfall, forces of the {attacker} held every road into {city}."
    ]
  },
  demoralized: {
    title: "Demoralized",
    required: armyStatus,
    optional: [],
    lines: [
      "The {army} is badly shaken and in need of rest.",
      "Reports from {territory} describe the {army} as tired and short of officers. It is in no condition to attack.",
      "Morale in the {army} is low after the fighting around {territory}."
    ]
  },
  "dug-in": {
    title: "Dug in",
    required: ["defender", "territory"],
    optional: ["city"],
    lines: [
      "Forces of the {defender} have dug in around {territory}.",
      "The {defender} has used the quiet to strengthen its positions at {territory}.",
      "Trenches and barricades now cover the approaches to {city}."
    ]
  },
  recovered: {
    title: "Recovered",
    required: armyStatus,
    optional: [],
    lines: [
      "Rested and resupplied, the {army} is ready to fight again.",
      "The {army} has recovered its order at {territory}."
    ]
  },
  "reinforcement-arrived": {
    title: "Reinforcement arrived",
    required: armyStatus,
    optional: ["origin"],
    lines: [
      "The {army} reached {territory} in time to join its defence.",
      "The {army} arrived from {origin} and took up positions in {territory}.",
      "Fresh troops of the {army} have joined the defence of {territory}."
    ]
  },
  surrendered: {
    title: "Surrendered",
    required: armyStatus,
    optional: ["attacker"],
    lines: [
      "Cut off at {territory} with nowhere to fall back, the {army} laid down its arms.",
      "With every road out of {territory} closed, the {army} surrendered to forces of the {attacker}."
    ]
  }
};

const placeholderPattern = /\{([a-z]+)\}/g;

function isPlaceholder(name: string): name is OutcomePlaceholder {
  return outcomePlaceholders.some((placeholder) => placeholder === name);
}

/** The placeholder names a line uses, in order of appearance, including unknown ones. */
export function linePlaceholders(line: string): string[] {
  return (line.match(placeholderPattern) ?? []).map((token) => token.slice(1, -1));
}

/** Replaces each placeholder in one pass, so substituted values are never re-read. */
export function fillLine(line: string, values: OutcomeValues): string {
  return line.replace(placeholderPattern, (token, name: string) => {
    const value = isPlaceholder(name) ? values[name] : undefined;
    if (value === undefined) throw new Error(`No value for ${token} in "${line}".`);
    return value;
  });
}

/**
 * One filled line for an outcome. Lines whose optional placeholders are not all supplied are
 * skipped; the rest are picked by `seed`, so the same battle always reads the same, in play
 * and in replays. Pass a stable integer such as the battle's index in the turn.
 */
export function outcomeLine(key: OutcomeKey, values: OutcomeValues, seed: number): string {
  if (!Number.isSafeInteger(seed)) throw new Error(`Outcome line seed ${String(seed)} is not an integer.`);
  const entry = outcomeText[key];
  const missing = entry.required.filter((name) => values[name] === undefined);
  if (missing.length > 0) throw new Error(`Outcome "${key}" needs ${missing.map((name) => `{${name}}`).join(", ")}.`);
  const usable = entry.lines.filter((line) => linePlaceholders(line).every((name) => isPlaceholder(name) && values[name] !== undefined));
  const line = usable[((seed % usable.length) + usable.length) % usable.length];
  if (line === undefined) throw new Error(`Outcome "${key}" has no line for the values given.`);
  return fillLine(line, values);
}
