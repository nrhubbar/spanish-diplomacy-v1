import { type JSX, useState } from "react";
import { useAppDispatch } from "../hooks";
import type { SubmissionStatus } from "../state/selectors";
import { exitGame } from "../state/gameSlice";
import { DateChip } from "./header/DateChip";
import { ReadinessChips } from "./header/ReadinessChips";
import { ResourceChips } from "./header/ResourceChips";
import type { HeaderSlotProps } from "./header/slots";
import { TimerChip } from "./header/TimerChip";

interface GameHeaderProps {
  readonly kicker: string;
  /** The slots' data; without it the Milestone 3 slots stay empty. */
  readonly slots?: HeaderSlotProps;
  readonly status?: readonly SubmissionStatus[];
  readonly title: string;
}

/**
 * Compact header for game screens, leaving the height to the map. Its slots, left to right:
 * the date, the timer, the resources, then the readiness chips (X1, T1, T6). Each slot is its
 * own component under `header/`, owned by its slice.
 */
export function GameHeader({ kicker, slots, status = [], title }: GameHeaderProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [confirming, setConfirming] = useState(false);

  return (
    <header className="game-header">
      <div className="game-header-title">
        <p className="screen-kicker">{kicker}</p>
        <h1>{title}</h1>
      </div>
      {slots === undefined ? null : (
        <>
          <DateChip {...slots} />
          <TimerChip {...slots} />
          <ResourceChips {...slots} />
        </>
      )}
      <ReadinessChips status={status} />
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
