import { requireGeneral, requireUnitDefinition, requireUnitType } from "../engine/lookup";
import type { Scenario, UnitId } from "../engine/types";

/**
 * A scenario unit's own name, a recruited unit's made from its type and number ("Truck column
 * No. 1", or "Truck column (new)" while it trains, R6), or a replacement general's (D7).
 */
export function unitName(scenario: Scenario, id: UnitId): string {
  const own = scenario.index.units.get(id);
  if (own !== undefined) return own.name;
  const { generalId, serial, type } = requireUnitDefinition(scenario, id);
  if (generalId !== undefined) return requireGeneral(scenario, generalId).name;
  const typeName = requireUnitType(scenario, type).name;
  return serial === undefined ? `${typeName} (new)` : `${typeName} No. ${String(serial)}`;
}
