import type { JSX } from "react";
import { requireFaction } from "../../../engine/lookup";
import type { Scenario, SubTerritoryId, TerritoryId } from "../../../engine/types";
import { armyFigures } from "../../../presentation/army";
import { factionName, unitName } from "../../../presentation/text";
import type { TerritoryTab } from "../../../state/paneSlice";
import { isAircraft, type PlanningSession } from "../../../state/planning";
import { ArmyLine } from "../../ArmyLine";
import { ArmyPicker } from "../../ArmyPicker";
import { AircraftHere, AirPane } from "../../pane/AirPane";
import { SubTerritoryList } from "../../pane/SubTerritoryList";
import { TerritoryTabs } from "../../pane/TerritoryTabs";

interface TerritoryViewProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  /** The sub-territory whose card opens in Buildings (a Build view). */
  readonly subTerritory?: SubTerritoryId | undefined;
  /** The tab to open on (U9); Units when unset. */
  readonly tab?: TerritoryTab | undefined;
  readonly territoryId: TerritoryId;
}

/**
 * U3, U9: Territory Info, opened by clicking a territory: its tabs (Units, Buildings, Recruit,
 * Production), or a selected aircraft's missions. A sub-territory focused on the map opens
 * Buildings with its card open. Orders for the selection are given from the pane's selection
 * bar (U4).
 */
export function TerritoryView({ scenario, session, subTerritory, tab, territoryId }: TerritoryViewProps): JSX.Element {
  const { draft } = session;
  const focused = draft.focusedSubTerritoryId;
  const focusedHere = focused !== undefined && scenario.index.subTerritories.get(focused)?.territoryId === territoryId ? focused : undefined;
  return (
    <section aria-label="Selected territory" className="pane-section">
      {draft.selectedAircraftId === undefined ? (
        <TerritoryTabs
          focusedSite={focusedHere}
          initialSite={subTerritory}
          key={`${territoryId}:${tab ?? ""}:${subTerritory ?? ""}`}
          scenario={scenario}
          session={session}
          tab={tab}
          territoryId={territoryId}
        >
          <TerritoryUnits scenario={scenario} session={session} territoryId={territoryId} />
        </TerritoryTabs>
      ) : <AirPane key={draft.selectedAircraftId} scenario={scenario} session={session} unitId={draft.selectedAircraftId} />}
    </section>
  );
}

/** The Units tab: the player's armies here, then everyone else's. The heading sits above the tabs (`TerritoryHeading`). */
function TerritoryUnits({ scenario, session, territoryId }: Pick<TerritoryViewProps, "scenario" | "session" | "territoryId">): JSX.Element {
  const { factionId, game } = session;
  const unitsHere = Object.values(game.state.units).filter((unit) => unit.territoryId === territoryId);
  // U2: the player's aircraft are listed apart and open their own missions (m3r1-air-generals).
  const aircraft = unitsHere.filter((unit) => unit.factionId === factionId && isAircraft(scenario, game.state, unit.id));
  const own = unitsHere.filter((unit) => unit.factionId === factionId && !aircraft.includes(unit));
  const others = unitsHere.filter((unit) => unit.factionId !== factionId);

  return (
    <>
      {own.length === 0 ? null : <ArmyPicker own={own} scenario={scenario} session={session} />}
      <AircraftHere aircraft={aircraft} scenario={scenario} session={session} />
      {others.length === 0 ? null : (
        <div className="other-formations">
          <h4>Other units here</h4>
          <ul className="plain-list other-army-list">
            {others.map((unit) => (
              <li key={unit.id}>
                <span className="formation-name">{unitName(scenario, unit.id)}</span>
                <span className="formation-meta">{factionName(scenario, unit.factionId)}</span>
                <ArmyLine factionColor={requireFaction(scenario, unit.factionId).color} figures={armyFigures(scenario, game.state, unit)} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <SubTerritoryList scenario={scenario} state={game.state} territoryId={territoryId} />
    </>
  );
}
