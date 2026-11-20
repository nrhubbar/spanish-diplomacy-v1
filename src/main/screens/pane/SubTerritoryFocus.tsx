import type { JSX } from "react";
import { requireTerritory } from "../../engine/lookup";
import type { Scenario, SubTerritoryId } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { focusSubTerritory } from "../../state/gameSlice";

/**
 * X3: the pane focused on one sub-territory, with a link back to its territory.
 * TODO(m3r1-sub-territories, m3r1-economy-builds): the sub-territory card (holder, terrain,
 * development pips, buildings, queue with progress bars, X7) and its build list.
 */
export function SubTerritoryFocus({ scenario, subTerritoryId }: { readonly scenario: Scenario; readonly subTerritoryId: SubTerritoryId }): JSX.Element | null {
  const dispatch = useAppDispatch();
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  if (sub === undefined) return null;
  const territory = requireTerritory(scenario, sub.territoryId);
  return (
    <div className="sub-territory-focus">
      <button className="text-button" onClick={() => dispatch(focusSubTerritory(undefined))} type="button">{`Back to ${territory.name}`}</button>
      <h3>{sub.name}</h3>
    </div>
  );
}
