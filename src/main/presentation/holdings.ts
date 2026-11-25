import { isCapital } from "../engine/economy/catalogue";
import { subTerritoryYield } from "../engine/economy/income";
import { sumResources } from "../engine/economy/resources";
import { requireSubTerritory, requireTerritory } from "../engine/lookup";
import { heldBy, holdersIn, isContested, isPartitioned, subTerritoriesOf } from "../engine/partition/holders";
import { capitalOf, holdsTerritory } from "../engine/recruitment/rules";
import type { FactionId, GameState, Scenario, SubTerritoryDefinition, TerritoryId } from "../engine/types";
import { signedAmountText } from "./economy";
import { factionName } from "./text";

/** Who holds a territory, sub-territory by sub-territory, as the pane and the map show it (W6, M12). */

/** Whether the board is drawn, and fought over, in sub-territories. */
export function hasSubTerritories(scenario: Scenario): boolean {
  return isPartitioned(scenario);
}

/** A territory's sub-territories, in scenario order. */
export function subTerritoriesIn(scenario: Scenario, territoryId: TerritoryId): readonly SubTerritoryDefinition[] {
  return subTerritoriesOf(scenario, territoryId);
}

/** A territory's sub-territories as a list to open, each marked when it is the capital (W3); empty when the board has none. */
export function subTerritoryEntries(scenario: Scenario, territoryId: TerritoryId): readonly { readonly capital: boolean; readonly sub: SubTerritoryDefinition }[] {
  if (!isPartitioned(scenario)) return [];
  return subTerritoriesOf(scenario, territoryId).map((sub) => ({ capital: isCapital(scenario, sub), sub }));
}

/** M12: builds here pause and the territory pays nothing, for several factions hold parts of it. */
export function buildsPaused(scenario: Scenario, state: Pick<GameState, "subTerritories">, territoryId: TerritoryId): boolean {
  return holdersIn(scenario, state.subTerritories, territoryId).length > 1;
}

/** W6, C1: how many of a contested territory's sub-territories the viewer holds; undefined elsewhere. */
export function contestedShare(scenario: Scenario, state: GameState, territoryId: TerritoryId, viewer: FactionId): { readonly own: number; readonly total: number } | undefined {
  if (!isPartitioned(scenario) || !isContested(scenario, state, territoryId)) return undefined;
  return { own: heldBy(scenario, state.subTerritories, territoryId, viewer).length, total: subTerritoriesOf(scenario, territoryId).length };
}

/** M5, R2, W3: where the viewer recruits in a territory, "paused" in contested ground; undefined when it doesn't. */
export function recruitingAt(scenario: Scenario, state: GameState, territoryId: TerritoryId, viewer: FactionId): { readonly place: string } | "paused" | undefined {
  if (scenario.rules.recruitment === "none") return undefined;
  if (isContested(scenario, state, territoryId)) return "paused";
  if (!holdsTerritory(scenario, state, viewer, territoryId)) return undefined;
  const capital = capitalOf(scenario, territoryId);
  return { place: capital === undefined ? requireTerritory(scenario, territoryId).name : requireSubTerritory(scenario, capital).name };
}

export interface TerritoryIncome {
  /** The viewer holds it whole. */
  readonly own: boolean;
  /** Contested: it pays nobody. */
  readonly paused: boolean;
  readonly text: string;
}

/** $2, M12: what a territory pays a turn and to whom; undefined without an economy or a holder. */
export function territoryIncome(scenario: Scenario, state: Pick<GameState, "subTerritories">, territoryId: TerritoryId, viewer: FactionId): TerritoryIncome | undefined {
  if (scenario.rules.economy === "none") return undefined;
  const [holder, ...others] = holdersIn(scenario, state.subTerritories, territoryId);
  if (holder === undefined) return undefined;
  if (others.length > 0) return { own: false, paused: true, text: "No income" };
  const total = sumResources(...subTerritoriesOf(scenario, territoryId).flatMap((sub) => {
    const site = state.subTerritories[sub.id];
    return site === undefined ? [] : [subTerritoryYield(scenario, site)];
  }));
  const amount = signedAmountText(scenario, total);
  const text = amount === "nothing" ? "Pays nothing" : `Pays ${amount} a turn`;
  const own = holder === viewer;
  return { own, paused: false, text: own ? text : `${text} to ${factionName(scenario, holder)}` };
}
