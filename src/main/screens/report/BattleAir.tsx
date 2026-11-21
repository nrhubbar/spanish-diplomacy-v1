import type { JSX } from "react";
import { requireFaction } from "../../engine/lookup";
import type { AirBattleOutcome, Scenario } from "../../engine/types";
import { type AirSideView, airBattleView, airRollLabel } from "../../presentation/battleAir";
import { cssVariables } from "../../presentation/style";

interface BattleAirProps {
  readonly air: AirBattleOutcome;
  readonly scenario: Scenario;
}

/**
 * U10, R11: an engagement's air battle on the battle card, above its ground battle: both sides'
 * aircraft and AA, both rolls, who won the air and the Ground Support that applied.
 */
export function BattleAir({ air, scenario }: BattleAirProps): JSX.Element {
  const view = airBattleView(scenario, air);
  return (
    <section aria-label="Air battle" className="battle-air">
      <p className="battle-air-heading">Air battle</p>
      <div className="battle-sides">
        <AirSide scenario={scenario} side={view.attacker} />
        <AirSide scenario={scenario} side={view.defender} />
      </div>
      <p className="battle-air-result">{view.result}</p>
      <p className="battle-air-note">Only one side ever gets Ground Support. A tie in the air means neither does.</p>
    </section>
  );
}

function AirSide({ scenario, side }: { readonly scenario: Scenario; readonly side: AirSideView }): JSX.Element {
  return (
    <div className="battle-side battle-air-side" data-wins={side.wins} style={cssVariables({ "--faction-color": requireFaction(scenario, side.factionId).color })}>
      <p className="battle-side-head">
        <span className="battle-side-faction">{side.faction}</span>
        {side.wins ? <span className="battle-air-wins">Wins the air</span> : null}
      </p>
      <ul className="battle-armies">
        {side.none === undefined ? null : <li className="battle-air-none">{side.none}</li>}
        {side.lines.map((line, index) => (
          <li key={index}>
            <span>{line.label}</span>
            <span className="battle-army-value">{airRollLabel(line.roll)}</span>
          </li>
        ))}
      </ul>
      <p className="battle-air-total">{side.sum}</p>
    </div>
  );
}
