import type { UnitTypeDefinition } from "../types";

/**
 * D27.1, D17, D5: a unit of this type can fight: a ground unit with an attack value. Aircraft,
 * generals and ground units with no attack (trucks, anti-air) cannot take ground or attack on
 * their own. Artillery can fight; whether it may attack alone is its `cannot-attack-alone` effect.
 */
export function canFight(unitType: Pick<UnitTypeDefinition, "attack" | "kind">): boolean {
  return unitType.kind === "ground" && unitType.attack > 0;
}
