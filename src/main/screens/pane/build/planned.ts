import type { BuildOrder, SubTerritoryId } from "../../../engine/types";

/** This turn's planned Build orders for one sub-territory, with their index in the whole plan. */
export function plannedAt(builds: readonly BuildOrder[], subTerritoryId: SubTerritoryId): readonly { readonly index: number; readonly order: BuildOrder }[] {
  return builds.flatMap((order, index) => (order.subTerritoryId === subTerritoryId ? [{ index, order }] : []));
}
