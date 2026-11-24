import { Fragment, type JSX, useId, useState } from "react";
import type { Scenario } from "../../engine/types";
import { signedResourceAmount } from "../../presentation/economy";
import type { Ledger as LedgerData } from "../../presentation/ledger";

/**
 * U11 (note 16): the balance view, one flat list. Each territory's row shows its yield; a
 * contested one shows its loss on the same row and pays nothing. The expense rows follow (Upkeep
 * opens into a line per unit type, D1), then the total, which is the chip's next-turn figure.
 */
export function Ledger({ ledger, scenario }: { readonly ledger: LedgerData; readonly scenario: Scenario }): JSX.Element {
  const amount = (value: number): string => signedResourceAmount(scenario, ledger.resourceId, value);
  const id = useId();
  const [open, setOpen] = useState(true);
  return (
    <table className="ledger">
      <tbody>
        {ledger.rows.map((row) => (
          <Fragment key={row.key}>
            <tr data-kind={row.kind} data-contested={row.loss > 0}>
              <th colSpan={row.kind === "territory" ? 1 : 2} scope="row">
                {row.lines === undefined ? row.label : (
                  <button aria-controls={row.lines.map((line) => `${id}-${line.key}`).join(" ")} aria-expanded={open} className="ledger-fold" onClick={() => { setOpen(!open); }} type="button">
                    {row.label}
                  </button>
                )}
                {row.note === undefined ? null : <span className="ledger-note">{` ${row.note}`}</span>}
              </th>
              {row.kind === "territory" ? (
                <td className="ledger-yield">
                  {amount(row.yield)}
                  {row.loss > 0 ? <span className="ledger-loss">{` ${amount(-row.loss)} contested`}</span> : null}
                </td>
              ) : null}
              <td className="ledger-value">{amount(row.value)}</td>
            </tr>
            {(row.lines ?? []).map((line) => (
              <tr data-kind="line" hidden={!open} id={`${id}-${line.key}`} key={line.key}>
                <th colSpan={2} scope="row">{line.label}</th>
                <td className="ledger-value">{amount(line.value)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th colSpan={2} scope="row">Next turn</th>
          <td className="ledger-value">{amount(ledger.total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
