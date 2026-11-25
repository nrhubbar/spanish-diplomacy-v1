import { createAction } from "@reduxjs/toolkit";

/**
 * T5 (Q-TIMER-3): the planning player's clock reached zero. Dispatched once by the timer chip; the
 * host checks its own clock and ends the turn with the orders last saved, exactly as End Turn
 * would (a half-built order was never saved). The submission says the time ran out (T6).
 */
export const timeRanOut = createAction("game/timeRanOut");
