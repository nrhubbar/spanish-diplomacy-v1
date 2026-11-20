import type { JSX } from "react";
import type { Scenario, SubTerritoryChangeCause, TurnResolutionResult } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { factionName, territoryName } from "../../presentation/text";

const causes: Readonly<Record<SubTerritoryChangeCause, string>> = {
  battle: "ground taken in battle",
  occupation: "occupied unopposed",
  sweep: "taken by the units there"
};

/**
 * P2-P4: the sub-territories that changed hands this turn (`subTerritoryChanges`), under the
 * territory changes. Closed, with its count, so a long turn-1 list does not push the battles
 * below the fold (m18).
 */
export function SubTerritoryChanges({ result, scenario }: { readonly result: TurnResolutionResult; readonly scenario: Scenario }): JSX.Element | null {
  if (result.subTerritoryChanges.length === 0) return null;
  return (
    <details className="sub-territory-changes">
      <summary>{`Sub-territories changed (${String(result.subTerritoryChanges.length)})`}</summary>
      <ul className="change-list">
        {result.subTerritoryChanges.map((change) => {
          const sub = scenario.index.subTerritories.get(change.subTerritoryId);
          return (
            <li key={change.subTerritoryId}>
              <strong>{sub === undefined ? change.subTerritoryId : `${sub.name} (${territoryName(scenario, sub.territoryId)})`}</strong>
              <span>{`${factionName(scenario, change.before)} ${glyphs.arrow} ${factionName(scenario, change.after)} ${glyphs.dot} ${causes[change.cause]}`}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
