import { type JSX, useId } from "react";
import { useAppDispatch } from "../hooks";
import { chooseOrderKind, toggleOrderMenu } from "../state/gameSlice";
import type { OrderKind } from "../state/session";

/** Player-facing name and one-line explanation for each order type. */
const orderLabels: Readonly<Record<OrderKind, { readonly description: string; readonly label: string }>> = {
  entrench: { description: "Stay and dig in. Only healthy armies entrench.", label: "Entrench" },
  move: { description: "March to a neighboring territory.", label: "Move" },
  rest: { description: "Stay and recover. Demoralized armies rest instead of entrenching.", label: "Rest" }
};

export function armies(count: number): string {
  return `${String(count)} ${count === 1 ? "army" : "armies"}`;
}

/** Brings the order choice into view as it opens, for the short mobile sheet. */
function revealWhenShown(element: HTMLElement | null): void {
  element?.scrollIntoView({ block: "nearest" });
}

interface OrderCommandProps {
  /** Armies in the territory that have no move order. */
  readonly availableCount: number;
  /** The order types offered for the selected armies, in menu order. */
  readonly kinds: readonly OrderKind[];
  readonly menuOpen: boolean;
  readonly selectedCount: number;
}

/** "Give Selected Armies Order" and, once open, the order types it offers. */
export function OrderCommand({ availableCount, kinds, menuOpen, selectedCount }: OrderCommandProps): JSX.Element {
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
        <span>Give Selected Armies Order</span>
        <svg aria-hidden="true" className="order-button-caret" focusable="false" viewBox="0 0 12 8">
          <path d="M1.5 1.75 6 6.25l4.5-4.5" />
        </svg>
      </button>
      {selectedCount === 0 ? (
        <p className="pane-hint" id={hintId}>
          {availableCount === 0 ? "Every army here is moving. Select one to change its order." : "Select at least one army to give an order."}
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
              <span className="order-choice-description" id={`${ids}-${kind}`}>{orderLabels[kind].description}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
