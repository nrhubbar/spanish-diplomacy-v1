import type { JSX } from "react";
import { allProjects, buildableId, buildRefusal, isCapital } from "../../../engine/economy/catalogue";
import type { BuildOrder, BuildProject, FactionId, GameState, Scenario, SubTerritoryDefinition, SubTerritoryId } from "../../../engine/types";
import { useAppDispatch } from "../../../hooks";
import { projectName, projectTerms } from "../../../presentation/economy";
import { EconomyIcon, projectIcon } from "../../../components/economy/EconomyIcon";
import { queueBuildOrder } from "../../../state/gameSlice";

interface BuildOptionsProps {
  readonly scenario: Scenario;
  /** The viewer's state with this turn's Build orders previewed as queued (`previewState`). */
  readonly state: GameState;
  readonly subTerritoryId: SubTerritoryId;
  readonly viewer: FactionId;
}

/**
 * X3, $4, $5: "Add to the queue" inside an open sub-territory card. Every project the scenario
 * offers here is listed with its price, time and effect; one that cannot be queued says why.
 * Queued items are paid when orders are revealed.
 */
export function BuildOptions({ scenario, state, subTerritoryId, viewer }: BuildOptionsProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const site = state.subTerritories[subTerritoryId];
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  if (site === undefined || sub === undefined || site.holder !== viewer) return null;
  // Projects that can be queued come first; locked ones follow, each saying why.
  const options = allProjects(scenario).filter((project) => possibleHere(scenario, sub, project)).map((project) => {
    const order: BuildOrder = { factionId: viewer, kind: "build", project, subTerritoryId };
    return { order, project, reason: buildRefusal(scenario, state, order) };
  });
  options.sort((a, b) => Number(a.reason !== undefined) - Number(b.reason !== undefined));
  return (
    <section aria-labelledby={`${subTerritoryId}-add`} className="build-options">
      <div className="build-tab-head">
        <h4 id={`${subTerritoryId}-add`}>Add to the queue</h4>
        <span className="pane-hint">Paid when queued</span>
      </div>
      <ul>
        {options.map(({ order, project, reason }) => {
          const name = projectName(scenario, site, project);
          return (
            <li className={reason === undefined ? "build-option" : "build-option build-option-locked"} key={name}>
              <div>
                <strong><EconomyIcon name={projectIcon(scenario, project)} />{name}</strong>
                <span className="build-terms">{projectTerms(scenario, project)}</span>
                {reason === undefined ? null : <span className="build-locked">{reason}</span>}
              </div>
              {reason === undefined ? (
                <button aria-label={`Queue ${name}`} className="secondary-button compact-button" onClick={() => dispatch(queueBuildOrder(order))} type="button">Queue</button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Projects this sub-territory can never take (a capital-only building elsewhere, a city-only one without a city) are left out. */
function possibleHere(scenario: Scenario, sub: SubTerritoryDefinition, project: BuildProject): boolean {
  const hasCity = sub.cityIds.length > 0;
  const id = buildableId(project);
  if (id === undefined || !sub.buildable.includes(id)) return false;
  switch (project.kind) {
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      return building !== undefined && (!building.capitalOnly || isCapital(scenario, sub)) && (!building.cityOnly || hasCity);
    }
    case "development":
      return hasCity || scenario.index.development.get(project.developmentId)?.cityOnly !== true;
    default:
      // Improvements: the list decides. Link works never get here (they have no `buildable` id).
      return true;
  }
}
