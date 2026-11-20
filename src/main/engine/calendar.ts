import type { CalendarRules } from "./types";

/**
 * T1: half-month turns, 24 a year. Turn 1 is the calendar's start; each turn after it is the
 * next half of a month. The date is never stored: it derives from the turn number (CT-8).
 */

export interface TurnDate {
  readonly half: "early" | "late";
  /** Calendar month, 1-12. */
  readonly month: number;
  readonly year: number;
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

const halvesPerMonth = 2;
const monthsPerYear = 12;

/** The half-month a turn falls in. Turns before 1 count back from the start. */
export function turnDate(calendar: CalendarRules, turnNumber: number): TurnDate {
  const { start } = calendar;
  const startHalf = ((start.year * monthsPerYear) + (start.month - 1)) * halvesPerMonth + (start.half === "late" ? 1 : 0);
  const half = startHalf + (turnNumber - 1);
  const monthIndex = Math.floor(half / halvesPerMonth);
  return {
    half: half % halvesPerMonth === 0 ? "early" : "late",
    month: (monthIndex % monthsPerYear) + 1,
    year: Math.floor(monthIndex / monthsPerYear)
  };
}

/** "Late October 1936". */
export function dateLabel(date: TurnDate): string {
  return `${date.half === "early" ? "Early" : "Late"} ${monthNames[date.month - 1] ?? ""} ${String(date.year)}`;
}

/** The calendar month (1-12) of a turn. */
export function monthOfTurn(calendar: CalendarRules, turnNumber: number): number {
  return turnDate(calendar, turnNumber).month;
}
