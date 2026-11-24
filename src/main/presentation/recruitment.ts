import { capitalOf, meetsRequirement, priceReplenishments, replenishQuote, requirementName } from "../engine/recruitment/rules";
import type { BuildingId, FactionId, GameState, Resources, Scenario, TerritoryId, TrainingItem, UnitState, UnitTypeDefinition, UpkeepRules } from "../engine/types";
import { amountText, resourceAmount } from "./economy";
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

/** X4: where a territory recruits: its capital sub-territory, else the territory. */
export function recruitSiteName(scenario: Scenario, territoryId: TerritoryId): string {
  const capital = capitalOf(scenario, territoryId);
  return capital === undefined ? scenario.index.territories.get(territoryId)?.name ?? "" : scenario.index.subTerritories.get(capital)?.name ?? "";
}

/** X4, D3: what a faction recruits with there, by name: the buildings in the capital, then the development tracks some type needs. */
export function recruitsWithLabel(scenario: Scenario, state: Pick<GameState, "subTerritories">, factionId: FactionId, territoryId: TerritoryId, standing: readonly BuildingId[]): string {
  const needed = scenario.unitTypes.flatMap((type) => type.recruit?.requires ?? []).filter((requirement) => requirement.kind === "development");
  const tracks = needed.filter((requirement) => meetsRequirement(scenario, state, factionId, territoryId, requirement)).map((requirement) => requirementName(scenario, requirement));
  const names = [...standing.map((id) => scenario.index.buildings.get(id)?.name ?? id), ...new Set(tracks)];
  return names.length === 0 ? "No buildings" : names.join(` ${glyphs.dot} `);
}

/** X4: one term of raising a type, as the row's meta line and its tooltip print it. */
export interface RecruitTerm {
  readonly detail: string;
  readonly meta: string;
}

/** X4: a type's price, men and training time, in the order they are printed. */
export function recruitTerms(scenario: Scenario, type: UnitTypeDefinition): readonly RecruitTerm[] {
  const cost = resourcesLabel(scenario, type.recruit?.cost ?? {}, ` ${glyphs.dot} `);
  const men = menShort(type.recruit?.establishment ?? 0);
  const turns = turnsLabel(type.recruit?.trainingTurns ?? 0);
  const upkeep = upkeepLabel(scenario, type);
  return [
    { detail: cost, meta: cost }, { detail: men, meta: men }, { detail: `trains in ${turns}`, meta: turns },
    ...(upkeep === undefined ? [] : [{ detail: `upkeep ${upkeep} a turn`, meta: `upkeep ${upkeep}` }])
  ];
}

/** D1: what a type's upkeep takes a turn: "0.25k Manpower", or undefined for a type with none. */
function upkeepLabel(scenario: Scenario, type: Pick<UnitTypeDefinition, "upkeep">): string | undefined {
  return scenario.upkeep === undefined || Object.keys(type.upkeep).length === 0 ? undefined : resourcesLabel(scenario, type.upkeep, " and ");
}

/** D1: what disbanding a unit of a type saves: "Saves 0.25k Manpower a turn". */
export function disbandSaving(scenario: Scenario, type: Pick<UnitTypeDefinition, "upkeep">): string {
  const upkeep = upkeepLabel(scenario, type);
  return upkeep === undefined ? "Costs no upkeep" : `Saves ${upkeep} a turn`;
}

/** D1: the shortage warning: its heading, and what follows from it. */
export function shortageWarning(scenario: Scenario, rules: UpkeepRules, short: Resources): { readonly body: string; readonly heading: string } | undefined {
  const names = scenario.resources.filter((resource) => short[resource.id] !== undefined);
  if (names.length === 0) return undefined;
  const heading = names.map((resource) => `${resource.name} will be ${resourceAmount(scenario, resource.id, short[resource.id] ?? 0)} short next turn`).join(". ");
  return {
    body: `Recruiting and Replenish are off. If you change nothing, up to ${String(Math.round(rules.maxLossShare * 100))}% of each unit's men leave (never below ${rules.minStrengthShare === 0.5 ? "half" : `${String(Math.round(rules.minStrengthShare * 100))}%`} of it). Disband units to save their upkeep.`,
    heading
  };
}

/** X4: the terms on one line: "5 Funds \u00b7 1k Manpower \u00b7 700 men \u00b7 2 turns". */
export function termsLine(terms: readonly RecruitTerm[], form: keyof RecruitTerm): string {
  return terms.map((term) => term[form]).join(` ${glyphs.dot} `);
}

/** X4: the buildings and development a type needs in a territory, each marked whether the faction has it. */
export function recruitRequirements(scenario: Scenario, state: Pick<GameState, "subTerritories">, factionId: FactionId, territoryId: TerritoryId, type: UnitTypeDefinition): readonly { readonly have: boolean; readonly name: string }[] {
  return (type.recruit?.requires ?? []).map((requirement) => ({ have: meetsRequirement(scenario, state, factionId, territoryId, requirement), name: requirementName(scenario, requirement) }));
}

/** X4: why one more of a type cannot be added: its locks, the turn's Recruit orders used up, the price, or next turn's upkeep (D1). */
export function recruitAddReason(locked: readonly string[], slotsFull: boolean, shortfall: string, upkeep?: string): string | undefined {
  return locked.length > 0 ? locked.join(" ") : slotsFull ? "No Recruit orders left here this turn." : shortfall === "" ? upkeep : `Not enough ${shortfall}.`;
}
