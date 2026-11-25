import { unitTypeIn } from "../engine/air/pieces";
import { sumResources } from "../engine/economy/resources";
import { capitalOf, meetsRequirement, priceReplenishments, replenishQuote } from "../engine/recruitment/rules";
import type { BuildingDefinition, BuildingId, DevelopmentDefinition, FactionId, GameState, ResourceId, Resources, Scenario, TerritoryId, TrainingItem, UnitId, UnitState, UnitTypeDefinition, UpkeepRules } from "../engine/types";
import { amountText, resourceAmount } from "./economy";
import { glyphs } from "./glyphs";
import { tenths } from "./numbers";
import { requirementName } from "./refusals";
import { unitName } from "./text";

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
  return `${tenths(men / 1000)}k men`;
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

/** What a territory recruits with: a building in its capital (by its definition, when the scenario has it), or a development track some type needs. */
export interface RecruitsWith {
  readonly building?: BuildingDefinition | undefined;
  readonly name: string;
  readonly track?: DevelopmentDefinition | undefined;
}

/** X4, D3: what a faction recruits with there: the buildings in the capital, then the development tracks some type needs. */
export function recruitsWith(scenario: Scenario, state: Pick<GameState, "subTerritories">, factionId: FactionId, territoryId: TerritoryId, standing: readonly BuildingId[]): readonly RecruitsWith[] {
  const met = scenario.unitTypes
    .flatMap((type) => type.recruit?.requires ?? [])
    .flatMap((requirement) => (requirement.kind === "development" && meetsRequirement(scenario, state, factionId, territoryId, requirement) ? [requirement.developmentId] : []));
  return [
    ...standing.map((id) => {
      const building = scenario.index.buildings.get(id);
      return { building, name: building?.name ?? id };
    }),
    ...scenario.development.flatMap((track) => (met.includes(track.id) ? [{ name: track.name, track }] : []))
  ];
}

/** What a term of raising a type tells: its price, its men, its training time or its upkeep. */
export type TermKind = "cost" | "men" | "training" | "upkeep";

/** X4: one term of raising a type, as the row's meta line and its tooltip print it. */
export interface RecruitTerm {
  readonly detail: string;
  readonly kind: TermKind;
  readonly meta: string;
}

/** X4: a type's price, men and training time, in the order they are printed. */
export function recruitTerms(scenario: Scenario, type: UnitTypeDefinition): readonly RecruitTerm[] {
  const cost = resourcesLabel(scenario, type.recruit?.cost ?? {}, ` ${glyphs.dot} `);
  const men = menShort(type.recruit?.establishment ?? 0);
  const turns = turnsLabel(type.recruit?.trainingTurns ?? 0);
  const upkeep = upkeepLabel(scenario, type);
  return [
    { detail: cost, kind: "cost", meta: cost }, { detail: men, kind: "men", meta: men }, { detail: `trains in ${turns}`, kind: "training", meta: turns },
    ...(upkeep === undefined ? [] : [{ detail: `upkeep ${upkeep} a turn`, kind: "upkeep" as const, meta: `upkeep ${upkeep}` }])
  ];
}

/** D1: what a type's upkeep takes a turn: "0.25k Manpower", or undefined for a type with none. */
function upkeepLabel(scenario: Scenario, type: Pick<UnitTypeDefinition, "upkeep">): string | undefined {
  return scenario.upkeep === undefined || Object.keys(type.upkeep).length === 0 ? undefined : resourcesLabel(scenario, type.upkeep, " and ");
}

/** D1, N1: what disbanding units of these types saves together: "Saves 3.3k Manpower a turn". */
export function disbandSaving(scenario: Scenario, types: readonly Pick<UnitTypeDefinition, "upkeep">[]): string {
  const upkeep = upkeepLabel(scenario, { upkeep: sumResources(...types.map((type) => type.upkeep)) });
  return upkeep === undefined ? "Costs no upkeep" : `Saves ${upkeep} a turn`;
}

/** N1: the second step of Disband: "Disband Madrid Sierra Columns? Saves 1.5k Manpower a turn." Up to two units are named, more are counted. */
export function disbandQuestion(scenario: Scenario, state: Pick<GameState, "raised">, unitIds: readonly UnitId[]): string {
  const types = unitIds.flatMap((unitId) => unitTypeIn(scenario, state.raised, unitId) ?? []);
  return `Disband ${unitsNamed(scenario, unitIds)}? ${disbandSaving(scenario, types)}${unitIds.length > 1 ? " together" : ""}.`;
}

/** Up to two units by name, "Puerto Column and Sierra Column"; more as "3 units". */
export function unitsNamed(scenario: Scenario, unitIds: readonly UnitId[]): string {
  return unitIds.length > 2 ? `${String(unitIds.length)} units` : unitIds.map((unitId) => unitName(scenario, unitId)).join(" and ");
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

/** One amount of a resource, for a row of icons: the number, and the resource it counts. */
export interface ResourceCell {
  readonly id: ResourceId;
  readonly name: string;
  readonly text: string;
}

/** An amount as one cell per resource, in scenario order. With `every`, resources it has none of are cells too. */
export function resourceCells(scenario: Scenario, amount: Resources, every = false): readonly ResourceCell[] {
  return scenario.resources.flatMap(({ id, name }) => {
    const value = amount[id] ?? 0;
    return value === 0 && !every ? [] : [{ id, name, text: resourceAmount(scenario, id, value) }];
  });
}

/** The same reason in a few words, for the lines every row keeps for it, and the term it is about. */
export function recruitAddNote(slotsFull: boolean, shortfall: string, upkeep: string | undefined): { readonly term?: TermKind; readonly text: string } | undefined {
  if (slotsFull) return { text: "No orders left" };
  if (shortfall !== "") return { term: "cost", text: `Not enough ${shortfall}` };
  return upkeep === undefined ? undefined : { term: "upkeep", text: "Upkeep too high next turn" };
}

/** X4: the buildings and development a type needs in a territory, each marked whether the faction has it. */
export function recruitRequirements(scenario: Scenario, state: Pick<GameState, "subTerritories">, factionId: FactionId, territoryId: TerritoryId, type: UnitTypeDefinition): readonly { readonly have: boolean; readonly name: string }[] {
  return (type.recruit?.requires ?? []).map((requirement) => ({ have: meetsRequirement(scenario, state, factionId, territoryId, requirement), name: requirementName(scenario, requirement) }));
}

/** X4: why one more of a type cannot be added: its locks, the turn's Recruit orders used up, the price, or next turn's upkeep (D1). */
export function recruitAddReason(locked: readonly string[], slotsFull: boolean, shortfall: string, upkeep?: string): string | undefined {
  return locked.length > 0 ? locked.join(" ") : slotsFull ? "No Recruit orders left here this turn." : shortfall === "" ? upkeep : `Not enough ${shortfall}.`;
}
