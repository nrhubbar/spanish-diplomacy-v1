import { describe, expect, it } from "vitest";
import { soak } from "./soakRun";
import { spain, tiny } from "./support";

// Revision 5, section 8.4, re-baselined for Revision 7: the battle rules with standing orders
// (only an entrenching army digs a territory in, O3), the 35 researched armies, and the computer
// player with offensives. Seeds 1-200, 30 turns. Measured: S1 0 early wins (budget 5 percent:
// met), S2 116 of 200 games have a five-turn freeze (58 percent; budget 20: missed), S3 0
// abandonments (met), and 103 games decided (Republic 42, Northern command 48, Southern command
// 13). Revision 6 measured 70 percent freezes and 79 decided games (Republic 70). There is no
// balance target in Milestone 2 (P3): the S2 miss is reported to the owner, not tuned. The bands
// record the picture, so a change in rules, data, or the computer player prompts a re-baseline.
describe("computer player soak", () => {
  const spainRun = soak(spain(), 200, 30);

  it("never wins a game before turn 4 (S1)", () => {
    expect(spainRun.earlyWins / spainRun.games).toBeLessThanOrEqual(0.05);
  });

  it("never abandons every objective without losing a unit or being driven out (S3, A1)", () => {
    expect(spainRun.abandonments).toBe(0);
  });

  it("opens every game with movement (the first turn changes territory)", () => {
    expect(spainRun.firstTurnChanges).toBeGreaterThanOrEqual(spainRun.games);
  });

  it("records the freeze rate and balance (S2: budget 20 percent; missed, reported under P3)", () => {
    expect(spainRun.freezes / spainRun.games).toBeGreaterThan(0.48);
    expect(spainRun.freezes / spainRun.games).toBeLessThan(0.68);
    expect(spainRun.decided / spainRun.games).toBeGreaterThan(0.42);
    expect(spainRun.decided / spainRun.games).toBeLessThan(0.62);
    expect(Object.keys(spainRun.wins).sort()).toEqual(["north", "republic", "south"]);
  });

  it("is deterministic for a seed (R3)", () => {
    expect(soak(spain(), 5, 10, 77)).toEqual(soak(spain(), 5, 10, 77));
  });

  it("can decide a game when a front is open", () => {
    const fixture = soak(tiny(), 50, 30);
    expect(fixture.decided).toBeGreaterThan(0);
  });
});
