import type { JSX } from "react";
import type { RouteChipKind } from "../../presentation/movement";

/**
 * X8: small line icons for the move chips, drawn in the text colour. Decorative: the chip's
 * words carry the meaning.
 */
export function MoveIcon({ kind }: { readonly kind: RouteChipKind | "truck" }): JSX.Element {
  return (
    <svg aria-hidden="true" className="move-icon" focusable="false" height="12" viewBox="0 0 16 16" width="12">
      {iconPaths[kind]}
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.6 } as const;

const iconPaths: Readonly<Record<RouteChipKind | "truck", JSX.Element>> = {
  fatigue: <path d="M3 13 L6 6 L9 10 L13 3" {...stroke} />,
  moves: <path d="M2 8 H12 M9 4.5 L12.5 8 L9 11.5" {...stroke} />,
  rail: <path d="M5 1.5 L3.5 14.5 M11 1.5 L12.5 14.5 M3.8 4.5 H12.2 M3.6 8 H12.4 M3.4 11.5 H12.6" {...stroke} />,
  sea: <path d="M8 2 V13 M4.5 5 H11.5 M2.5 9.5 C3.5 13 12.5 13 13.5 9.5" {...stroke} />,
  terrain: <path d="M1.5 13.5 L6 5 L9 10 L11 7 L14.5 13.5 Z" {...stroke} />,
  transit: <path d="M3 8 A1.5 1.5 0 1 0 3 8.01 M8 8 A1.5 1.5 0 1 0 8 8.01 M13 8 A1.5 1.5 0 1 0 13 8.01" {...stroke} />,
  truck: <path d="M1.5 4 H10 V11 H1.5 Z M10 6.5 H13 L14.5 9 V11 H10 M4 12.5 A1.2 1.2 0 1 0 4 12.51 M12 12.5 A1.2 1.2 0 1 0 12 12.51" {...stroke} />,
  weather: <path d="M8 4.5 A3.5 3.5 0 1 0 8.01 4.5 M8 1 V2.2 M8 13.8 V15 M1 8 H2.2 M13.8 8 H15 M3 3 L3.9 3.9 M12.1 12.1 L13 13 M3 13 L3.9 12.1 M12.1 3.9 L13 3" {...stroke} />
};
