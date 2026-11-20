import { priceReplenishments, replenishQuote } from "../engine/recruitment/rules";
import type { GameState, Resources, Scenario, TrainingItem, UnitState } from "../engine/types";
import { amountText } from "./economy";
import { glyphs } from "./glyphs";

/** Player-facing wording for recruiting and replenishing (X4, X7). */

/** "6 Funds and 1k Manpower", in the scenario's resource order, read through each display scale (EB-12); "nothing" when free. */
export function resourcesLabel(scenario: Scenario, amount: Resources, joiner = " and "): string {
  return amountText(scenario, amount, joiner);
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
 * turn \u00b7 4 Funds and 1k Manpower \u00b7 cancelled and refunded if the unit fights".
 */
export function replenishDetail(scenario: Scenario, state: GameState, units: readonly UnitState[]): string {
  const quotes = units.flatMap((unit) => replenishQuote(scenario, state, unit) ?? []);
  const men = quotes.reduce((sum, quote) => sum + quote.men, 0);
  // B2: several units are priced in turn against the faction's carry, as reveal pays them.
  const factionId = units[0]?.factionId;
  const cost = factionId === undefined ? {} : priceReplenishments(scenario, state, factionId, units).total;
  const recovers = quotes.some((quote) => quote.recovers);
  // RR-12: only units below strength replenish, so there are always men to bring.
  const gain = `+${String(men)} men${recovers ? " and morale" : ""}`;
  const who = units.length === 1 ? "the unit fights" : "a unit fights";
  return [`${gain}, arriving at the end of the turn`, replenishPriceLabel(scenario, cost), `cancelled and refunded if ${who}`].join(` ${glyphs.dot} `);
}

/**
 * B2: what a Replenish pays at reveal: "1 Funds", or, when it owes less than a whole point so
 * far, "under a point, added to later orders" (the faction's carry, D28.3).
 */
export function replenishPriceLabel(scenario: Scenario, paid: Resources): string {
  const label = resourcesLabel(scenario, paid);
  return label === "nothing" ? "under a point, added to later orders" : label;
}

/** X7: a unit in training, for the Units tab: "ready at the end of this turn", "ready in 2 turns", or paused. */
export function trainingStatus(item: TrainingItem): string {
  if (item.paused) return "Paused while the territory is contested";
  return item.turnsLeft <= 1 ? "Ready at the end of this turn" : `Ready in ${turnsLabel(item.turnsLeft)}`;
}
