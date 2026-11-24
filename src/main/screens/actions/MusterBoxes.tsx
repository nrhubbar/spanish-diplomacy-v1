import { type JSX, type ReactNode, useMemo } from "react";
import { RollLedger } from "../../components/RollLedger";
import type { Scenario, TerritoryId, UnitId } from "../../engine/types";
import { invadeOdds, type MusterDraft, type MusterMove, notKnownYet, reinforceDefence } from "../../presentation/muster";
import type { PlanningSession } from "../../state/planning";
import { OddsInfo } from "../OddsInfo";

interface BoxProps {
  /** The order button, at the bottom of the card. */
  readonly action: ReactNode;
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly target: TerritoryId;
}

/** A bar split between two values, as shares of their sum. */
function Split({ left, right }: { readonly left: number; readonly right: number }): JSX.Element {
  const share = left + right === 0 ? 50 : Math.round((left / (left + right)) * 100);
  return (
    <span aria-hidden="true" className="muster-bar">
      <span className="muster-bar-left" style={{ width: `${String(share)}%` }} />
    </span>
  );
}

/** U6: the Invade pane's live odds, every effect known before the fight, and the order button. */
export function OddsBox({ action, draft, moves, scenario, session, support, target }: BoxProps & { readonly draft: MusterDraft; readonly moves: readonly MusterMove[]; readonly support: readonly UnitId[] }): JSX.Element {
  const odds = useMemo(
    () => invadeOdds(scenario, session.game.state, session.factionId, target, moves, support, draft),
    [draft, moves, scenario, session.factionId, session.game.state, support, target]
  );
  if (odds.kind !== "battle") return <div className="muster-box"><p className="pane-hint" role="status">{odds.text}</p>{action}</div>;
  return (
    <div className="muster-box muster-odds">
      <div className="muster-box-live" role="status">
        <div className="muster-box-numbers">
          <span><span className="muster-box-label">Attack</span> <strong>{odds.attack}</strong></span>
          <Split left={odds.attack} right={odds.defence} />
          <span><span className="muster-box-label">Defence</span> <strong>{odds.defence}</strong></span>
        </div>
        <dl className="muster-box-facts">
          <div><dt>Odds</dt><dd>{odds.odds}</dd></div>
          <div><dt>Take it</dt><dd data-tone={odds.tone}>{odds.take}</dd></div>
          <div><dt>Defenders</dt><dd>{odds.defenders}</dd></div>
        </dl>
        {odds.airLoss === undefined ? null : <p className="muster-box-line">{odds.airLoss}</p>}
        {odds.warning === undefined ? null : <p className="muster-box-line muster-warning">{odds.warning}</p>}
      </div>
      <OddsInfo label="About these odds"><span>Approximate</span></OddsInfo>
      <RollLedger {...odds.ledger} totalLabel="Total known now" />
      <p className="muster-note">{notKnownYet}</p>
      {action}
    </div>
  );
}

/** U6: the Reinforce pane's defence now and once the ticked units arrive. */
export function DefenceBox({ action, scenario, session, target, units }: BoxProps & { readonly units: readonly UnitId[] }): JSX.Element {
  const defence = useMemo(
    () => reinforceDefence(scenario, session.game.state, session.factionId, target, units),
    [scenario, session.factionId, session.game.state, target, units]
  );
  return (
    <div className="muster-box muster-defence">
      <div className="muster-box-live" role="status">
        <div className="muster-box-numbers">
          <span><span className="muster-box-label">Defence now</span> <strong>{defence.now}</strong></span>
          <Split left={defence.now} right={Math.max(0, defence.after - defence.now)} />
          <span><span className="muster-box-label">Defence after reinforcing</span> <strong>{defence.after}</strong></span>
        </div>
        <dl className="muster-box-facts">
          <div><dt>Units</dt><dd>{defence.units}</dd></div>
          {defence.threat === undefined ? <div><dt>Strongest threat</dt><dd>None next door</dd></div> : (
            <>
              <div><dt>Strongest threat</dt><dd>{defence.threat.from}</dd></div>
              <div><dt>Its odds</dt><dd>{`${defence.threat.now} now; ${defence.threat.after} after`}</dd></div>
            </>
          )}
        </dl>
      </div>
      {action}
    </div>
  );
}
