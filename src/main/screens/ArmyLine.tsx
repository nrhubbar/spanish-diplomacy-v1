import type { JSX } from "react";
import { type ArmyFigures, fatigueLabel, figuresDugInLabel, figuresDescription, menLabel, strengthShare, valuesLabel } from "../presentation/army";
import { medallionMarkup } from "../assets/outcomes/outcomeArt";
import { cssVariables } from "../components/style";

/**
 * An army's figures in the Orders pane, matching its counter: values (full values struck through
 * when they differ), a strength bar with the men, and status chips. The visual parts are hidden
 * from assistive technology, which reads one plain sentence instead.
 */
export function ArmyLine({ factionColor, figures }: { readonly factionColor: string; readonly figures: ArmyFigures }): JSX.Element {
  return (
    <span className="army-line">
      <span className="visually-hidden">{figuresDescription(figures)}</span>
      <span aria-hidden="true" className="army-line-values">
        <strong>{valuesLabel(figures.attack, figures.defence)}</strong>
        {figures.reduced ? <s>{valuesLabel(figures.fullAttack, figures.fullDefence)}</s> : null}
      </span>
      <span aria-hidden="true" className="army-line-strength" style={cssVariables({ "--strength-share": strengthShare(figures).toFixed(3) })}>
        <span className="army-line-bar" />
        {`${menLabel(figures)} men`}
      </span>
      {!figures.demoralized && figures.fatigue === 0 && figures.dugIn === undefined ? null : (
        <span aria-hidden="true" className="army-line-status">
          {figures.demoralized ? <StatusChip icon={medallionMarkup("demoralized", factionColor)} label="Demoralized" tone="demoralized" /> : null}
          {figures.fatigue > 0 ? <StatusChip icon={fatigueIcon(figures.fatigue)} label={fatigueLabel(figures.fatigue)} tone="fatigue" /> : null}
          {figures.dugIn === undefined ? null : (
            <StatusChip icon={medallionMarkup("dug-in", factionColor, figures.dugIn)} label={figuresDugInLabel(figures)} tone="dug-in" />
          )}
        </span>
      )}
    </span>
  );
}

function StatusChip({ icon, label, tone }: { readonly icon: string; readonly label: string; readonly tone: string }): JSX.Element {
  return (
    <span className="status-chip" data-tone={tone}>
      <span className="status-chip-icon" dangerouslySetInnerHTML={{ __html: icon }} />
      {label}
    </span>
  );
}

/** C6, X8: the fatigue track as three pips, filled up to the unit's level. Decorative. */
function fatigueIcon(level: number): string {
  const pips = [0, 1, 2].map((index) => `<rect x="${String(1 + index * 4.4)}" y="${String(9 - index * 3)}" width="3.4" height="${String(4 + index * 3)}" rx="0.8" fill="${index < level ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1"/>`).join("");
  return `<svg viewBox="0 0 15 15" aria-hidden="true" focusable="false">${pips}</svg>`;
}
