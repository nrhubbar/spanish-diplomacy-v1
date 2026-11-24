import type { JSX } from "react";
import { signed } from "../presentation/odds";
import type { RollLedgerData } from "../presentation/rollLedger";

interface RollLedgerProps extends RollLedgerData {
  readonly title?: string;
  readonly totalLabel?: string;
}

function tone(value: number): "minus" | "none" | "plus" {
  if (value === 0) return "none";
  return value > 0 ? "plus" : "minus";
}

/** The effects on a battle's roll as one running list, plus in green and minus in red, with the total below. */
export function RollLedger({ rows, title = "Effects on the roll:", total, totalLabel = "Total" }: RollLedgerProps): JSX.Element {
  return (
    <table className="roll-ledger">
      <caption>{title}</caption>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={2}>Nothing changes the roll.</td></tr>
          : rows.map((row, index) => (
            <tr key={`${row.label}-${String(index)}`}>
              <th scope="row">
                {row.label}
                {row.note === undefined ? null : <span className="roll-ledger-note">{` (${row.note})`}</span>}
                {row.details === undefined ? null : (
                  <details className="roll-ledger-details">
                    <summary>{row.details.summary}</summary>
                    <ul>{row.details.lines.map((line) => <li key={line}>{line}</li>)}</ul>
                  </details>
                )}
              </th>
              <td className="roll-ledger-value" data-tone={tone(row.value)}>{signed(row.value)}</td>
            </tr>
          ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{totalLabel}</th>
          <td className="roll-ledger-value" data-tone={tone(total)}>{signed(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
