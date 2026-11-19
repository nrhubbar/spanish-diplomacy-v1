import { requireFaction, requireTerritory, requireUnitDefinition } from "../engine/lookup";
import type {
  BounceCause,
  FactionId,
  MoveOrder,
  Scenario,
  TerritoryControl,
  TerritoryId,
  TurnOutcome,
  UnitId
} from "../engine/types";
import { glyphs } from "./glyphs";
import { outcomeText } from "./outcomeText";

/** Player-facing wording for engine data. The engine itself produces no prose. */

export function factionName(scenario: Scenario, id: FactionId): string {
  return requireFaction(scenario, id).name;
}

export function territoryName(scenario: Scenario, id: TerritoryId): string {
  return requireTerritory(scenario, id).name;
}

export function unitName(scenario: Scenario, id: UnitId): string {
  return requireUnitDefinition(scenario, id).name;
}

export function listNames(names: readonly string[]): string {
  const last = names.length - 1;
  return last < 1 ? names.join("") : `${names.slice(0, last).join(", ")} and ${String(names[last])}`;
}

export function route(scenario: Scenario, order: MoveOrder): string {
  return `${territoryName(scenario, order.from)} ${glyphs.arrow} ${territoryName(scenario, order.to)}`;
}

export function controlDescription(scenario: Scenario, control: TerritoryControl | undefined): string {
  if (control === undefined) return "Uncontrolled";
  if (control.kind === "controlled") return `Held by ${factionName(scenario, control.factionId)}`;
  return `Contested by ${listNames(control.factionIds.map((id) => factionName(scenario, id)))}`;
}

/** Short controller name for change lists: a faction or "Contested". */
export function controllerName(scenario: Scenario, control: TerritoryControl): string {
  return control.kind === "controlled" ? factionName(scenario, control.factionId) : "Contested";
}

type MoveOutcome = Extract<TurnOutcome, { readonly kind: "successful-move" | "bounced-move" | "disbanded-move" | "reinforcement-arrived" }>;

/** Formations of one faction that share an outcome; `outcome` is the first of them. */
export interface OutcomeGroup {
  readonly outcome: TurnOutcome;
  readonly unitIds: readonly UnitId[];
}

/**
 * U2: moves of one faction along the same route with the same result form one group, so
 * formations that moved together read as one line. Other outcomes, battles included, stay one
 * per line.
 */
export function groupOutcomes(outcomes: readonly TurnOutcome[]): readonly OutcomeGroup[] {
  const groups = new Map<string, { readonly outcome: TurnOutcome; readonly unitIds: UnitId[] }>();
  outcomes.forEach((outcome, index) => {
    const key = isMoveOutcome(outcome) ? moveGroupKey(outcome) : `single:${String(index)}`;
    const ids = unitIdsOf(outcome);
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { outcome, unitIds: ids });
    } else {
      existing.unitIds.push(...ids);
    }
  });
  return [...groups.values()];
}

function unitIdsOf(outcome: TurnOutcome): UnitId[] {
  switch (outcome.kind) {
    case "no-move":
      return outcome.unitId === undefined ? [] : [outcome.unitId];
    case "recovered":
      return [outcome.unitId];
    case "battle":
      return [...outcome.attacker.armies, ...outcome.defender.armies].map((army) => army.unitId);
    case "rejected-order":
      return "unitId" in outcome.order ? [outcome.order.unitId] : [];
    default:
      return [outcome.order.unitId];
  }
}

function isMoveOutcome(outcome: TurnOutcome): outcome is MoveOutcome {
  return outcome.kind === "successful-move" || outcome.kind === "bounced-move" || outcome.kind === "disbanded-move"
    || outcome.kind === "reinforcement-arrived";
}

function moveGroupKey(outcome: MoveOutcome): string {
  const { factionId, from, to } = outcome.order;
  const cause = outcome.kind === "successful-move" || outcome.kind === "reinforcement-arrived" ? null : outcome.cause;
  const captor = outcome.kind === "disbanded-move" ? outcome.capturedByFactionId : null;
  return JSON.stringify([outcome.kind, factionId, from, to, cause, captor]);
}

/**
 * U3: name who actually stopped the move. Given the turn's outcomes, a standoff also names
 * where each opposing faction came from, so a player can tell those moves from their own.
 */
export function bounceReason(
  scenario: Scenario,
  cause: BounceCause,
  context?: { readonly order: MoveOrder; readonly outcomes: readonly TurnOutcome[] }
): string {
  const names = (ids: readonly FactionId[]) => listNames(ids.map((id) => factionName(scenario, id)));
  switch (cause.kind) {
    case "standoff":
      return `standoff with ${listNames(cause.opposingFactionIds.map((id) => standoffParty(scenario, id, context)))}`;
    case "held":
      return `held by ${names(cause.holdingFactionIds)}`;
    case "head-on":
      return `met ${names(cause.opposingFactionIds)} head-on`;
  }
}

function standoffParty(
  scenario: Scenario,
  factionId: FactionId,
  context: { readonly order: MoveOrder; readonly outcomes: readonly TurnOutcome[] } | undefined
): string {
  const origins = [...new Set((context?.outcomes ?? []).flatMap((outcome) =>
    isMoveOutcome(outcome) && outcome.order.factionId === factionId && outcome.order.to === context?.order.to
      ? [outcome.order.from]
      : []
  ))];
  const name = factionName(scenario, factionId);
  return origins.length === 0 ? name : `${name} (from ${listNames(origins.map((id) => territoryName(scenario, id)))})`;
}

/** One report line for a single outcome; pass the turn's outcomes to name standoff origins. */
export function describeOutcome(scenario: Scenario, outcome: TurnOutcome, outcomes: readonly TurnOutcome[] = []): string {
  return describeOutcomeGroup(scenario, { outcome, unitIds: unitIdsOf(outcome) }, outcomes);
}

/** One report line for a group: the faction first, then what its formations did together. */
export function describeOutcomeGroup(scenario: Scenario, group: OutcomeGroup, outcomes: readonly TurnOutcome[] = []): string {
  const { outcome } = group;
  if (outcome.kind === "no-move") {
    return outcome.unitId === undefined
      ? `${factionName(scenario, outcome.factionId)} had no armies to order.`
      : `${unitName(scenario, outcome.unitId)} held.`;
  }
  if (outcome.kind === "rejected-order") {
    return `${factionName(scenario, outcome.order.factionId)}: an order was not carried out: ${outcome.reason}`;
  }
  if (outcome.kind === "recovered") {
    return `${unitName(scenario, outcome.unitId)} recovered its morale in ${territoryName(scenario, outcome.territoryId)}.`;
  }
  if (outcome.kind === "battle") {
    // The battle cards carry the sides, roll, and effects; this is the one-line headline.
    const place = outcome.site.kind === "meeting"
      ? `on the road between ${listNames(outcome.site.between.map((id) => territoryName(scenario, id)))}`
      : `for ${territoryName(scenario, outcome.site.territoryId)}`;
    return `Battle ${place}: ${outcomeText[outcome.result].title}.`;
  }
  const { order } = outcome;
  const actor = factionName(scenario, order.factionId);
  const units = listNames(group.unitIds.map((id) => unitName(scenario, id)));
  const several = group.unitIds.length > 1;
  const path = `${several ? " together" : ""} from ${territoryName(scenario, order.from)} to ${territoryName(scenario, order.to)}`;
  switch (outcome.kind) {
    case "successful-move":
      return `${actor}: ${units} moved${path}.`;
    case "reinforcement-arrived":
      return `${actor}: ${units} moved${path} as reinforcements.`;
    case "bounced-move": {
      const bounced = `${actor}: ${units} tried to move${path} and bounced: ${bounceReason(scenario, outcome.cause, { order, outcomes })}.`;
      return outcome.retreatedTo === undefined
        ? bounced
        : `${bounced} ${several ? "They" : "It"} fell back to ${territoryName(scenario, outcome.retreatedTo)}.`;
    }
    case "disbanded-move":
      return `${actor}: ${units} ${several ? "were" : "was"} lost. ${several ? "They" : "It"} tried to move${path} and bounced: ${bounceReason(scenario, outcome.cause, { order, outcomes })}. ${factionName(scenario, outcome.capturedByFactionId)} took ${territoryName(scenario, order.from)}.`;
    case "invalid-order":
      return `${actor}: ${units} was disbanded after an impossible order: ${outcome.reason}`;
  }
}

/** Short counter designation: initials plus number, e.g. "Wad-Ras Infantry Regiment No. 1" -> "WR1". */
export function unitDesignation(name: string): string {
  const number = /(?:No\.\s*)?(\d+)\b/.exec(name)?.[1] ?? "";
  const words = name
    .replace(/\b(?:Infantry|Regiment|Battalion|Column|Security|Guard|Detachment|Barracks|No)\.?\b/gi, " ")
    // Any letter, so accented names ("Arag\u00f3n") stay one word.
    .match(/\p{L}+/gu) ?? [];
  const initials = words.slice(0, number === "" ? 3 : 2).map((word) => word.charAt(0).toUpperCase()).join("");
  return `${initials}${number}`.slice(0, 4);
}
