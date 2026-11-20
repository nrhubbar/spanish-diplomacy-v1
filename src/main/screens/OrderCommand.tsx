import { type JSX, useId } from "react";
import { useAppDispatch } from "../hooks";
import { armies } from "../presentation/text";
import { chooseOrderKind, toggleOrderMenu } from "../state/gameSlice";
import type { BlockedOrder } from "../state/planning";
import type { OrderKind } from "../state/session";

/** Player-facing name and one-line explanation for each order type. */
const orderLabels: Readonly<Record<OrderKind, { readonly description: string; readonly label: string }>> = {
  attack: { description: "Default here. Fight for the territory where you stand.", label: "Attack" },
  entrench: { description: "Stay and dig in. Only healthy units entrench.", label: "Entrench" },
  hold: { description: "Default for demoralized units here: hold and defend.", label: "Hold" },
  move: { description: "March to a neighboring territory.", label: "Move" },
  rest: { description: "Stay and recover. Demoralized units rest instead of entrenching.", label: "Rest" },
  replenish: { description: "Restore men and morale. Cancelled and refunded if the unit fights.", label: "Replenish" },
  withdraw: { description: "Leave for a neighbouring territory you hold, through your own sub-territories.", label: "Withdraw" }
};

/** Brings the order choice into view as it opens, for the short mobile sheet. */
function revealWhenShown(element: HTMLElement | null): void {
  element?.scrollIntoView({ block: "nearest" });
}

interface OrderCommandProps {
  /** Armies in the territory that have no move order. */
  readonly availableCount: number;
  /** C1: order kinds shown greyed out, with the reason (contested ground). */
  readonly blocked?: readonly BlockedOrder[];
  /** Descriptions that depend on the board, such as where a Withdraw leads (C1). */
  readonly descriptions?: Partial<Readonly<Record<OrderKind, string>>>;
  /** A description for this selection in place of the general one (R5: Replenish's men, cost and arrival). */
  readonly details?: Partial<Readonly<Record<OrderKind, string>>>;
  /** The order types offered for the selected armies, in menu order. */
  readonly kinds: readonly OrderKind[];
  readonly menuOpen: boolean;
  readonly selectedCount: number;
}

/** "Give Selected Units Order" and, once open, the order types it offers. */
export function OrderCommand({ availableCount, blocked = [], descriptions = {}, details, kinds, menuOpen, selectedCount }: OrderCommandProps): JSX.Element {
  const dispatch = useAppDispatch();
  const ids = useId();
  const hintId = `${ids}-hint`;
  const menuId = `${ids}-menu`;
  return (
    <div className="order-command" data-menu-open={menuOpen}>
      <button
        aria-controls={menuOpen ? menuId : undefined}
        aria-describedby={selectedCount === 0 ? hintId : undefined}
        aria-expanded={menuOpen}
        className="order-button"
        disabled={selectedCount === 0}
        onClick={() => dispatch(toggleOrderMenu())}
        type="button"
      >
        <span>Give Selected Units Order</span>
        <svg aria-hidden="true" className="order-button-caret" focusable="false" viewBox="0 0 12 8">
          <path d="M1.5 1.75 6 6.25l4.5-4.5" />
        </svg>
      </button>
      {selectedCount === 0 ? (
        <p className="pane-hint" id={hintId}>
          {availableCount === 0 ? "Every unit here is moving. Select one to change its order." : "Select at least one unit to give an order."}
        </p>
      ) : null}
      {menuOpen ? (
        <div aria-label={`Order for ${armies(selectedCount)}`} className="order-menu" id={menuId} ref={revealWhenShown} role="group">
          {kinds.map((kind) => (
            // The whole card is the button's hit area; the description stays outside its name.
            <div className="order-choice" data-order-kind={kind} key={kind}>
              <span aria-hidden="true" className="order-choice-icon" />
              <button
                aria-describedby={`${ids}-${kind}`}
                className="order-choice-button"
                onClick={() => dispatch(chooseOrderKind(kind))}
                type="button"
              >
                {orderLabels[kind].label}
              </button>
              <span className="order-choice-description" id={`${ids}-${kind}`}>{details?.[kind] ?? descriptions[kind] ?? orderLabels[kind].description}</span>
            </div>
          ))}
          {blocked.map((entry, index) => (
            <div aria-disabled="true" className="order-choice" data-blocked="true" key={entry.label}>
              <span aria-hidden="true" className="order-choice-icon" />
              <span className="order-choice-label" id={`${ids}-blocked-${String(index)}`}>{entry.label}</span>
              <span className="order-choice-description">{entry.reason}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
