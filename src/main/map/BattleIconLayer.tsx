import { type JSX, useId } from "react";
import type { Scenario, TerritoryId } from "../engine/types";
import { territoryName } from "../presentation/text";
import type { MapPoint } from "../scenarios/loader";
import type { ScreenRect } from "./placement";
import type { BattleMarkPoint } from "./RouteLayer";

interface BattleIconLayerProps {
  readonly marks: readonly BattleMarkPoint[];
  readonly onSelectTerritory: ((territoryId: TerritoryId) => void) | undefined;
  readonly scenario: Scenario;
  readonly toScreen: (point: MapPoint) => MapPoint;
}

/** The icon button's size in screen pixels (WCAG 2.5.8), as in `.battle-icon-button`. */
const iconSize = 24;

/** The battle icons' buttons on screen, for the counters to keep clear of so each stays clickable. */
export function battleIconRects(marks: readonly BattleMarkPoint[], toScreen: (point: MapPoint) => MapPoint): readonly ScreenRect[] {
  return marks.map((mark) => {
    const at = toScreen(mark.at);
    return { height: iconSize, width: iconSize, x: at.x - iconSize / 2, y: at.y - iconSize / 2 };
  });
}

/**
 * B5, D8 (`ux-battle-icon`): a button over each battle medallion. Hovering or focusing it names
 * the result in a tooltip that stays while the pointer is on it; a click selects the territory,
 * which opens and scrolls to its battle card in the turn report (F1). The rest of the route
 * layer stays click-through.
 */
export function BattleIconLayer({ marks, onSelectTerritory, scenario, toScreen }: BattleIconLayerProps): JSX.Element | null {
  const id = useId();
  if (marks.length === 0) return null;
  return (
    <div className="battle-icon-layer">
      {marks.map((mark, index) => {
        const tip = `${id}-${String(index)}`;
        const at = toScreen(mark.at);
        const place = territoryName(scenario, mark.territoryId);
        return (
          <div className="battle-icon" key={mark.key} style={{ left: at.x, top: at.y }}>
            <button
              aria-describedby={tip}
              aria-label={`Battle for ${place}: ${mark.title}`}
              className="battle-icon-button"
              data-territory-id={mark.territoryId}
              disabled={onSelectTerritory === undefined}
              onClick={(event) => {
                event.stopPropagation();
                onSelectTerritory?.(mark.territoryId);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") event.currentTarget.blur();
              }}
              type="button"
            />
            <div className="battle-tooltip" id={tip} role="tooltip">
              <strong className="battle-tooltip-title">{mark.title}</strong>
              <span className="battle-tooltip-note">{`Battle for ${place}, from the attacker's side.`}</span>
              <span className="battle-tooltip-hint">Click to open its battle card</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
