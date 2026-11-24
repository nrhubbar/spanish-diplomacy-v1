import { type JSX, useMemo } from "react";
import { requireFaction } from "../engine/lookup";
import { isMoveOrder, type Scenario } from "../engine/types";
import { GameHeader } from "../components/GameHeader";
import { EndTurnButton } from "../components/header/EndTurnButton";
import { TurnNav } from "../components/header/TurnNav";
import { useAppDispatch, useAppSelector, useRegistry, useSessionIn } from "../hooks";
import type { MapView } from "../map/view";
import { glyphs } from "../presentation/glyphs";
import { destinationEstimates } from "../presentation/odds";
import { queueCounts } from "../presentation/thisTurn";
import { turnLabel } from "../presentation/turn";
import { cancelOrderStage } from "../state/gameSlice";
import { opensTall, popView, topView, viewKey } from "../state/paneSlice";
import { oddsDestinations, type PlanningSession, planningMapView, selectedDestinations, tickedOnMap } from "../state/planning";
import { selectSubmissionStatus } from "../state/selectors";
import { useMapActions } from "./actions/useMapActions";
import { MapScreenFrame } from "./MapScreenFrame";
import { OddsInfo } from "./OddsInfo";
import { DestinationPanel } from "./shell/DestinationPanel";
import { planningMapHandlers } from "./shell/mapHandlers";
import { focusWhenShown } from "./shell/focus";
import { paneViewTitle } from "./shell/paneTitles";
import { PaneViewBody } from "./shell/PaneViewBody";
import { hasSelectionBar, SelectionBar } from "./shell/SelectionBar";

export function OrdersScreen(): JSX.Element {
  const session = useSessionIn("planning");
  const registry = useRegistry();
  return <Orders scenario={registry.require(session.game.scenarioId).scenario} session={session} />;
}

function Orders({ scenario, session }: { readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const { draft, factionId, game } = session;
  const faction = requireFaction(scenario, factionId);
  const stack = useAppSelector((state) => state.pane.stack);
  const shown = topView(stack);
  const choices = useAppSelector((state) => state.pane.muster);
  const ticked = useMemo(() => tickedOnMap(scenario, session, shown, choices), [choices, scenario, session, shown]);
  const previous = stack.at(-2);
  const destinations = useMemo(() => selectedDestinations(scenario, session), [scenario, session]);
  const estimates = useMemo(
    () => destinationEstimates(scenario, game.state, factionId, draft.selectedUnitIds, oddsDestinations(draft, destinations), draft.orders.filter(isMoveOrder), draft.airOrders),
    [destinations, draft, factionId, game.state, scenario]
  );
  const choosing = draft.stage?.step === "choose-destination";
  const actions = useMapActions(scenario, session, dispatch);
  const { handlers: actionHandlers, onTap } = actions;
  const view = useMemo<MapView>(() => {
    const clicks = planningMapHandlers(dispatch, scenario, draft);
    // U7: a tap on a territory the units can't reach explains why, on a phone.
    const onSelectTerritory: MapView["onSelectTerritory"] = (territoryId, input) => { onTap(territoryId, input); clicks.onSelectTerritory(territoryId); };
    return { ...planningMapView(scenario, session, destinations, estimates, ticked), ...clicks, onSelectTerritory, ...actionHandlers };
  }, [actionHandlers, destinations, dispatch, draft, estimates, onTap, scenario, session, ticked]);
  const counts = queueCounts(scenario, game.state, factionId, draft);
  const endTurnButton = <EndTurnButton scenario={scenario} session={session} />;

  return (
    <>
    <MapScreenFrame
      briefingFor={factionId}
      game={game.state}
      header={(
        <GameHeader
          actions={(
            <>
              <TurnNav active={shown.kind} building={counts.building} recruiting={counts.recruiting} />
              {endTurnButton}
            </>
          )}
          kicker={`${turnLabel(scenario, game.state.turnNumber)} ${glyphs.dot} Planning`}
          slots={{ scenario, state: game.state, viewer: factionId }}
          status={selectSubmissionStatus(scenario, session)}
          title={faction.name}
        />
      )}
      label={`${faction.name} orders`}
      pane={{
        attentionKey: [draft.selectedTerritoryId, draft.feedback, draft.orders.length, viewKey(shown)].join("|"),
        ...(previous === undefined ? {} : { back: { label: paneViewTitle(scenario, previous), onBack: () => dispatch(popView()) } }),
        barAction: endTurnButton,
        ...(choosing
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
        body: (
          <>
            <DestinationPanel estimates={estimates} scenario={scenario} session={session} />
            <PaneViewBody scenario={scenario} session={session} view={shown} />
          </>
        ),
        ...(hasSelectionBar(draft) ? { footer: <SelectionBar scenario={scenario} session={session} /> } : {}),
        ...(opensTall(shown) ? { tall: true } : {}),
        title: paneViewTitle(scenario, shown)
      }}
      scenarioId={game.scenarioId}
      view={view}
    />
    {actions.overlay}
    </>
  );
}
