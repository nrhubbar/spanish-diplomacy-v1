import { type JSX, useMemo } from "react";
import { GameHeader } from "../components/GameHeader";
import { useAppDispatch, useRegistry, useSessionIn } from "../hooks";
import type { MapView } from "../map/view";
import { glyphs } from "../presentation/glyphs";
import { listNames, factionName, turnLabel } from "../presentation/text";
import { openSetup, startNextTurn } from "../state/gameSlice";
import { selectRevealedOrders } from "../state/selectors";
import type { Session } from "../state/session";
import { MapScreenFrame } from "./MapScreenFrame";
import { OutcomeSummary, RevealedOrdersPanel, TerritoryChanges, VictoryProgressPanel } from "./ResultPanels";

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
  const view = useMemo<MapView>(() => ({
    changedTerritoryIds: result.controlChanges.map((change) => change.territoryId),
    destinationIds: [],
    orderedUnitIds: new Set(),
    outcomes: result.outcomes,
    plannedOrders: [],
    selectedUnitIds: new Set()
  }), [result]);
  const victory = result.victory;
  const winners = victory === undefined ? "" : listNames(victory.factionIds.map((id) => factionName(scenario, id)));
  const over = session.phase === "game-over";
  const title = over && victory !== undefined
    ? `${winners} ${victory.factionIds.length > 1 ? "share victory" : "wins"}`
    : "Turn resolution";

  return (
    <MapScreenFrame
      game={game.state}
      header={<GameHeader kicker={`${turnLabel(scenario, game.state.turnNumber)} ${glyphs.dot} ${over ? "Campaign concluded" : "Orders revealed"}`} title={title} />}
      label={title}
      pane={{
        body: (
          <>
            {over && victory !== undefined ? (
              <section className="pane-section victory-callout">
                <p>{`${winners} ${victory.factionIds.length > 1 ? "share the victory" : "won"} ${conditionText[victory.condition]}.`}</p>
              </section>
            ) : null}
            <TerritoryChanges result={result} scenario={scenario} />
            <OutcomeSummary result={result} scenario={scenario} />
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
