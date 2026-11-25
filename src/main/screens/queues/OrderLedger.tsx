import type { JSX } from "react";
import { requireUnitType } from "../../engine/lookup";
import type { RecruitOrder, Scenario } from "../../engine/types";
import { resourceCells } from "../../presentation/recruitment";
import { ResourceCells, UnitSymbol } from "./RecruitRow";

interface OrderLedgerProps {
  readonly label: string;
  readonly onCancel: (at: number) => void;
  /** This turn's Recruit orders here, in the order they were given. */
  readonly orders: readonly RecruitOrder[];
  readonly scenario: Scenario;
  /** How many the territory may give this turn. */
  readonly slots: number;
}

/**
 * N2: the territory's Recruit orders as a ledger, one line for each it has, given or "Empty", so
 * giving an order moves nothing. An empty line keeps its button (out of the tab order and out of
 * sight), so the line just emptied keeps the keyboard's focus.
 */
export function OrderLedger({ label, onCancel, orders, scenario, slots }: OrderLedgerProps): JSX.Element {
  return (
    <ol aria-label={label} className="roll-ledger">
      {Array.from({ length: Math.max(slots, orders.length) }, (_, at) => {
        const order = orders[at];
        const place = at < slots ? `order ${String(at + 1)} of ${String(slots)}` : `order ${String(at + 1)}`;
        const type = order === undefined ? undefined : requireUnitType(scenario, order.unitTypeId);
        return (
          <li className="roll-ledger-line order-line" data-filled={order !== undefined} key={at}>
            {order === undefined || type === undefined ? <span className="order-line-name">Empty</span> : (
              <>
                <UnitSymbol factionId={order.factionId} scenario={scenario} typeId={order.unitTypeId} />
                <span className="order-line-name" title={type.name}>{type.name}</span>
                <span className="roll-ledger-value"><ResourceCells cells={resourceCells(scenario, type.recruit?.cost ?? {}, true)} scenario={scenario} /></span>
              </>
            )}
            <button
              aria-disabled={order === undefined}
              aria-label={type === undefined ? `Nothing to cancel, ${place}` : `Cancel ${type.name}, ${place}`}
              className="text-button"
              onClick={order === undefined ? undefined : () => { onCancel(at); }}
              tabIndex={order === undefined ? -1 : undefined}
              type="button"
            >
              Cancel
            </button>
          </li>
        );
      })}
    </ol>
  );
}
