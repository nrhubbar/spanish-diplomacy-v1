import type { JSX } from "react";
import { requireFaction } from "../../engine/lookup";
import { isPartitioned, subTerritoriesOf } from "../../engine/partition/holders";
import type { GameState, Scenario, TerritoryId } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { factionName } from "../../presentation/text";
import { focusSubTerritory } from "../../state/gameSlice";

/**
 * X3: the territory's sub-territories, each a button that focuses the pane on it, the same as
 * clicking it on the zoomed-in map, so the focus view is reachable by keyboard and on a phone.
 * Each names its holder with a colour swatch; the capital carries its star (W3).
 */
export function SubTerritoryList({ scenario, state, territoryId }: { readonly scenario: Scenario; readonly state: GameState; readonly territoryId: TerritoryId }): JSX.Element | null {
  const dispatch = useAppDispatch();
  const subs = subTerritoriesOf(scenario, territoryId);
  if (!isPartitioned(scenario) || subs.length === 0) return null;
  const capital = scenario.index.territories.get(territoryId)?.capitalSubTerritoryId;
  return (
    <div className="sub-territory-list">
      <h4>Sub-territories</h4>
      <ul className="plain-list">
        {subs.map((sub) => {
          const holder = state.subTerritories[sub.id]?.holder ?? sub.startHolder;
          return (
            <li key={sub.id}>
              <button
                aria-label={`${sub.name}, held by ${factionName(scenario, holder)}. Show details`}
                className="sub-territory-link"
                onClick={() => dispatch(focusSubTerritory(sub.id))}
                type="button"
              >
                <span aria-hidden="true" className="holder-swatch" style={{ background: requireFaction(scenario, holder).color }} />
                {sub.id === capital ? <span aria-hidden="true" className="capital-star">{glyphs.star}</span> : null}
                <span>{sub.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
