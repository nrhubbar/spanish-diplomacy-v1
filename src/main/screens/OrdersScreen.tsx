import { type JSX, useMemo } from "react";
import { requireFaction } from "../engine/lookup";
import type { Scenario, UnitState } from "../engine/types";
import { GameHeader } from "../components/GameHeader";
import { useAppDispatch, useRegistry, useSessionIn } from "../hooks";
import type { MapView } from "../map/view";
import { glyphs } from "../presentation/glyphs";
import { destinationEstimates } from "../presentation/odds";
import { turnLabel } from "../presentation/turn";
import { cancelOrderStage, clickMapTerritory, clickMapUnit, endTurn } from "../state/gameSlice";
import { orderOf, type PlanningSession, selectedDestinations } from "../state/planning";
import { selectSubmissionStatus } from "../state/selectors";
import { MapScreenFrame } from "./MapScreenFrame";
import { OddsInfo } from "./OddsInfo";
import { focusWhenShown, OrderBuilder } from "./OrderBuilder";

export function OrdersScreen(): JSX.Element {
  const session = useSessionIn("planning");
  const registry = useRegistry();
  return <Orders scenario={registry.require(session.game.scenarioId).scenario} session={session} />;
}

function Orders({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const { draft, factionId, game } = session;
  const faction = requireFaction(scenario, factionId);
  const destinations = useMemo(() => selectedDestinations(scenario, session), [scenario, session]);
  const estimates = useMemo(
    () => destinationEstimates(scenario, game.state, factionId, draft.selectedUnitIds, destinations, draft.orders),
    [destinations, draft.orders, draft.selectedUnitIds, factionId, game.state, scenario]
  );
  const view = useMemo<MapView>(() => ({
    changedTerritoryIds: [],
    ...(estimates.size === 0 ? {} : { destinationEstimates: estimates }),
    destinationIds: destinations,
    onSelectTerritory: (territoryId) => dispatch(clickMapTerritory(territoryId)),
    onSelectUnit: (unit: UnitState) => dispatch(clickMapUnit(unit.id)),
    orderedUnitIds: new Set(draft.orders.map((order) => order.unitId)),
    outcomes: [],
    plannedAirMissions: (draft.airOrders ?? []).filter((order) => order.kind === "air-mission"),
    plannedOrders: draft.orders,
    ...(draft.selectedAircraftId === undefined ? {} : { selectedAircraftId: draft.selectedAircraftId }),
    selectedUnitIds: new Set(draft.selectedUnitIds),
    ...(draft.selectedTerritoryId === undefined ? {} : { selectedTerritoryId: draft.selectedTerritoryId }),
    unitOrders: new Map(Object.values(game.state.units)
      .filter((unit) => unit.factionId === factionId)
      .map((unit) => [unit.id, orderOf(session, unit)]))
  }), [destinations, dispatch, draft, estimates, factionId, game.state.units, session]);

  return (
    <MapScreenFrame
      briefingFor={factionId}
      game={game.state}
      header={(
        <GameHeader
          kicker={`${turnLabel(scenario, game.state.turnNumber)} ${glyphs.dot} Planning`}
          slots={{ scenario, state: game.state, viewer: factionId }}
          status={selectSubmissionStatus(scenario, session)}
          title={faction.name}
        />
      )}
      label={`${faction.name} orders`}
      pane={{
        attentionKey: [draft.selectedTerritoryId, draft.feedback, draft.orders.length].join("|"),
        ...(draft.stage?.step === "choose-destination"
          ? {
              sheetFocus: (
                <>
                  {/* A2: the phone's collapsed sheet hides the destination list, so its "i" rides in the bar. */}
                  {estimates.size === 0 ? <span>Choose a highlighted territory.</span> : (
                    <OddsInfo label="About the destination odds"><span>Choose a highlighted territory.</span></OddsInfo>
                  )}
                  <button className="text-button" onClick={() => dispatch(cancelOrderStage())} ref={focusWhenShown} type="button">Cancel</button>
                </>
              )
            }
          : {}),
        body: <OrderBuilder estimates={estimates} scenario={scenario} session={session} />,
        footer: <button className="primary-action" onClick={() => dispatch(endTurn())} type="button">End Turn</button>,
        title: "Orders"
      }}
      scenarioId={game.scenarioId}
      view={view}
    />
  );
}
