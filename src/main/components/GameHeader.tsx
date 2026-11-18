import { type JSX, useState } from "react";
import { useAppDispatch } from "../hooks";
import type { SubmissionStatus } from "../state/selectors";
import { exitGame } from "../state/gameSlice";

interface GameHeaderProps {
  readonly kicker: string;
  readonly status?: readonly SubmissionStatus[];
  readonly title: string;
}

/** Compact header for game screens, leaving the height to the map. */
export function GameHeader({ kicker, status = [], title }: GameHeaderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState(false);

  return (
    <header className="game-header">
      <div className="game-header-title">
        <p className="screen-kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {status.length === 0 ? null : (
        <ul aria-label="Order status" className="status-chips">
          {status.map((entry) => (
            <li data-ready={entry.ready} key={entry.factionId}>
              <span className="visually-hidden">{entry.ready ? "Ready: " : "Planning: "}</span>
              <span className="chip-name">{entry.name}</span>
              <abbr className="chip-abbreviation" title={entry.name}>{entry.abbreviation}</abbr>
            </li>
          ))}
        </ul>
      )}
      <div className="game-header-actions">
        {confirming ? (
          <div className="exit-confirm" role="group" aria-label="Leave this game?">
            <span>Leave this game?</span>
            <button className="secondary-button compact-button" onClick={() => { dispatch(exitGame()); }} type="button">Leave</button>
            <button className="compact-button" onClick={() => { setConfirming(false); }} type="button">Stay</button>
          </div>
        ) : (
          <button className="secondary-button compact-button" onClick={() => { setConfirming(true); }} type="button">Exit game</button>
        )}
      </div>
    </header>
  );
}
