import { type JSX, useId } from "react";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { chooseTimer, onlineTimerChoices, timerChoices } from "../../state/timerSlice";

const label = (minutes: number): string => (minutes === 0 ? "Off" : minutes >= 60 ? `${String(minutes / 60)} h` : `${String(minutes)} min`);

/**
 * T5 (Q-TIMER-1, Q-UX-11): the setup screen's turn timer. Off, 1, 5 or 10 minutes; 30 minutes
 * and 1 hour are shown disabled, as online play coming later.
 */
export function TimerChoice(): JSX.Element {
  const dispatch = useAppDispatch();
  const minutes = useAppSelector((state) => state.timer.minutes);
  const name = useId();
  const hintId = useId();
  return (
    <fieldset aria-describedby={hintId} className="timer-choice">
      <legend>Turn timer</legend>
      <div className="timer-options">
        {timerChoices.map((choice) => (
          <label className="timer-option" key={choice}>
            <input checked={minutes === choice} name={name} onChange={() => dispatch(chooseTimer(choice))} type="radio" value={choice} />
            <span>{label(choice)}</span>
          </label>
        ))}
        {onlineTimerChoices.map((choice) => (
          <label className="timer-option" data-online="true" key={choice}>
            <input disabled name={name} type="radio" value={choice} />
            <span>{`${label(choice)} ${glyphs.dot} online`}</span>
          </label>
        ))}
      </div>
      <p className="timer-hint" id={hintId}>
        {"Each player's clock runs only on their own planning screen. Turn 1 gets double time. When time runs out, the orders you planned go in and every other unit holds."}
      </p>
    </fieldset>
  );
}
