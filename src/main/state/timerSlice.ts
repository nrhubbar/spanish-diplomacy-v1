import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { clockKey } from "../game/clock";
import { exitGame, startGame, viewReceived } from "./gameSlice";

export { clockKey, planningBudgetMs, remainingMs } from "../game/clock";

/** T5 (Q-TIMER-1): the setup choices. 30 minutes and 1 hour wait for online play. */
export const timerChoices = [0, 1, 5, 10] as const;
export type TimerMinutes = (typeof timerChoices)[number];
export const onlineTimerChoices = [30, 60] as const;

/** One player's clock for one turn. Times are milliseconds from `Date.now()`, given by the UI. */
export interface PlanningClock {
  /** The game, turn and faction it belongs to; a new key starts a new clock. */
  readonly key: string;
  readonly budgetMs: number;
  /** Time used before the current run. */
  readonly spentMs: number;
  /** When the current run started; absent while paused. */
  readonly runningSince?: number;
  /** Warnings already given, by the seconds left they were given at (60, 10). */
  readonly warned: readonly number[];
}

export interface TimerState {
  readonly clock?: PlanningClock;
  readonly minutes: TimerMinutes;
}

const initialState: TimerState = { minutes: 0 };

/**
 * The turn timer (T5, T6) as this screen shows it. The host keeps the real clocks and decides when
 * time is up (`game/clock.ts`); this copy starts at once and takes the host's times when they come.
 */
export const timerSlice = createSlice({
  extraReducers: (builder) => {
    builder
      .addCase(startGame, (state) => ({ minutes: state.minutes }))
      .addCase(exitGame, (state) => ({ minutes: state.minutes }))
      .addCase(viewReceived, (state, { payload: view }) => {
        const { clock } = state;
        if (clock === undefined || view.clock === undefined || view.viewer === undefined || clock.key !== clockKey(view.gameId, view.state.turnNumber, view.viewer)) return state;
        return { ...state, clock: { key: clock.key, warned: clock.warned, ...view.clock } };
      });
  },
  initialState,
  name: "timer",
  reducers: {
    chooseTimer: (state, { payload }: PayloadAction<TimerMinutes>) => ({ ...state, minutes: payload }),
    /** T5 (Q-TIMER-2): the clock starts when the player's planning screen appears. */
    startClock: (state, { payload }: PayloadAction<{ readonly budgetMs: number; readonly key: string; readonly now: number }>) =>
      state.clock?.key === payload.key ? state : { ...state, clock: { budgetMs: payload.budgetMs, key: payload.key, runningSince: payload.now, spentMs: 0, warned: [] } },
    /** T5 (Q-TIMER-4): pausing keeps the time left. */
    pauseClock: (state, { payload }: PayloadAction<{ readonly now: number }>) => {
      const clock = state.clock;
      if (clock?.runningSince === undefined) return state;
      const { runningSince, ...rest } = clock;
      return { ...state, clock: { ...rest, spentMs: clock.spentMs + Math.max(0, payload.now - runningSince) } };
    },
    resumeClock: (state, { payload }: PayloadAction<{ readonly now: number }>) =>
      state.clock === undefined || state.clock.runningSince !== undefined ? state : { ...state, clock: { ...state.clock, runningSince: payload.now } },
    clockWarned: (state, { payload }: PayloadAction<number>) =>
      state.clock === undefined || state.clock.warned.includes(payload) ? state : { ...state, clock: { ...state.clock, warned: [...state.clock.warned, payload] } }
  }
});

export const { chooseTimer, clockWarned, pauseClock, resumeClock, startClock } = timerSlice.actions;
