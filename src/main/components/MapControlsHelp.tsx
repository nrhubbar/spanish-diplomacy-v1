import type { JSX } from "react";

/** How to move around the map. The one source for Settings and the Briefing. */
const mapControlHints: readonly string[] = [
  "Drag, or hold W, A, S, and D or the arrow keys, to pan.",
  "Scroll, pinch, or use + and the minus key to zoom. Press 0 to reset the view.",
  "Tab to a territory or unit and press Enter to select it."
];

export function MapControlsHelp(): JSX.Element {
  return (
    <ul className="plain-list">
      {mapControlHints.map((hint) => <li key={hint}>{hint}</li>)}
    </ul>
  );
}
