import { requireFaction, requireSubTerritory, requireTerritory, requireUnitType } from "../../engine/lookup";
import type { FactionId, GameState, Scenario, SubTerritoryId, TerritoryId, UnitId, UnitTypeId } from "../../engine/types";
import { unitName } from "../unitName";

/**
 * The report-line API for the Milestone 3 outcomes. Each area under `systemText/` exports one
 * line function per outcome kind of its union (`engine/types/outcomes/<area>.ts`); the join in
 * `systemText.ts` fails to compile when a kind has none.
 *
 * Viewer safety: the outcomes that reach a line are already the viewer's (`outcomesFor`), so a
 * line may use every field of its outcome, the scenario, and the board as `state` shows it (the
 * viewer's `viewFor` state). A public outcome that carries another faction's private numbers
 * (a forfeited build's payment) names them only for the faction they belong to.
 */
export interface ReportLineContext {
  readonly scenario: Scenario;
  /** The turn's final state as the viewer sees it, for board facts such as development; absent where none is at hand. */
  readonly state?: GameState;
  /** The faction the report is for; absent for a report several local players share. */
  readonly viewer?: FactionId;
}

/** One report sentence per outcome kind of an area's union. */
export type ReportLines<O extends { readonly kind: string }> = {
  readonly [K in O["kind"]]: (outcome: Extract<O, { readonly kind: K }>, context: ReportLineContext) => string;
};

/** "A", "A and B", "A, B and C". */
export function listNames(names: readonly string[]): string {
  const last = names.length - 1;
  return last < 1 ? names.join("") : `${names.slice(0, last).join(", ")} and ${String(names[last])}`;
}

export function factionLabel(scenario: Scenario, id: FactionId): string {
  return requireFaction(scenario, id).name;
}

export function territoryLabel(scenario: Scenario, id: TerritoryId): string {
  return requireTerritory(scenario, id).name;
}

export function subTerritoryLabel(scenario: Scenario, id: SubTerritoryId): string {
  return requireSubTerritory(scenario, id).name;
}

/** W3: where a territory recruits: its capital sub-territory ("Barcelona"), else the territory. */
export function capitalLabel(scenario: Scenario, id: TerritoryId): string {
  const capital = requireTerritory(scenario, id).capitalSubTerritoryId;
  return capital === undefined ? territoryLabel(scenario, id) : subTerritoryLabel(scenario, capital);
}

/** A scenario, recruited (R6) or replacement (D7) unit's name. */
export function unitLabel(scenario: Scenario, id: UnitId): string {
  return unitName(scenario, id);
}

export function unitsLabel(scenario: Scenario, ids: readonly UnitId[]): string {
  return listNames(ids.map((id) => unitLabel(scenario, id)));
}

export function typeLabel(scenario: Scenario, id: UnitTypeId): string {
  return requireUnitType(scenario, id).name;
}

/** The singular or plural word for a count: `plural(n, "unit", "units")`. */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
