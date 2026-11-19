import type { JSX } from "react";

/** Pip positions for each face, on a 0..10 grid. */
const pips: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[5, 5]],
  2: [[2.6, 2.6], [7.4, 7.4]],
  3: [[2.6, 2.6], [5, 5], [7.4, 7.4]],
  4: [[2.6, 2.6], [7.4, 2.6], [2.6, 7.4], [7.4, 7.4]],
  5: [[2.6, 2.6], [7.4, 2.6], [5, 5], [2.6, 7.4], [7.4, 7.4]],
  6: [[2.6, 2.4], [7.4, 2.4], [2.6, 5], [7.4, 5], [2.6, 7.6], [7.4, 7.6]]
};

/** A drawn die face; decorative, so the number beside it carries the value. */
export function DieFace({ value }: { readonly value: number }): JSX.Element {
  return (
    <svg aria-hidden="true" className="die-face" focusable="false" viewBox="0 0 10 10">
      <rect height={9.2} rx={2} width={9.2} x={0.4} y={0.4} />
      {(pips[value] ?? []).map(([cx, cy]) => <circle cx={cx} cy={cy} key={`${String(cx)}-${String(cy)}`} r={0.95} />)}
    </svg>
  );
}
