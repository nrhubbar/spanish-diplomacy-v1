import type { JSX } from "react";
import type { Scenario, SubTerritoryChangeCause, TurnResolutionResult } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { factionName, territoryName } from "../../presentation/text";

const causes: Readonly<Record<SubTerritoryChangeCause, string>> = {
  battle: "ground taken in battle",
  occupation: "occupied unopposed",
  sweep: "taken by the armies there"
};

/** P2-P4: the sub-territories that changed hands this turn (`subTerritoryChanges`), under the territory changes. */
export function SubTerritoryChanges({ result, scenario }: { readonly result: TurnResolutionResult; readonly scenario: Scenario }): JSX.Element | null {
  if (result.subTerritoryChanges.length === 0) return null;
  return (
    <div className="sub-territory-changes">
      <h4>Sub-territories changed</h4>
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
    </div>
  );
}
