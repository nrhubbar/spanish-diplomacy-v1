import { type JSX, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { addInfoNotification, addWarningNotification } from "../../state/notificationSlice";
import { timeRanOut } from "../../state/timeout";
import { clockWarned, pauseClock, planningBudgetMs, remainingMs, resumeClock, startClock, type PlanningClock } from "../../state/timerSlice";
import type { HeaderSlotProps } from "./slots";

/** T6: warnings at 1 minute and at 10 seconds left. */
const warnings = [
  { message: "One minute left to plan this turn.", seconds: 60 },
  { message: "Ten seconds left. Planned orders go in when time runs out.", seconds: 10 }
] as const;

const tickMs = 250;

/** "4:12". */
export function clockText(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The clock's identity: the game, the turn and the planning faction. */
function clockKey(seed: number, turnNumber: number, factionId: string): string {
  return `${String(seed)}:${String(turnNumber)}:${factionId}`;
}

/**
 * Header slot: the turn timer (T5, T6). It shows only on a planning screen with the timer on.
 * The clock starts when this player's planning screen appears, which in hot-seat play is after
 * Continue on the handoff screen. When it reaches zero the planned orders go in. Pause covers
 * the map and keeps the time left; it exists in local play only.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the slot's data; the clock reads the session itself
export function TimerChip(_props: HeaderSlotProps): JSX.Element | null {
  const session = useAppSelector((state) => state.game.session);
  const timer = useAppSelector((state) => state.timer);
  if (session.phase !== "planning" || timer.minutes === 0) return null;
  const { game } = session;
  const local = !Object.values(game.assignments).includes("online-human");
  return (
    <RunningClock
      budgetMs={planningBudgetMs(timer.minutes, game.state.turnNumber)}
      clock={timer.clock}
      clockId={clockKey(game.seed, game.state.turnNumber, session.factionId)}
      pausable={local}
    />
  );
}

interface RunningClockProps {
  readonly budgetMs: number;
  readonly clock: PlanningClock | undefined;
  readonly clockId: string;
  readonly pausable: boolean;
}

function RunningClock({ budgetMs, clock, clockId, pausable }: RunningClockProps): JSX.Element {
  const dispatch = useAppDispatch();
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef<string | undefined>(undefined);
  const current = clock?.key === clockId ? clock : undefined;
  const running = current?.runningSince !== undefined;

  useEffect(() => {
    if (current === undefined) dispatch(startClock({ budgetMs, key: clockId, now: Date.now() }));
  }, [budgetMs, clockId, current, dispatch]);

  useEffect(() => {
    if (!running) return undefined;
    const id = window.setInterval(() => { setNow(Date.now()); }, tickMs);
    return () => { window.clearInterval(id); };
  }, [running]);

  const left = current === undefined ? budgetMs : remainingMs(current, running ? now : 0);

  useEffect(() => {
    if (current === undefined || !running) return;
    for (const warning of warnings) {
      if (left <= warning.seconds * 1000 && left > 0 && budgetMs > warning.seconds * 1000 && !current.warned.includes(warning.seconds)) {
        dispatch(clockWarned(warning.seconds));
        dispatch(warning.seconds === 60 ? addInfoNotification(warning.message) : addWarningNotification(warning.message));
      }
    }
    if (left <= 0 && fired.current !== clockId) {
      fired.current = clockId;
      dispatch(timeRanOut());
    }
  }, [budgetMs, clockId, current, dispatch, left, running]);

  const level = left <= 10_000 ? "urgent" : left <= 60_000 ? "warning" : "calm";
  return (
    <div className="timer-chip header-meter" data-level={level}>
      <span className="timer-face" role="timer" aria-label={`Time left to plan: ${clockText(left)}`}>
        <svg aria-hidden="true" fill="none" focusable="false" height="1em" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="1em">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span aria-hidden="true">{clockText(left)}</span>
      </span>
      {pausable ? (
        <button aria-label="Pause the turn timer" className="timer-pause" onClick={() => dispatch(pauseClock({ now: Date.now() }))} type="button">
          <svg aria-hidden="true" fill="currentColor" focusable="false" height="0.9em" viewBox="0 0 24 24" width="0.9em"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        </button>
      ) : null}
      {current !== undefined && !running ? <PauseCover left={left} onResume={() => dispatch(resumeClock({ now: Date.now() }))} /> : null}
    </div>
  );
}

/** Q-TIMER-4: the pause covers the map like the handoff screen, so nobody plans or peeks. */
function PauseCover({ left, onResume }: { readonly left: number; readonly onResume: () => void }): JSX.Element {
  return createPortal(
    <div aria-labelledby="pause-title" aria-modal="true" className="pause-cover" role="dialog">
      <div className="pause-card">
        <p className="screen-kicker">Turn timer</p>
        <h2 id="pause-title">Paused</h2>
        <p>{`${clockText(left)} left to plan. The clock waits until you resume.`}</p>
        <button autoFocus onClick={onResume} type="button">Resume</button>
      </div>
    </div>,
    document.body
  );
}
