import { routeNames } from "../../engine/partition/paths";
import type { Scenario } from "../../engine/types";
import { territoryName } from "../../presentation/text";
import type { OrderKind } from "../session";
import { blockedOrders, enemyPresent, selectedWithdrawRoutes } from "./contested";
import { replenishSelectionDetail } from "./recruitment";
import { orderKindsFor, type PlanningSession } from "./selection";

/** Player-facing name and one-line explanation for each order type. */
export const orderLabels: Readonly<Record<OrderKind, { readonly description: string; readonly label: string }>> = {
  attack: { description: "Default here. Fight for the territory where you stand.", label: "Attack" },
  disband: { description: "Send home at the end of the turn. Nothing comes back, and the upkeep is saved.", label: "Disband" },
  entrench: { description: "Stay and dig in. Only healthy units entrench.", label: "Entrench" },
  hold: { description: "Default for demoralized units here: hold and defend.", label: "Hold" },
  move: { description: "March to a neighboring territory.", label: "Move" },
  rest: { description: "Stay and recover. Demoralized units rest instead of entrenching.", label: "Rest" },
  replenish: { description: "Restore men and morale. Cancelled and refunded if the unit fights.", label: "Replenish" },
  withdraw: { description: "Leave for a neighbouring territory you hold, through your own sub-territories.", label: "Withdraw" }
};

/** One button of the selection bar: an order to give, or (with a reason) one shown greyed out. */
export interface OrderChoice {
  readonly description: string;
  /** Set when the order cannot be given here; the button is disabled and says why. */
  readonly disabledReason?: string;
  readonly key: string;
  /** Undefined for a greyed-out group of orders (contested ground). */
  readonly kind?: OrderKind;
  readonly label: string;
}

/**
 * U4: the selection bar's buttons for the selected armies, in menu order (O2): their order
 * types with descriptions that fit this selection (Replenish's men and cost, R5; where Withdraw
 * leads, C1), then in contested ground the orders not allowed there, greyed out with the reason.
 */
export function orderChoices(scenario: Scenario, session: PlanningSession): readonly OrderChoice[] {
  if (session.draft.selectedUnitIds.length === 0) return [];
  const kinds = orderKindsFor(session, scenario);
  const contested = kinds.includes("withdraw") ? contestedDescriptions(scenario, session) : {};
  const details: Partial<Record<OrderKind, string>> = { ...contested, ...(kinds.includes("replenish") ? { replenish: replenishSelectionDetail(scenario, session) } : {}) };
  const choices = kinds.map((kind): OrderChoice => ({ description: details[kind] ?? orderLabels[kind].description, key: kind, kind, label: orderLabels[kind].label }));
  const blocked = kinds.includes("withdraw")
    ? blockedOrders(scenario).map((entry): OrderChoice => ({ description: entry.reason, disabledReason: entry.reason, key: entry.label, label: entry.label }))
    : [];
  return [...choices, ...blocked];
}

/**
 * C1 (Q-UX-14): in contested ground Attack (the default) and Withdraw, naming where Withdraw
 * leads and through which of the player's own sub-territories.
 */
function contestedDescriptions(scenario: Scenario, session: PlanningSession): Partial<Record<OrderKind, string>> {
  const territoryId = session.draft.selectedTerritoryId;
  if (territoryId === undefined) return {};
  const routes = selectedWithdrawRoutes(scenario, session);
  const territory = territoryName(scenario, territoryId);
  const through = [...new Set(routes.flatMap((route) => routeNames(scenario, route)))];
  return {
    attack: enemyPresent(session, territoryId)
      ? `Default here. Joins the standing battle for ${territory}; +1 fatigue.`
      : `Default here. Takes one enemy sub-territory of ${territory} a turn, the capital last.`,
    withdraw: routes.length === 0
      ? "No way out: every neighbouring territory you hold is cut off from your sub-territories here."
      : `To ${orList(routes.map((route) => territoryName(scenario, route.to)))}, through your own sub-territories (${through.join(", ")}).`
  };
}

function orList(names: readonly string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${String(names.at(-1))}`;
}

/** N1: the button after the unit list: "Order for 3 selected units", or what to do first. */
export function orderButtonLabel(count: number): string {
  return count === 0 ? "Select units first" : `Order for ${String(count)} selected ${count === 1 ? "unit" : "units"}`;
}

/** "3 units selected". */
export function selectionLabel(count: number): string {
  return `${String(count)} ${count === 1 ? "unit" : "units"} selected`;
}
