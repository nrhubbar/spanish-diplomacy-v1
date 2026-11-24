import type { JSX } from "react";
import { CloudIcon } from "../components/weather/WeatherIcon";
import type { UnitState } from "../engine/types";
import { type ArmyFigures, menLabel, strengthShare, valuesLabel } from "../presentation/army";
import { glyphs } from "../presentation/glyphs";
import { medallionMarkup } from "../presentation/outcomeArt";
import { cssVariables } from "../presentation/style";
import { unitDesignation } from "../presentation/text";
import type { CounterMetrics } from "./placement";
import type { MapPoint } from "../scenarios/loader";
import { WorksBadge } from "./WorksBadge";

export interface UnitCounterProps {
  /** Set on an aircraft's card: whether its base's weather keeps it on the ground. */
  readonly air?: { readonly grounded: boolean };
  readonly factionColor: string;
  readonly figures: ArmyFigures;
  /** Accessible name: the army, its faction, its figures in words, and its order state. */
  readonly label: string;
  readonly metrics: CounterMetrics;
  /** The scenario's short counter label, when it gives one. */
  readonly designation: string | undefined;
  /** The army's full name; the counter prints its short designation. */
  readonly name: string;
  readonly onSelect: ((unit: UnitState) => void) | undefined;
  readonly ordered: boolean;
  readonly position: MapPoint;
  readonly selected: boolean;
  /** Ticked in the Invade or Reinforce pane: it glows like a selected one, but is not pressed. */
  readonly ticked: boolean;
  readonly symbol: string;
  readonly unit: UnitState;
  /** The scenario's deepest works level, so the badge shows "2 of 3". */
  readonly worksMax: number;
}

/**
 * One army counter, printed like a board-wargame piece: the values that fight now in large type
 * (the full values small and struck through when they differ), a strength bar, and the men at
 * the detail zoom. Status badges sit on the corners: demoralized top left (H's medallion), works
 * bottom right, a planned order top right. Every badge is decorative; the accessible name says
 * it in words.
 */
export function UnitCounter({ air, designation, factionColor, figures, label, metrics, name, onSelect, ordered, position, selected, symbol, ticked, unit, worksMax }: UnitCounterProps): JSX.Element {
  const style = cssVariables(
    { "--faction-color": factionColor, "--strength-share": strengthShare(figures).toFixed(3) },
    { height: metrics.height, left: position.x, top: position.y, width: metrics.width }
  );
  return (
    <button
      aria-pressed={onSelect === undefined ? undefined : selected}
      className={air === undefined ? "unit-counter" : "unit-counter air-counter"}
      data-demoralized={figures.demoralized}
      data-grounded={air?.grounded}
      data-ordered={ordered}
      data-reduced={figures.reduced}
      data-selected={selected || ticked}
      data-unit-id={unit.id}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(unit);
      }}
      style={style}
      tabIndex={onSelect === undefined ? -1 : 0}
      title={name}
      type="button"
    >
      {/* The name comes from this text, not aria-label, so it never mismatches the printed figures. */}
      <span className="visually-hidden">{label}</span>
      <span aria-hidden="true" className="unit-counter-head">
        <span className="unit-counter-symbol" dangerouslySetInnerHTML={{ __html: symbol }} />
        <span className="unit-counter-designation">{designation ?? unitDesignation(name)}</span>
      </span>
      <span aria-hidden="true" className="unit-counter-values">
        <span className="unit-counter-current">{valuesLabel(figures.attack, figures.defence)}</span>
        {figures.reduced ? <s className="unit-counter-full">{valuesLabel(figures.fullAttack, figures.fullDefence)}</s> : null}
      </span>
      <span aria-hidden="true" className="unit-counter-men">{menLabel(figures)}</span>
      <span aria-hidden="true" className="unit-counter-bar" />
      {figures.demoralized ? (
        <span aria-hidden="true" className="unit-counter-demoralized" dangerouslySetInnerHTML={{ __html: medallionMarkup("demoralized", factionColor) }} />
      ) : null}
      {figures.dugIn === undefined ? null : <WorksBadge level={figures.dugIn} max={worksMax} />}
      {air?.grounded === true ? <span aria-hidden="true" className="unit-counter-grounded"><CloudIcon /></span> : null}
      {ordered ? <span aria-hidden="true" className="unit-counter-badge">{glyphs.check}</span> : null}
    </button>
  );
}
