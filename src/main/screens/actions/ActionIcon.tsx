import type { JSX } from "react";
import type { MoveMode } from "../../engine/network/reach";
import type { QuickActionKind } from "../../presentation/quickActions";

/** U5, U6: line icons for the quick actions and the move modes, on a 24-unit grid in `currentColor`. */
export type ActionIconName = QuickActionKind | MoveMode;

const paths: Readonly<Record<ActionIconName, string>> = {
  build: "M14 4l6 6-3 3-6-6zM11 7L3 15l3 3 8-8M5 21h6",
  info: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 11v6M12 7.5v.5",
  invade: "M4 20L14 10M14 10V5h5M14 10h5V5M4 4l6 6M10 4H4v6",
  march: "M9 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M8 9l-2 5 3 1v6M8 9l4 1 2 4M9 15l4 6",
  motor: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 1 0-.1M17 19a2 2 0 1 1 0-.1",
  rail: "M7 3l-3 18M17 3l3 18M6 8h12M5 13h14M4.5 18h15",
  recruit: "M5 21V4h11l-2 4 2 4H5",
  reinforce: "M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6zM12 8v8M8 12h8",
  sea: "M3 17c3 2 6 2 9 0s6-2 9 0M6 14l1-6h10l1 6M12 4v4"
};

/** Decorative: the text beside it carries the meaning. */
export function ActionIcon({ name }: { readonly name: ActionIconName }): JSX.Element {
  return (
    <svg aria-hidden="true" className="action-icon" focusable="false" viewBox="0 0 24 24">
      <path d={paths[name]} />
    </svg>
  );
}
