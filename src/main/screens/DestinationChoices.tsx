import { type JSX, useId } from "react";
import type { Scenario, TerritoryId } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { glyphs } from "../presentation/glyphs";
import { type DestinationEstimate, modifierPhrase, oddsSummary } from "../presentation/odds";
import { territoryName } from "../presentation/text";
import { clickMapTerritory } from "../state/gameSlice";

interface DestinationChoicesProps {
  readonly estimates: ReadonlyMap<TerritoryId, DestinationEstimate>;
  readonly scenario: Scenario;
}

/**
 * C15: every legal destination with what the move would meet, before the order is committed.
 * Choosing one here is the same as choosing it on the map; this list is also the keyboard and
 * screen-reader copy of the odds the map shows.
 */
export function DestinationChoices({ estimates, scenario }: DestinationChoicesProps): JSX.Element {
  const dispatch = useAppDispatch();
  const headingId = useId();
  return (
    <div className="destination-choices">
      <h4 id={headingId}>Destinations</h4>
      <ul aria-labelledby={headingId} className="destination-list">
        {[...estimates].map(([territoryId, estimate]) => {
          const summary = oddsSummary(estimate);
          const detail = estimateDetail(estimate);
          return (
            <li key={territoryId}>
              <button className="destination-button" data-tone={summary.tone} onClick={() => dispatch(clickMapTerritory(territoryId))} type="button">
                <span className="destination-name">{territoryName(scenario, territoryId)}</span>
                <span className="odds-chip" data-tone={summary.tone}>
                  <span aria-hidden="true">{summary.chip}</span>
                  <span className="visually-hidden">{summary.sentence}</span>
                </span>
                {detail === undefined ? null : <span className="destination-detail">{detail}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The sides and every named modifier: "Attack 8 against defence 6 - Dug in +2". */
function estimateDetail(estimate: DestinationEstimate): string | undefined {
  if (estimate.kind !== "battle") return undefined;
  const sides = `Attack ${String(estimate.attack)} against defence ${String(estimate.defence)}`;
  return [sides, ...estimate.modifiers.map(modifierPhrase)].join(` ${glyphs.dot} `);
}
