import { useAppDispatch, useAppSelector } from "./hooks";
import { decrement, increment, selectCounterValue } from "./state/counterSlice";
import { goToCounter, goToStart, selectScreen } from "./state/navigationSlice";

export function App(): React.JSX.Element {
  const screen = useAppSelector(selectScreen);

  if (screen === "counter") {
    return <CounterScreen />;
  }

  return <StartScreen />;
}

function StartScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();

  return (
    <section className="screen" aria-labelledby="start-title">
      <p className="screen-kicker">Strategy prototype</p>
      <h1 id="start-title">Spanish Diplomacy</h1>
      <p className="screen-copy">Hidden orders. Simultaneous resolution.</p>
      <button type="button" onClick={() => dispatch(goToCounter())}>
        Start
      </button>
    </section>
  );
}

function CounterScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
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
      <button type="button" className="secondary-button" onClick={() => dispatch(goToStart())}>
        Back
      </button>
    </section>
  );
}
