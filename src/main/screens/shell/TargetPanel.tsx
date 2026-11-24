import type { JSX } from "react";
import type { Scenario } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { missionCallout } from "../../presentation/airPane";
import { territoryName } from "../../presentation/text";
import { cancelOrderStage, chooseAirMission, chooseRaidSite, clickMapTerritory } from "../../state/gameSlice";
import { type PlanningSession, stageTargets, targetTerritories } from "../../state/planning";
import { focusWhenShown } from "./focus";

/**
 * N6: while an aircraft's mission chooses its target, above the pane as for Move: what to choose
 * (with Cancel). The map does the choosing; the same targets fold out as buttons for the keyboard
 * and screen readers. A raid lists the sub-territories once its territory is chosen.
 */
export function TargetPanel({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element | null {
  const dispatch = useAppDispatch();
  const { selectedAircraftId: unitId, stage } = session.draft;
  if (stage?.step !== "choose-target" || unitId === undefined) return null;
  const targets = stageTargets(scenario, session);
  const sites = targets.filter((target) => target.territoryId === stage.territoryId);
  return (
    <section aria-label="Choosing a target" className="pane-section">
      <div className="pane-callout" role="status">
        <p>{missionCallout(scenario, session.game.state, unitId, stage.mission, stage.territoryId)}</p>
        <button className="text-button" onClick={() => dispatch(cancelOrderStage())} ref={focusWhenShown} type="button">Cancel mission</button>
      </div>
      {stage.territoryId === undefined ? (
        <details className="air-target-list">
          <summary>List the territories in range</summary>
          <ul aria-label="Targets" className="plain-list air-targets">
            {targetTerritories(scenario, session).map((id) => (
              <li key={id}><button className="text-button" onClick={() => dispatch(clickMapTerritory(id))} type="button">{territoryName(scenario, id)}</button></li>
            ))}
          </ul>
        </details>
      ) : (
        <ul aria-label="Targets" className="plain-list air-targets">
          {sites.flatMap(({ mission, name }) => (mission.kind === "raid" ? [(
            <li key={mission.subTerritoryId}><button className="text-button" onClick={() => dispatch(chooseRaidSite(mission.subTerritoryId))} type="button">{name}</button></li>
          )] : []))}
        </ul>
      )}
      {stage.territoryId === undefined ? null : (
        <button className="text-button" onClick={() => dispatch(chooseAirMission({ mission: stage.mission, unitId }))} type="button">All territories in range</button>
      )}
    </section>
  );
}
