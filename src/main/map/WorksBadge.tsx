import type { JSX } from "react";

/**
 * The works badge, a compact derivative of the "dug-in" medallion: the same ink body and
 * battlement glyph, with one pip per level filled out of the scenario's deepest level, so the
 * level reads at counter size where the medallion's pips would not.
 */
export function WorksBadge({ level, max }: { readonly level: number; readonly max: number }): JSX.Element {
  const slots = Math.max(level, Math.min(max, 4));
  const width = 15 + slots * 4.4;
  return (
    <svg aria-hidden="true" className="unit-counter-works" data-level={level} focusable="false" height={13} viewBox={`0 0 ${String(width)} 13`} width={width}>
      <rect fill="#241d18" height={11.6} rx={3} stroke="#fffaf0" strokeWidth={1.4} width={width - 1.4} x={0.7} y={0.7} />
      <path d="M3.4 9.6 V3.8 H5.2 V5.4 H6.8 V3.8 H8.6 V5.4 H10.2 V3.8 H12 V9.6 Z" fill="#fffaf0" />
      {Array.from({ length: slots }, (_, index) => (
        <circle
          cx={15.6 + index * 4.4}
          cy={6.5}
          fill={index < level ? "#fffaf0" : "none"}
          key={index}
          r={1.6}
          stroke="#fffaf0"
          strokeWidth={index < level ? 0 : 0.9}
        />
      ))}
    </svg>
  );
}
