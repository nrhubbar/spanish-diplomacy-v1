import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "../hooks";
import { decrement, increment, selectCounterValue } from "../state/counterSlice";

export function CounterScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const value = useAppSelector(selectCounterValue);

  return (
    <section className="screen" aria-labelledby="counter-title">
      <p className="screen-kicker">Turn lab</p>
      <h1 id="counter-title">Order Counter</h1>
      <output aria-label="Counter value" className="counter-value">
        {value}
      </output>
      <div className="counter-controls" aria-label="Counter controls">
        <button type="button" onClick={() => dispatch(decrement())}>
          Down
        </button>
        <button type="button" onClick={() => dispatch(increment())}>
          Up
        </button>
      </div>
      <button type="button" className="secondary-button" onClick={() => navigate("/")}>
        Back
      </button>
    </section>
  );
}
