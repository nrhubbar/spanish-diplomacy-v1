import { type JSX, useId, useMemo, useState } from "react";
import { requireUnitState } from "../../../engine/lookup";
import { useAppDispatch } from "../../../hooks";
import { orderStatus } from "../../../presentation/army";
import { groupThisTurn, ordersGivenLine, thisTurnEntries, type ThisTurnGrouping } from "../../../presentation/thisTurn";
import { airDraftOrders, orderCounts, orderOf, type PlanningSession } from "../../../state/planning";
import type { Scenario, UnitId } from "../../../engine/types";
import { orderLabels } from "../../../state/planning/orderChoices";
import { PlannedOddsInfo, PlannedOrderOdds } from "../../PlannedOrderOdds";
import { cancelAction } from "../cancel";
import type { PaneViewProps } from "./types";

const groupings: readonly { readonly id: ThisTurnGrouping; readonly label: string }[] = [
  { id: "type", label: "By type" },
  { id: "region", label: "By region" }
];

/**
 * U3: the pane's default view, the orders given so far this turn, grouped by type or by region,
 * each with Cancel. Clicking a territory opens Territory Info on top of it.
 */
export function ThisTurnView({ scenario, session }: Pick<PaneViewProps, "scenario" | "session">): JSX.Element {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const [by, setBy] = useState<ThisTurnGrouping>("type");
  const { draft, game } = session;
  const entries = useMemo(
    () => thisTurnEntries(scenario, { ...draft, airOrders: airDraftOrders(draft), stays: stayOrders(scenario, session) }, (unitId) => requireUnitState(game.state, unitId).territoryId),
    [draft, game.state, scenario, session]
  );
  const groups = groupThisTurn(scenario, entries, by);

  return (
    <section aria-labelledby={headingId} className="pane-section this-turn">
      <div className="this-turn-head">
        <h3 className="visually-hidden" id={headingId}>Orders this turn</h3>
        <p className="pane-meta">{ordersGivenLine(game.state.turnNumber, entries)}</p>
        <div aria-label="Group the orders" className="segmented" role="group">
          {groupings.map((grouping) => (
            <button aria-pressed={by === grouping.id} key={grouping.id} onClick={() => { setBy(grouping.id); }} type="button">{grouping.label}</button>
          ))}
        </div>
      </div>
      <OrderSummary session={session} scenario={scenario} />
      {groups.length === 0 ? (
        <p className="pane-hint">No orders yet. Click a territory to see its units, or select your units on the map. Armies without an order entrench, or rest while demoralized.</p>
      ) : groups.map((group) => (
        <div className="this-turn-group" key={group.key}>
          <h4>{group.label} <span className="count-badge">{group.count}</span></h4>
          <ul aria-label={`${group.label} (${String(group.count)})`} className="order-list">
            {group.entries.map((entry) => (
              <li key={entry.key}>
                <span>
                  <span className="order-unit">{entry.title}</span>
                  <span className="order-route">{entry.detail}</span>
                  {entry.move === undefined ? null : <PlannedOrderOdds scenario={scenario} session={session} territoryId={entry.move.to} />}
                </span>
                <button aria-label={`Cancel ${entry.title}`} className="text-button" onClick={() => dispatch(cancelAction(entry.cancel))} type="button">Cancel</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <PlannedOddsInfo scenario={scenario} session={session} />
    </section>
  );
}

/** U2: the armies told to stay that have no other order, each named by the order it follows. */
function stayOrders(scenario: Scenario, session: PlanningSession): readonly { readonly label: string; readonly unitId: UnitId }[] {
  const { draft, game } = session;
  return (draft.orderedToStay ?? []).flatMap((unitId) => {
    const unit = game.state.units[unitId];
    if (unit === undefined) return [];
    const kind = orderOf(session, unit, scenario);
    return kind === "disband" || kind === "move" || kind === "withdraw" || kind === "replenish" ? [] : [{ label: orderLabels[kind].label, unitId }];
  });
}

/** O1: every army has one order, so the counts add up to all of the player's armies. */
function OrderSummary({ scenario, session }: Pick<PaneViewProps, "scenario" | "session">): JSX.Element {
  const counts = orderCounts(session, scenario);
  // C1: contested-ground kinds join the line once any army has one.
  const extra = (["withdraw", "attack", "replenish", "disband", "hold"] as const).flatMap((kind) => {
    const count = counts[kind] ?? 0;
    return count === 0 ? [] : [`${String(count)} ${orderStatus[kind].toLowerCase()}`];
  });
  return (
    <p className="pane-meta order-summary">
      {[`${String(counts.move)} moving`, ...extra, `${String(counts.entrench)} entrenching`, `${String(counts.rest)} resting`].join(", ")}
    </p>
  );
}
