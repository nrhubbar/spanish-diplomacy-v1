import type { JSX } from "react";
import { useAppDispatch } from "../../hooks";
import { openView, type PaneViewKind, popView } from "../../state/paneSlice";
import { ShellIcon, type ShellIconName } from "./ShellIcon";

export interface TurnNavProps {
  /** The kind of view the pane shows now, so its button reads as pressed. */
  readonly active: PaneViewKind;
  /** Units in training and in this turn's Recruit basket; undefined without recruitment. */
  readonly recruiting: number | undefined;
  /** Build queue items and this turn's builds; undefined without an economy. */
  readonly building: number | undefined;
}

/**
 * U1: Last turn, Recruitment (n) and Building (n) in the top bar. Each opens its view in the
 * pane on top of This turn; pressing the shown one again goes back.
 */
export function TurnNav({ active, building, recruiting }: TurnNavProps): JSX.Element {
  const dispatch = useAppDispatch();
  const item = (kind: "lastTurn" | "recruitment" | "building", icon: ShellIconName, label: string, count?: number): JSX.Element => (
    <button
      aria-pressed={active === kind}
      className="turn-nav-button"
      key={kind}
      onClick={() => dispatch(active === kind ? popView() : openView({ kind }))}
      type="button"
    >
      <ShellIcon name={icon} />
      <span className="turn-nav-label">{label}</span>
      {count === undefined ? null : <>{" "}<span className="count-badge">{count}</span></>}
    </button>
  );
  return (
    <nav aria-label="This turn's views" className="turn-nav">
      {item("lastTurn", "history", "Last turn")}
      {recruiting === undefined ? null : item("recruitment", "flag", "Recruitment", recruiting)}
      {building === undefined ? null : item("building", "chimney", "Building", building)}
    </nav>
  );
}
