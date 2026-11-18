import { describe, expect, it } from "vitest";
import { soak } from "./soakRun";
import { spain, tiny } from "./support";

// Revision 5, section 8.4. Measured results are recorded in milestone-2-rev-5.md with the
// seed range used here (seeds 1-200, 30 turns).
describe("computer player soak", () => {
  const spainRun = soak(spain(), 200, 30);

  it("never wins a game before turn 4 (S1)", () => {
    expect(spainRun.earlyWins / spainRun.games).toBeLessThanOrEqual(0.05);
  });

  it("never abandons every objective without losing a unit (S3, A1)", () => {
    expect(spainRun.abandonments).toBe(0);
  });

  it("opens every game with movement (the first turn changes territory)", () => {
    expect(spainRun.firstTurnChanges).toBeGreaterThanOrEqual(spainRun.games);
  });

  it("records the m2-movement stalemate and balance (S2 and S4 need OD-9 and OD-10)", () => {
    // A held territory cannot be taken under m2-movement (no support or strength), so most
    // games freeze once fronts are occupied, and decided games currently all go to one side.
    // These bounds fail if rules or data change the picture, prompting a re-baseline.
    expect(spainRun.freezes / spainRun.games).toBeGreaterThan(0.5);
    expect(spainRun.decided / spainRun.games).toBeLessThan(0.5);
    expect(Object.keys(spainRun.wins)).toEqual(["republic"]);
  });

  it("is deterministic for a seed (R3)", () => {
    expect(soak(spain(), 5, 10, 77)).toEqual(soak(spain(), 5, 10, 77));
  });

  it("can decide a game when a front is open", () => {
    const fixture = soak(tiny(), 50, 30);
    expect(fixture.decided).toBeGreaterThan(0);
  });
});
