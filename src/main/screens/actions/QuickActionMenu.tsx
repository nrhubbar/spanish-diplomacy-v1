import { type JSX, useEffect, useId, useRef } from "react";
import type { PointerInput } from "../../map/view";
import { actionName, type QuickActionKind, type QuickActionMenu as Menu } from "../../presentation/quickActions";
import type { MapPoint } from "../../scenarios/loader";
import { cssVariables } from "../../presentation/style";
import { ActionIcon } from "./ActionIcon";

interface QuickActionMenuProps {
  readonly at: MapPoint;
  /** A mouse opens a dropdown at the cursor; a finger opens a wheel around it. */
  readonly input: PointerInput;
  readonly menu: Menu;
  readonly onChoose: (kind: QuickActionKind) => void;
  readonly onClose: () => void;
}

/** Where the wheel puts each action, as a share of a turn clockwise from the top. */
function wheelAngle(index: number, count: number): number {
  return (index / count) * 2 * Math.PI;
}

/**
 * U5: a territory's quick actions. On a desktop a dropdown at the cursor, on a phone a wheel
 * around the finger. An action that can't be used here is greyed out and says why (on hover,
 * and to screen readers in its name). Escape, a click outside or a choice closes it.
 */
export function QuickActionMenu({ at, input, menu, onChoose, onClose }: QuickActionMenuProps): JSX.Element {
  const titleId = useId();
  const first = useRef<HTMLButtonElement>(null);
  // Focus the first action once, when the menu opens.
  useEffect(() => { first.current?.focus(); }, []);
  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("keydown", close); };
  }, [onClose]);
  const wheel = input === "touch";
  return (
    <div className="quick-actions-layer" onClick={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }} role="presentation">
      <div
        aria-labelledby={titleId}
        className={wheel ? "quick-actions quick-actions-wheel" : "quick-actions quick-actions-dropdown"}
        data-ground={menu.ground}
        onClick={(event) => { event.stopPropagation(); }}
        role="menu"
        style={cssVariables({ "--at-x": `${String(at.x)}px`, "--at-y": `${String(at.y)}px` })}
      >
        <div className="quick-actions-head">
          <span className="quick-actions-title" id={titleId}>{menu.title}</span>
          <span className="quick-actions-status">{menu.status}</span>
        </div>
        {menu.actions.map((action, index) => {
          const angle = wheelAngle(index, menu.actions.length);
          return (
            <button
              aria-disabled={action.reason === undefined ? undefined : true}
              aria-label={actionName(action)}
              className="quick-action"
              data-action={action.kind}
              key={action.kind}
              onClick={() => { if (action.reason === undefined) onChoose(action.kind); }}
              ref={index === 0 ? first : undefined}
              role="menuitem"
              style={wheel ? cssVariables({ "--wheel-x": Math.sin(angle).toFixed(3), "--wheel-y": (-Math.cos(angle)).toFixed(3) }) : undefined}
              title={action.reason}
              type="button"
            >
              <ActionIcon name={action.kind} />
              <span className="quick-action-label">{action.label}</span>
              {wheel ? null : <span className="quick-action-detail">{action.detail}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
