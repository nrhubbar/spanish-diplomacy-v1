import type { JSX, ReactNode } from "react";
import type { SubmissionStatus } from "../state/selectors";
import { CasualtyChip } from "./header/CasualtyChip";
import { DateChip } from "./header/DateChip";
import { GameMenu } from "./header/GameMenu";
import { ReadinessChips } from "./header/ReadinessChips";
import { ResourceChips } from "./header/ResourceChips";
import type { HeaderSlotProps } from "./header/slots";
import { TimerChip } from "./header/TimerChip";

interface GameHeaderProps {
  /** U1: the planning controls before the menu: Last turn, Recruitment, Building and End Turn. */
  readonly actions?: ReactNode;
  readonly kicker: string;
  /** The slots' data; without it the Milestone 3 slots stay empty. */
  readonly slots?: HeaderSlotProps;
  readonly status?: readonly SubmissionStatus[];
  readonly title: string;
}

/**
 * Compact top bar for game screens, leaving the height to the map (U1). Left to right: the date
 * and readiness (X1, T6) by the title, the casualties beside it, the timer and the resources, then the screen's actions and
 * the game menu. Each slot is its own component under `header/`, owned by its slice.
 */
export function GameHeader({ actions, kicker, slots, status = [], title }: GameHeaderProps): JSX.Element {
  return (
    <header className="game-header">
      <div className="game-header-title">
        <div className="game-header-kicker-row">
          <p className="screen-kicker">{kicker}</p>
          <ReadinessChips status={status} />
        </div>
        <div className="game-header-name">
          <h1>{title}</h1>
          {slots === undefined ? null : <CasualtyChip {...slots} />}
        </div>
      </div>
      {slots === undefined ? null : (
        <>
          <DateChip {...slots} />
          <TimerChip {...slots} />
          <ResourceChips {...slots} />
        </>
      )}
      <div className="game-header-actions">
        {actions}
        <GameMenu />
      </div>
    </header>
  );
}
