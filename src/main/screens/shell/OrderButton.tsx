import { type JSX, useEffect, useId, useRef, useState } from "react";
import type { Scenario } from "../../engine/types";
import { orderButtonLabel, type PlanningSession } from "../../state/planning";
import { OrderMenu } from "./OrderMenu";

/**
 * N1: the button after the unit list, "Order for 3 selected units". It opens the selection's order
 * menu: under the button on a desktop, as a bottom sheet on a phone. Leaving it, Escape
 * or an order closes it; after the last two focus returns to the button. With nothing selected it stays focusable
 * and says what to do, so an order just given does not drop focus.
 */
export function OrderButton({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const count = session.draft.selectedUnitIds.length;
  const shown = open && count > 0;
  const label = orderButtonLabel(count);
  const close = (): void => {
    setOpen(false);
    button.current?.focus();
  };

  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: Event): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [shown]);

  return (
    <div
      className="order-button-place"
      onBlur={(event) => { if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      ref={root}
    >
      <button
        aria-controls={shown ? menuId : undefined}
        aria-disabled={count === 0 ? true : undefined}
        aria-expanded={shown}
        className="order-button"
        onClick={() => { setOpen(count > 0 && !shown); }}
        ref={button}
        type="button"
      >
        {label}
      </button>
      {shown ? (
        <div className="order-menu" id={menuId}>
          <p className="order-menu-title">{label}</p>
          <OrderMenu focusFirst label={label} onChosen={close} rows scenario={scenario} session={session} />
        </div>
      ) : null}
    </div>
  );
}
