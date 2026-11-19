import type { JSX } from "react";
import { type GroupFigures, strengthShare, valuesLabel } from "../presentation/army";
import { glyphs } from "../presentation/glyphs";
import { medallionMarkup } from "../presentation/outcomeArt";
import { cssVariables } from "../presentation/style";
import type { MapPoint } from "../scenarios/loader";
import type { CounterMetrics } from "./placement";
import { WorksBadge } from "./WorksBadge";

interface GroupCounterProps {
  readonly factionColor: string;
  readonly figures: GroupFigures;
  /** Accessible name, from `groupLabel`. */
  readonly label: string;
  readonly metrics: CounterMetrics;
  /** Selects the territory, which opens the group into its armies. */
  readonly onSelect: (() => void) | undefined;
  /** Every army in the group has a planned order. */
  readonly ordered: boolean;
  readonly position: MapPoint;
  readonly worksMax: number;
}

/**
 * Several armies of one faction in one territory, printed as one counter: their combined values
 * over a combined strength bar, with an "xN" tab. Used at the overview zoom when the map is too
 * crowded for every army; selecting the territory shows each army again.
 */
export function GroupCounter({ factionColor, figures, label, metrics, onSelect, ordered, position, worksMax }: GroupCounterProps): JSX.Element {
  const style = cssVariables(
    { "--faction-color": factionColor, "--strength-share": strengthShare(figures).toFixed(3) },
    { height: metrics.height, left: position.x, top: position.y, width: metrics.width }
  );
  const values = valuesLabel(figures.attack, figures.defence);
  return (
    <button
      className="unit-counter unit-counter-group"
      data-count={figures.count}
      data-demoralized={figures.demoralized}
      // Two-digit totals ("18-23") set a little tighter so they fit the fixed counter width.
      data-long={values.length > 4}
      data-ordered={ordered}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      style={style}
      tabIndex={onSelect === undefined ? -1 : 0}
      type="button"
    >
      <span className="visually-hidden">{label}</span>
      <span aria-hidden="true" className="unit-counter-values">
        <span className="unit-counter-current">{values}</span>
      </span>
      <span aria-hidden="true" className="unit-counter-bar" />
      <span aria-hidden="true" className="unit-counter-count">{`${glyphs.times}${String(figures.count)}`}</span>
      {figures.demoralized ? (
        <span aria-hidden="true" className="unit-counter-demoralized" dangerouslySetInnerHTML={{ __html: medallionMarkup("demoralized", factionColor) }} />
      ) : null}
      {figures.dugIn === undefined ? null : <WorksBadge level={figures.dugIn} max={worksMax} />}
    </button>
  );
}
