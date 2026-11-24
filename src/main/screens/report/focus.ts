import { isSystemOutcome } from "../../presentation/systemText";
import type { GameState, Scenario, SubTerritoryId, SystemOutcome, TerritoryId, TurnOutcome, TurnResolutionResult, UnitId } from "../../engine/types";
import type { BattleGroup } from "../../presentation/battle";
import { glyphs } from "../../presentation/glyphs";
import { controllerName, describeOutcomeGroup, groupOutcomes, type ReportView, territoryName } from "../../presentation/text";
import { outcomeGroups } from "./groups";

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

/** The territory a sub-territory belongs to. */
function parentOf(scenario: Scenario, id: SubTerritoryId): readonly TerritoryId[] {
  const territoryId = scenario.index.subTerritories.get(id)?.territoryId;
  return territoryId === undefined ? [] : [territoryId];
}

/** Where a unit stands at the end of the turn. */
function unitAt(state: GameState, id: UnitId): readonly TerritoryId[] {
  const unit = state.units[id];
  return unit === undefined ? [] : [unit.territoryId];
}

/**
 * D25, M10: the territories a Milestone 3 outcome happened in, for the focus note. Faction-wide
 * outcomes (income, the weather, the timer) belong to none.
 */
export function systemOutcomePlaces(scenario: Scenario, state: GameState, outcome: SystemOutcome): readonly TerritoryId[] {
  switch (outcome.kind) {
    case "withdrew":
      return [outcome.order.from, outcome.order.to];
    case "path-surrender":
      return [outcome.from];
    case "move-held-back":
      return [outcome.from, outcome.to];
    case "move-transit":
      return [outcome.from, ...outcome.legs.map((leg) => leg.to)];
    case "move-intercepted":
      return [outcome.from, outcome.to, outcome.stoppedAt];
    case "training-started":
      return [outcome.order.territoryId];
    case "replenish-applied":
    case "replenish-cancelled":
      return unitAt(state, outcome.order.unitId);
    case "fatigue":
      return unitAt(state, outcome.unitId);
    case "build-queued":
      return parentOf(scenario, outcome.order.subTerritoryId);
    case "income":
    case "upkeep":
    case "weather-rolled":
    case "time-ran-out":
      return [];
    default:
      // Every other kind names its place: a territory (training, frostbite, generals, rallies)
      // or a sub-territory (builds, rail damage, raids).
      if ("territoryId" in outcome) return [outcome.territoryId];
      if ("subTerritoryId" in outcome) return parentOf(scenario, outcome.subTerritoryId);
      return [];
  }
}

/** Whether an outcome other than a battle happened at a territory: a move in, out, or back to it, a recovery there, or a Milestone 3 event there. */
function happenedAt(scenario: Scenario, state: GameState, outcome: TurnOutcome, territoryId: TerritoryId): boolean {
  if (isSystemOutcome(outcome)) return systemOutcomePlaces(scenario, state, outcome).includes(territoryId);
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

/** How serious an outcome is, as the report's groups and each group's kinds order them (most serious first). */
function severity(outcome: TurnOutcome): number {
  const index = outcomeGroups.findIndex((group) => group.kinds.includes(outcome.kind));
  return index === -1 ? outcomeGroups.length * 100 : index * 100 + (outcomeGroups[index]?.kinds.indexOf(outcome.kind) ?? 0);
}

/**
 * The note for a place with no battle: a change of hands, then one line per outcome there, most
 * serious first (surrender, interception, withdrawal, fatigue, training, builds), in the
 * report's own words, as the report's viewer may read them. Empty when nothing happened.
 * `view` gives the Milestone 3 lines the viewer's board and keeps other factions' numbers private.
 */
export function eventsAt(scenario: Scenario, result: TurnResolutionResult, territoryId: TerritoryId, view: ReportView = { state: result.finalState }): readonly string[] {
  const change = result.controlChanges.find((entry) => entry.territoryId === territoryId);
  const changed = change === undefined
    ? []
    : [`${territoryName(scenario, territoryId)} changed hands: ${controllerName(scenario, change.before)} ${glyphs.arrow} ${controllerName(scenario, change.after)}.`];
  const outcomes = result.outcomes
    .filter((outcome) => happenedAt(scenario, result.finalState, outcome, territoryId))
    .map((outcome, index) => ({ index, outcome }))
    .sort((a, b) => severity(a.outcome) - severity(b.outcome) || a.index - b.index)
    .map(({ outcome }) => outcome);
  return [...changed, ...groupOutcomes(outcomes).map((group) => describeOutcomeGroup(scenario, group, result.outcomes, view))];
}

/** Scrolls a report element into the pane's view, smoothly unless the player asked for reduced motion. */
export function revealInPane(element: Element): void {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
