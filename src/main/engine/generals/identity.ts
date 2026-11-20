import type { GeneralId, RaisedUnitDefinition, Scenario, UnitId } from "../types";

/** D7 (AG-7): a replacement general's unit id is his roster id behind this prefix. */
const generalUnitPrefix = "general-";

/** The unit id a replacement general takes. */
export function generalUnitId(generalId: GeneralId): UnitId {
  return `${generalUnitPrefix}${generalId}` as UnitId;
}

/**
 * D7: a replacement general's definition, derived from his unit id alone, so every lookup that
 * has only the scenario can name him (as recruited units are, R6). His unit is of the scenario's
 * general type and as strong as the scenario's own general units. Undefined for other ids.
 */
export function generalUnitDefinition(scenario: Scenario, id: UnitId): RaisedUnitDefinition | undefined {
  if (!id.startsWith(generalUnitPrefix)) return undefined;
  const general = scenario.index.generals.get(id.slice(generalUnitPrefix.length) as GeneralId);
  const type = scenario.unitTypes.find((candidate) => candidate.kind === "general");
  if (general === undefined || type === undefined) return undefined;
  const model = scenario.units.find((unit) => unit.type === type.id);
  return { factionId: general.factionId, fullStrength: model?.fullStrength ?? 1, generalId: general.id, id, name: general.name, type: type.id };
}

/**
 * D7: a replacement general's place in "scenario order" tie-breaks (M26): after every scenario
 * unit and every recruited one, by roster order. Undefined for other ids.
 */
export function generalUnitOrder(scenario: Scenario, id: UnitId): number | undefined {
  if (!id.startsWith(generalUnitPrefix)) return undefined;
  const index = scenario.generals.findIndex((general) => general.id === id.slice(generalUnitPrefix.length));
  return index < 0 ? undefined : Number.MAX_SAFE_INTEGER / 2 + index;
}
