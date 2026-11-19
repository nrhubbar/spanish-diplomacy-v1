import { type JSX, useId } from "react";
import { MapControlsHelp } from "../components/MapControlsHelp";
import { requireFaction } from "../engine/lookup";
import type { FactionId, GameState, Scenario } from "../engine/types";
import { cssVariables } from "../presentation/style";
import { selectVictoryStanding, type VictoryMeasure } from "../state/selectors";
import { BattleBasics } from "./BattleBasics";

interface BriefingViewProps {
  readonly factionId: FactionId;
  readonly scenario: Scenario;
  readonly state: GameState;
}

/**
 * The Briefing pane body (B2): the faction's objective, live progress toward victory, the
 * turn-1 intelligence report, how battles work, and the map controls.
 */
export function BriefingView({ factionId, scenario, state }: BriefingViewProps): JSX.Element {
  const ids = useId();
  const faction = requireFaction(scenario, factionId);
  const standing = selectVictoryStanding(scenario, state, factionId);
  return (
    <>
      <section aria-labelledby={`${ids}-objective`} className="pane-section">
        <h3 id={`${ids}-objective`}>Objective</h3>
        <p className="briefing-text">{faction.briefing.objective}</p>
      </section>
      <section aria-labelledby={`${ids}-progress`} className="pane-section">
        <h3 id={`${ids}-progress`}>Victory progress</h3>
        <div className="briefing-progress" style={cssVariables({ "--faction-color": faction.color })}>
          <StandingMeter label="Territories" measure={standing.territories} />
          <StandingMeter label="Cities" measure={standing.cities} />
        </div>
        <p className="pane-hint">Reaching either target wins the campaign.</p>
      </section>
      {state.turnNumber === 1 ? (
        <section aria-labelledby={`${ids}-report`} className="pane-section">
          <h3 id={`${ids}-report`}>Intelligence report</h3>
          <blockquote className="briefing-report">
            <p>{faction.briefing.firstTurnHint}</p>
          </blockquote>
        </section>
      ) : null}
      <BattleBasics scenario={scenario} />
      <section aria-labelledby={`${ids}-controls`} className="pane-section">
        <h3 id={`${ids}-controls`}>Map controls</h3>
        <MapControlsHelp />
      </section>
    </>
  );
}

function StandingMeter({ label, measure }: { readonly label: string; readonly measure: VictoryMeasure }): JSX.Element {
  const { held, needed, total } = measure;
  const summary = `${String(held)} held, ${String(needed)} of ${String(total)} needed`;
  return (
    <div className="meter">
      <span className="meter-label"><strong>{label}</strong>{`: ${summary}`}</span>
      <meter aria-label={`${label}: ${summary}`} max={needed} min={0} value={Math.min(held, needed)} />
    </div>
  );
}
