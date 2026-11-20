import { replenishQuote } from "../engine/recruitment/rules";
import { addResources } from "../engine/resources";
import type { GameState, Resources, Scenario, TrainingItem, UnitState } from "../engine/types";
import { glyphs } from "./glyphs";

/** Player-facing wording for recruiting and replenishing (X4, X7). */

/** "6 Funds and 1 Manpower", in the scenario's resource order; "nothing" when free. */
export function resourcesLabel(scenario: Scenario, amount: Resources, joiner = " and "): string {
  const parts = scenario.resources.flatMap((resource) => {
    const value = amount[resource.id] ?? 0;
    return value === 0 ? [] : [`${String(value)} ${resource.name}`];
  });
  return parts.length === 0 ? "nothing" : parts.join(joiner);
}

/** The resources a balance lacks to pay a price: "Funds", "Funds and Manpower", or "". */
export function shortfallLabel(scenario: Scenario, balance: Resources, price: Resources): string {
  const missing = scenario.resources.filter((resource) => (price[resource.id] ?? 0) > (balance[resource.id] ?? 0));
  return missing.map((resource) => resource.name).join(" and ");
}

/** Men in thousands above a thousand, as in the header: "2.5k men", "700 men". */
export function menShort(men: number): string {
  if (men < 1000) return `${String(men)} men`;
  const thousands = Math.round(men / 100) / 10;
  return `${String(thousands)}k men`;
}

export function turnsLabel(turns: number): string {
  return `${String(turns)} ${turns === 1 ? "turn" : "turns"}`;
}

/**
 * X7, R5: the Replenish choice for the selected units: "+700 men, arriving at the end of the
 * turn · 4 Funds and 1 Manpower · cancelled and refunded if the unit fights".
 */
export function replenishDetail(scenario: Scenario, state: GameState, units: readonly UnitState[]): string {
  const quotes = units.flatMap((unit) => replenishQuote(scenario, state, unit) ?? []);
  const men = quotes.reduce((sum, quote) => sum + quote.men, 0);
  const cost = quotes.reduce<Resources>((sum, quote) => addResources(sum, quote.cost), {});
  const recovers = quotes.some((quote) => quote.recovers);
  const gain = men > 0 ? `+${String(men)} men${recovers ? " and morale" : ""}` : "Morale restored";
  const who = units.length === 1 ? "the unit fights" : "a unit fights";
  return [`${gain}, arriving at the end of the turn`, resourcesLabel(scenario, cost), `cancelled and refunded if ${who}`].join(` ${glyphs.dot} `);
}

/** X7: a unit in training, for the Units tab: "ready at the end of this turn", "ready in 2 turns", or paused. */
export function trainingStatus(item: TrainingItem): string {
  if (item.paused) return "Paused while the territory is contested";
  return item.turnsLeft <= 1 ? "Ready at the end of this turn" : `Ready in ${turnsLabel(item.turnsLeft)}`;
}
