import type { FactionId, GameState, Scenario, TurnOutcome } from "../../engine/types";
import { factionName } from "../../presentation/text";
import { outcomeGroups } from "./groups";

/**
 * U10 (Q-R2-10): the faction a report line is about. Read structurally, so a new outcome kind
 * is placed without an edit here: its own faction, else its order's, else the holder that lost
 * a build, else the holder of the sub-territory it names. Undefined when nothing says.
 */
export function outcomeFaction(state: Pick<GameState, "subTerritories">, outcome: TurnOutcome): FactionId | undefined {
  if ("factionId" in outcome) return outcome.factionId;
  if ("order" in outcome) return outcome.order.factionId;
  if ("previousHolder" in outcome) return outcome.previousHolder;
  if ("subTerritoryId" in outcome) return state.subTerritories[outcome.subTerritoryId]?.holder;
  return undefined;
}

export interface FactionReport {
  /** Undefined for the lines that belong to no faction. */
  readonly factionId: FactionId | undefined;
  readonly outcomes: readonly TurnOutcome[];
}

const groupedKinds: ReadonlySet<TurnOutcome["kind"]> = new Set(outcomeGroups.flatMap((group) => group.kinds));

/**
 * "What happened" by faction: the viewer's own first, then the others in the scenario's order,
 * then the lines that belong to no faction. Only the kinds the report groups are kept (battles,
 * conditions and the treasury have their own sections), and factions with none are left out.
 */
export function outcomesByFaction(scenario: Scenario, state: Pick<GameState, "subTerritories">, outcomes: readonly TurnOutcome[], viewer: FactionId | undefined): readonly FactionReport[] {
  const listed = outcomes.filter((outcome) => groupedKinds.has(outcome.kind));
  const others = scenario.factions.map((faction) => faction.id).filter((id) => id !== viewer);
  const order: readonly (FactionId | undefined)[] = [...(viewer === undefined ? [] : [viewer]), ...others, undefined];
  return order
    .map((factionId) => ({ factionId, outcomes: listed.filter((outcome) => outcomeFaction(state, outcome) === factionId) }))
    .filter((entry) => entry.outcomes.length > 0);
}

/** A faction section's heading: "Republican Government (you)", or "Other events". */
export function factionReportTitle(scenario: Scenario, factionId: FactionId | undefined, viewer: FactionId | undefined): string {
  if (factionId === undefined) return "Other events";
  return factionId === viewer ? `${factionName(scenario, factionId)} (you)` : factionName(scenario, factionId);
}

/** "8 events". */
export function eventCount(count: number): string {
  return `${String(count)} ${count === 1 ? "event" : "events"}`;
}
