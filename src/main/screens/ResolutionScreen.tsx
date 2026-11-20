import { type JSX, useCallback, useMemo, useState } from "react";
import type { Scenario, TerritoryId, UnitState } from "../engine/types";
import { GameHeader } from "../components/GameHeader";
import type { HeaderSlotProps } from "../components/header/slots";
import { useAppDispatch, useRegistry, useSessionIn } from "../hooks";
import type { MapView } from "../map/view";
import { glyphs } from "../presentation/glyphs";
import { listNames, factionName } from "../presentation/text";
import { turnLabel } from "../presentation/turn";
import { openSetup, startNextTurn } from "../state/gameSlice";
import { selectRevealedOrders } from "../state/selectors";
import type { Session } from "../state/session";
import { sessionViewer } from "../state/visible";
import { MapScreenFrame } from "./MapScreenFrame";
import { BattleReport } from "./report/BattleReport";
import { FocusNote, OutcomeSummary, RevealedOrdersPanel, TerritoryChanges, VictoryProgressPanel } from "./ResultPanels";
import { battleKeysAt } from "./report/focus";
import { TurnConditions } from "./report/TurnConditions";
import { groupBattles } from "../presentation/battle";

type ResultSession = Extract<Session, { readonly phase: "resolution" | "game-over" }>;

/** Shared by the resolution and game-over routes. */
export function ResultsScreen(): JSX.Element {
  return <Results session={useSessionIn("resolution", "game-over")} />;
}

const conditionText = {
  cities: "by holding the decisive cities",
  shared: "with equal claims after simultaneous resolution",
  territories: "by controlling the most territory"
} as const;

function Results({ session }: { readonly session: ResultSession }): JSX.Element {
  const dispatch = useAppDispatch();
  const { scenario } = useRegistry().require(session.game.scenarioId);
  const { game, result } = session;
  // F1: local UI state, never game state. Clicking the focused place again, or empty map, clears it.
  const [focused, setFocused] = useState<TerritoryId | undefined>(undefined);
  const focus = useCallback((territoryId: TerritoryId) => {
    setFocused((current) => (current === territoryId ? undefined : territoryId));
  }, []);
  const clearFocus = useCallback(() => { setFocused(undefined); }, []);
  const view = useMemo<MapView>(() => ({
    changedTerritoryIds: result.controlChanges.map((change) => change.territoryId),
    destinationIds: [],
    ...(focused === undefined ? {} : { focusedTerritoryId: focused }),
    onSelectNothing: clearFocus,
    onSelectTerritory: focus,
    onSelectUnit: (unit: UnitState) => { focus(unit.territoryId); },
    orderedUnitIds: new Set(),
    outcomes: result.outcomes,
    plannedOrders: [],
    // The focused place's armies read as pressed, so pressing one again says it clears the focus.
    selectedUnitIds: new Set(Object.values(game.state.units).filter((unit) => unit.territoryId === focused).map((unit) => unit.id))
  }), [clearFocus, focus, focused, game.state, result]);
  const focusedBattle = useMemo(
    () => focused !== undefined && battleKeysAt(groupBattles(result.outcomes), focused).length > 0,
    [focused, result.outcomes]
  );
  const victory = result.victory;
  const winners = victory === undefined ? "" : listNames(victory.factionIds.map((id) => factionName(scenario, id)));
  const over = session.phase === "game-over";
  const title = over && victory !== undefined
    ? `${winners} ${victory.factionIds.length > 1 ? "share victory" : "wins"}`
    : "Turn resolution";

  return (
    <MapScreenFrame
      game={game.state}
      header={<GameHeader kicker={`${turnLabel(scenario, game.state.turnNumber)} ${glyphs.dot} ${over ? "Campaign concluded" : "Orders revealed"}`} slots={headerSlots(scenario, session)} title={title} />}
      label={title}
      pane={{
        // A focused place opens a collapsed pane, so the player sees its card or note.
        ...(focused === undefined ? {} : { attentionKey: focused }),
        body: (
          <>
            <FocusNote battle={focusedBattle} focusedTerritoryId={focused} result={result} scenario={scenario} viewer={sessionViewer(session)} />
            {over && victory !== undefined ? (
              <section className="pane-section victory-callout">
                <p>{`${winners} ${victory.factionIds.length > 1 ? "share the victory" : "won"} ${conditionText[victory.condition]}.`}</p>
              </section>
            ) : null}
            <TerritoryChanges result={result} scenario={scenario} />
            <BattleReport focusedTerritoryId={focused} result={result} scenario={scenario} seed={game.seed} />
            <TurnConditions result={result} scenario={scenario} />
            <OutcomeSummary result={result} scenario={scenario} viewer={sessionViewer(session)} />
            <VictoryProgressPanel result={result} scenario={scenario} />
            <RevealedOrdersPanel revealed={selectRevealedOrders(session)} scenario={scenario} />
          </>
        ),
        footer: over
          ? <button className="primary-action" onClick={() => dispatch(openSetup())} type="button">Set Up Another Campaign</button>
          : <button className="primary-action" onClick={() => dispatch(startNextTurn())} type="button">Start Next Turn</button>,
        title: over ? "Result" : "Turn report"
      }}
      scenarioId={game.scenarioId}
      view={view}
    />
  );
}

/** The header slots of a report: the visible final state, seen by the report's viewer. */
function headerSlots(scenario: Scenario, session: ResultSession): HeaderSlotProps {
  const viewer = sessionViewer(session);
  return { scenario, state: session.result.finalState, ...(viewer === undefined ? {} : { viewer }) };
}
