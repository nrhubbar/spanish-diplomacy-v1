import { type JSX, useId, useState } from "react";
import { casualtiesView, menInFull, menInShort } from "../../presentation/casualties";
import { EconomyIcon } from "../economy/EconomyIcon";
import type { HeaderSlotProps } from "./slots";

/** The men lost by every side since the first turn, beside the faction's name. Tapping it shows each side's. */
export function CasualtyChip({ scenario, state }: HeaderSlotProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { sides, total } = casualtiesView(scenario, state);
  return (
    <div className="casualty-chip-wrap">
      <button
        aria-controls={id}
        aria-expanded={open}
        className="casualty-chip"
        onClick={() => { setOpen(!open); }}
        type="button"
      >
        <EconomyIcon name="skull" />
        <span>{menInShort(total)}</span>{" "}
        <span className="visually-hidden">{`casualties: ${total === 0 ? "none yet" : `${menInFull(total)} men`}`}</span>
      </button>
      <div aria-label="Casualties since turn 1" className="casualty-detail" hidden={!open} id={id} role="region">
        <table>
          <caption>Casualties since turn 1</caption>
          <tbody>
            {sides.map((side) => <tr key={side.factionId}><th scope="row">{side.name}</th><td>{menInFull(side.men)}</td></tr>)}
          </tbody>
          <tfoot><tr><th scope="row">All sides</th><td>{menInFull(total)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
