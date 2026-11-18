import type { Scenario } from "../engine/types";
import { prepareSymbol } from "./markup";

/** Prepared symbol markup keyed by `factionId:unitTypeId`. */
export function markupForSymbols(scenario: Scenario, unitSymbols: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const faction of scenario.factions) {
    for (const [typeId, source] of unitSymbols) {
      result.set(`${faction.id}:${typeId}`, prepareSymbol(source, faction.color));
    }
  }
  return result;
}
