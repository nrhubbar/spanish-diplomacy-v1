import { type JSX, useId } from "react";
import { raisedDefinition } from "../../engine/recruitment/rules";
import type { TrainingItem } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { menShort, trainingStatus, turnsLabel } from "../../presentation/recruitment";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * X7 (Q-UX-13): the player's units in training in this territory, drawn dashed under the Units
 * tab: those already training (with their time left, or paused in contested ground, C8) and
 * those in this turn's Recruit basket.
 */
export function TrainingList({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element | null {
  const headingId = useId();
  const training = session.game.state.training.filter((item: TrainingItem) => item.factionId === session.factionId && item.territoryId === territoryId);
  const basket = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId);
  if (training.length === 0 && basket.length === 0) return null;
  return (
    <div className="training-list">
      <h4 id={headingId}>In training</h4>
      <ul aria-labelledby={headingId} className="plain-list">
        {training.map((item) => {
          const definition = raisedDefinition(scenario, item.unitId);
          return (
            <li className="training-unit" data-paused={item.paused} key={item.unitId}>
              <span className="formation-name">{definition?.name ?? item.unitId}</span>
              <span className="formation-meta">{`${menShort(definition?.fullStrength ?? 0)} ${glyphs.dot} ${trainingStatus(item)}`}</span>
            </li>
          );
        })}
        {basket.map((order, index) => {
          const type = scenario.index.unitTypes.get(order.unitTypeId);
          const turns = type?.recruit?.trainingTurns ?? 0;
          return (
            // The basket has no ids yet: the index within the territory is its key.
            <li className="training-unit" data-ordered="true" key={`${order.unitTypeId}-${String(index)}`}>
              <span className="formation-name">{type?.name ?? order.unitTypeId}</span>
              <span className="formation-meta">{`Recruit order ${glyphs.dot} ${turns <= 1 ? "ready at the end of this turn" : `ready in ${turnsLabel(turns)}`}`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
