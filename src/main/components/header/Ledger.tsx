import type { JSX } from "react";
import type { Scenario } from "../../engine/types";
import { signedResourceAmount } from "../../presentation/economy";
import type { Ledger as LedgerData } from "../../presentation/ledger";

/**
 * U11 (note 16): the balance view, one flat list. Each territory's row shows its yield; a
 * contested one shows its loss on the same row and pays nothing. The expense rows follow, then
 * the total, which is the chip's next-turn figure.
 */
export function Ledger({ ledger, scenario }: { readonly ledger: LedgerData; readonly scenario: Scenario }): JSX.Element {
  const amount = (value: number): string => signedResourceAmount(scenario, ledger.resourceId, value);
  return (
    <table className="ledger">
      <tbody>
        {ledger.rows.map((row) => (
          <tr data-kind={row.kind} data-contested={row.loss > 0} key={row.key}>
            <th scope="row">
              {row.label}
              {row.note === undefined ? null : <span className="ledger-note">{` ${row.note}`}</span>}
            </th>
            <td className="ledger-yield">
              {row.kind === "territory" ? amount(row.yield) : null}
              {row.loss > 0 ? <span className="ledger-loss">{` ${amount(-row.loss)} contested`}</span> : null}
            </td>
            <td className="ledger-value">{amount(row.value)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Next turn</th>
          <td />
          <td className="ledger-value">{amount(ledger.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
