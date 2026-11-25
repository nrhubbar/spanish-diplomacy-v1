import type { FactionId } from "../engine/types";
import type { GameRecord, SeatClock } from "./types";

/** T5 (Q-TIMER-5, Q-TIMER-6): every turn gets the full time again, and turn 1 gets double. */
export function planningBudgetMs(minutes: number, turnNumber: number): number {
  return minutes * 60_000 * (turnNumber === 1 ? 2 : 1);
}

/** Time left at `now`, never below zero. */
export function remainingMs(clock: SeatClock, now: number): number {
  const running = clock.runningSince === undefined ? 0 : Math.max(0, now - clock.runningSince);
  return Math.max(0, clock.budgetMs - clock.spentMs - running);
}

/** How early a player's own clock may call time, for the difference between it and the host's. */
export const expiryGraceMs = 1000;

export function isSpent(clock: SeatClock | undefined, now: number): boolean {
  return clock?.runningSince !== undefined && remainingMs(clock, now) <= expiryGraceMs;
}

export function pausedClock(clock: SeatClock, now: number): SeatClock {
  if (clock.runningSince === undefined) return clock;
  return { budgetMs: clock.budgetMs, spentMs: clock.spentMs + Math.max(0, now - clock.runningSince) };
}

export function runningClock(clock: SeatClock, now: number): SeatClock {
  return clock.runningSince === undefined ? { ...clock, runningSince: now } : clock;
}

/** The human players of a game, each once. */
export function playersOf(seats: GameRecord["seats"]): readonly string[] {
  return [...new Set(Object.values(seats).flatMap((seat) => (seat.kind === "human" ? [seat.playerId] : [])))];
}

/**
 * The clocks of a turn as it opens. Between several players they run at once, so everyone has the
 * same deadline. One player's own game starts each clock when that seat is opened, and may pause.
 */
export function openingClocks(record: Pick<GameRecord, "seats" | "timerMinutes">, turnNumber: number, now: number): GameRecord["clocks"] {
  if (record.timerMinutes === 0) return {};
  const together = playersOf(record.seats).length > 1;
  const clock: SeatClock = { budgetMs: planningBudgetMs(record.timerMinutes, turnNumber), spentMs: 0, ...(together ? { runningSince: now } : {}) };
  return Object.fromEntries((Object.entries(record.seats) as [FactionId, GameRecord["seats"][FactionId]][]).flatMap(([id, seat]) => (seat.kind === "human" ? [[id, clock]] : [])));
}

/** A clock's identity: the game, the turn and the planning faction. */
export function clockKey(gameId: string, turnNumber: number, factionId: string): string {
  return `${gameId}:${String(turnNumber)}:${factionId}`;
}
