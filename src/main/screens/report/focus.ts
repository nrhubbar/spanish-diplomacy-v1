import { isSystemOutcome } from "../../presentation/systemText";
import type { Scenario, TerritoryId, TurnOutcome, TurnResolutionResult } from "../../engine/types";
import type { BattleGroup } from "../../presentation/battle";
import { glyphs } from "../../presentation/glyphs";
import { controllerName, describeOutcomeGroup, groupOutcomes, type ReportView, territoryName } from "../../presentation/text";

/**
 * F1: what the turn report shows for a focused place. Pure, so the screen only renders it.
 */

/** Keys of the battle cards fought at a territory, a meeting on one of its roads included. */
export function battleKeysAt(groups: readonly BattleGroup[], territoryId: TerritoryId): readonly string[] {
  return groups.filter((group) => group.battles.some(({ battle }) => {
    const { site } = battle;
    return site.kind === "meeting" ? site.between.includes(territoryId) : site.territoryId === territoryId;
  })).map((group) => group.key);
}

/** Whether an outcome other than a battle happened at a territory: a move in, out, or back to it, or a recovery there. */
function happenedAt(outcome: TurnOutcome, territoryId: TerritoryId): boolean {
  if (isSystemOutcome(outcome)) return false;
  switch (outcome.kind) {
    case "battle":
    case "no-move":
    case "rejected-order":
      return false;
    case "recovered":
      return outcome.territoryId === territoryId;
    case "bounced-move":
      return outcome.order.from === territoryId || outcome.order.to === territoryId || outcome.retreatedTo === territoryId;
    default:
      return outcome.order.from === territoryId || outcome.order.to === territoryId;
  }
}

/**
 * The note for a place with no battle: a change of hands, then one line per outcome there, in
 * the report's own words, as the report's viewer may read them. Empty when nothing happened.
 */
export function eventsAt(scenario: Scenario, result: TurnResolutionResult, territoryId: TerritoryId, view: ReportView = {}): readonly string[] {
  const change = result.controlChanges.find((entry) => entry.territoryId === territoryId);
  const changed = change === undefined
    ? []
    : [`${territoryName(scenario, territoryId)} changed hands: ${controllerName(scenario, change.before)} ${glyphs.arrow} ${controllerName(scenario, change.after)}.`];
  const outcomes = result.outcomes.filter((outcome) => happenedAt(outcome, territoryId));
  return [...changed, ...groupOutcomes(outcomes).map((group) => describeOutcomeGroup(scenario, group, result.outcomes, view))];
}

/** Scrolls a report element into the pane's view, smoothly unless the player asked for reduced motion. */
export function revealInPane(element: Element): void {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
