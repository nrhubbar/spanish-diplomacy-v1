import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { exitGame, startGame } from "./gameSlice";
import type { RootState } from "./store";

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

/** T5 (Q-TIMER-5, Q-TIMER-6): every turn gets the full time again, and turn 1 gets double. */
export function planningBudgetMs(minutes: number, turnNumber: number): number {
  return minutes * 60_000 * (turnNumber === 1 ? 2 : 1);
}

/** Time left at `now`, never below zero. */
export function remainingMs(clock: PlanningClock, now: number): number {
  const running = clock.runningSince === undefined ? 0 : Math.max(0, now - clock.runningSince);
  return Math.max(0, clock.budgetMs - clock.spentMs - running);
}

/**
 * The turn timer (T5, T6). Reducers stay pure: every time arrives in the action, read from the
 * clock by the chip that dispatches it. The engine never sees any of it.
 */
export const timerSlice = createSlice({
  extraReducers: (builder) => {
    builder
      .addCase(startGame, (state) => ({ minutes: state.minutes }))
      .addCase(exitGame, (state) => ({ minutes: state.minutes }));
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

export function selectTimer(state: RootState): TimerState {
  return state.timer;
}
