import type { JSX } from "react";
import type { D6BattleOutcome } from "../../engine/types";
import { columnLabel, rawRow } from "../../presentation/battleText";
import { modifierName, signed } from "../../presentation/odds";
import { DieFace } from "./DieFace";

/** The odds, the die, every modifier by name, and the table row they produce (C14). */
export function BattleRoll({ battle }: { readonly battle: D6BattleOutcome }): JSX.Element {
  const raw = rawRow(battle);
  return (
    <div className="battle-roll">
      <p className="battle-odds">
        <span className="battle-odds-label">{battle.oddsLabel}</span>
        {` odds, ${columnLabel(battle.column)} column`}
      </p>
      <table className="battle-roll-table">
        <caption className="visually-hidden">Die roll and modifiers</caption>
        <tbody>
          <tr>
            <th scope="row">Die</th>
            <td><DieFace value={battle.die} />{String(battle.die)}</td>
          </tr>
          {battle.modifiers.map((modifier, index) => (
            <tr key={`${modifier.kind}-${String(index)}`}>
              <th scope="row">{modifierName(modifier)}</th>
              <td>{signed(modifier.roll)}</td>
            </tr>
          ))}
          <tr className="battle-roll-total">
            <th scope="row">Table row</th>
            <td>{raw === battle.row ? String(battle.row) : `${String(battle.row)} (${String(raw)}, kept within 0 to 6)`}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
