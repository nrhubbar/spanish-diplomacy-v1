import type { FactionId, GameState, TerritoryId, UnitState } from "../engine/types";

/**
 * What the counter layer draws: one counter per army, or, in the compact overview, one counter
 * per faction per territory standing for all its armies there. The selected territory always
 * shows each army, so the order flow can pick them one by one.
 */
export type CounterItem =
  | { readonly key: string; readonly kind: "army"; readonly unit: UnitState }
  | {
      readonly factionId: FactionId;
      readonly key: string;
      readonly kind: "group";
      readonly territoryId: TerritoryId;
      /** Two or more armies, in the game's unit order. */
      readonly units: readonly UnitState[];
    };

export function armyItems(game: GameState): readonly CounterItem[] {
  return Object.values(game.units).map((unit) => ({ key: unit.id, kind: "army", unit }));
}

/**
 * One item per faction per territory, in the game's unit order so placement stays stable; lone
 * armies and every army in the expanded territory stay individual.
 */
export function groupedItems(game: GameState, expandedTerritoryId: TerritoryId | undefined): readonly CounterItem[] {
  const places = new Map<string, UnitState[]>();
  for (const unit of Object.values(game.units)) {
    const key = unit.territoryId === expandedTerritoryId ? unit.id : `group:${unit.territoryId}:${unit.factionId}`;
    places.set(key, [...(places.get(key) ?? []), unit]);
  }
  return [...places].flatMap(([key, units]): CounterItem[] => {
    const [first] = units;
    if (first === undefined) return [];
    return units.length === 1
      ? [{ key: first.id, kind: "army", unit: first }]
      : [{ factionId: first.factionId, key, kind: "group", territoryId: first.territoryId, units }];
  });
}

/** The territory an item stands for. */
export function itemTerritory(item: CounterItem): TerritoryId {
  return item.kind === "army" ? item.unit.territoryId : item.territoryId;
}

/** The units an item stands for. */
export function itemUnits(item: CounterItem): readonly UnitState[] {
  return item.kind === "army" ? [item.unit] : item.units;
}
