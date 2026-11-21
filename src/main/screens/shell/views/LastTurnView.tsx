import type { JSX } from "react";
import { glyphs } from "../../../presentation/glyphs";
import { seenBy } from "../../../state/history";
import { BattleReport } from "../../report/BattleReport";
import { OutcomeSummary } from "../../ResultPanels";
import type { PaneViewProps } from "./types";

/**
 * U10 (Q-R2-10): last turn's report while planning: what happened, by faction with the
 * player's own first, then the battles. The board is today's; the lines are what this player saw.
 */
export function LastTurnView({ scenario, session }: Pick<PaneViewProps, "scenario" | "session">): JSX.Element {
  const { factionId, game } = session;
  const entry = game.history.at(-1);
  if (entry === undefined) {
    return (
      <section className="pane-section">
        <p className="pane-hint">This is the first turn: there is no report yet.</p>
      </section>
    );
  }
  const result = { finalState: game.state, outcomes: seenBy(entry, factionId) };
  return (
    <>
      <p className="pane-meta last-turn-meta">{`Turn ${String(entry.turnNumber)} ${glyphs.dot} what happened, your faction first`}</p>
      <OutcomeSummary result={result} scenario={scenario} viewer={factionId} />
      <BattleReport focusedTerritoryId={undefined} result={result} scenario={scenario} seed={game.seed} />
    </>
  );
}
