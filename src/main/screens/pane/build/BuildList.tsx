import type { JSX } from "react";
import { allProjects, buildRefusal, isCapital } from "../../../engine/economy/catalogue";
import type { BuildOrder, BuildProject, Scenario, SubTerritoryDefinition, SubTerritoryId } from "../../../engine/types";
import { useAppDispatch, useSessionIn } from "../../../hooks";
import { projectName, projectTerms } from "../../../presentation/economy";
import { EconomyIcon, projectIcon } from "../../../components/economy/EconomyIcon";
import { queueBuildOrder } from "../../../state/gameSlice";
import { plannedBuilds, previewState } from "../../../state/planning";
import { plannedAt } from "./planned";
import { SiteCard } from "./SiteCard";

/**
 * X3, $4, $5: the focused sub-territory's card and its build list. Every project the scenario
 * offers is listed with its price, time and effect; one that cannot be queued says why. Queued
 * items are paid when orders are revealed.
 */
export function BuildList({ scenario, subTerritoryId }: { readonly scenario: Scenario; readonly subTerritoryId: SubTerritoryId }): JSX.Element | null {
  const dispatch = useAppDispatch();
  const session = useSessionIn("planning");
  if (scenario.rules.economy === "none") return null;
  const state = previewState(scenario, session);
  const site = state.subTerritories[subTerritoryId];
  if (site === undefined) return null;
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  if (sub === undefined) return null;
  const own = site.holder === session.factionId;
  // Projects that can be queued come first; locked ones follow, each saying why.
  const options = allProjects(scenario).filter((project) => possibleHere(scenario, sub, project)).map((project) => {
    const order: BuildOrder = { factionId: session.factionId, kind: "build", project, subTerritoryId };
    return { order, project, reason: buildRefusal(scenario, state, order) };
  });
  options.sort((a, b) => Number(a.reason !== undefined) - Number(b.reason !== undefined));
  return (
    <div className="build-list">
      <SiteCard planned={plannedAt(plannedBuilds(session), subTerritoryId)} scenario={scenario} state={state} subTerritoryId={subTerritoryId} viewer={session.factionId} withBuildButton={false} />
      {own ? (
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
      ) : null}
    </div>
  );
}

/** Projects this sub-territory can never take (a capital-only building elsewhere, a city-only one without a city) are left out. */
function possibleHere(scenario: Scenario, sub: SubTerritoryDefinition, project: BuildProject): boolean {
  const hasCity = sub.cityIds.length > 0;
  switch (project.kind) {
    case "building": {
      const building = scenario.index.buildings.get(project.buildingId);
      return building !== undefined && (!building.capitalOnly || isCapital(scenario, sub)) && (!building.cityOnly || hasCity);
    }
    case "development":
      return hasCity || scenario.index.development.get(project.developmentId)?.cityOnly !== true;
    case "improvement":
      return true;
  }
}
