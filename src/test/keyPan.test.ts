import { describe, expect, it } from "vitest";
import {
  advancePan,
  easedDistance,
  idlePan,
  isPanning,
  panKeyDown,
  panKeyUp,
  panMotion,
  type PanState,
  panStepPixels
} from "../main/map/keyboard";

/** Runs whole frames and sums the camera deltas they produce. */
function run(state: PanState, frames: number, frameMs = 16): { readonly deltaX: number; readonly deltaY: number; readonly state: PanState; readonly steps: readonly number[] } {
  let current = state;
  let deltaX = 0;
  let deltaY = 0;
  const steps: number[] = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const step = advancePan(current, frameMs);
    current = step.state;
    deltaX += step.deltaX;
    deltaY += step.deltaY;
    steps.push(Math.hypot(step.deltaX, step.deltaY));
  }
  return { deltaX, deltaY, state: current, steps };
}

const cruisePerFrame = (panMotion.cruiseSpeed * 16) / 1000;

describe("smooth keyboard panning (K1)", () => {
  it("eases in over about 120 ms, then pans at a constant screen speed", () => {
    expect(easedDistance(0, panMotion.easeMs)).toBeCloseTo((panMotion.cruiseSpeed * panMotion.easeMs) / 2000);
    expect(easedDistance(500, 1000)).toBeCloseTo(panMotion.cruiseSpeed / 2);
    const held = run(panKeyDown(idlePan, "KeyD", "right"), 40);
    // The view moves right, so the map content moves left: a negative camera delta.
    expect(held.deltaY).toBe(0);
    expect(held.deltaX).toBeLessThan(0);
    expect(held.steps[0]).toBeLessThan(held.steps[7] ?? 0);
    for (const step of held.steps.slice(8)) expect(step).toBeCloseTo(cruisePerFrame);
    expect(-held.deltaX).toBeCloseTo(easedDistance(0, 40 * 16));
    expect(isPanning(held.state)).toBe(true);
  });

  it("moves diagonally at the same speed and cancels opposite keys", () => {
    const both = panKeyDown(panKeyDown(idlePan, "KeyD", "right"), "KeyW", "up");
    const diagonal = run(both, 20);
    const straight = run(panKeyDown(idlePan, "KeyD", "right"), 20);
    expect(Math.hypot(diagonal.deltaX, diagonal.deltaY)).toBeCloseTo(-straight.deltaX);
    expect(diagonal.deltaX).toBeCloseTo(-diagonal.deltaY);
    expect(diagonal.deltaY).toBeGreaterThan(0);
    const opposite = advancePan(panKeyDown(both, "KeyS", "down"), 16);
    expect(opposite.deltaY).toBe(0);
    expect(opposite.deltaX).toBeLessThan(0);
    const cancelled = advancePan(panKeyDown(panKeyDown(idlePan, "KeyA", "left"), "KeyD", "right"), 16);
    expect([cancelled.deltaX, cancelled.deltaY]).toEqual([0, 0]);
    expect(cancelled.state.keys.size).toBe(2);
    // The same direction from two keys does not move twice as fast.
    const twice = run(panKeyDown(panKeyDown(idlePan, "KeyD", "right"), "ArrowRight", "right"), 20);
    expect(twice.deltaX).toBeCloseTo(straight.deltaX);
  });

  it("glides a quick tap one step and stops there", () => {
    const tap = panKeyUp(panKeyDown(idlePan, "KeyA", "left"), "KeyA");
    expect(isPanning(tap)).toBe(true);
    const glide = run(tap, 30);
    expect(glide.deltaX).toBeCloseTo(panStepPixels);
    expect(glide.state).toBe(idlePan);
    expect(glide.steps.filter((step) => step > 0).length).toBeGreaterThan(3);
    // Quick taps add up instead of cutting each other short.
    let taps = idlePan;
    let deltaY = 0;
    for (let press = 0; press < 3; press += 1) {
      const step = advancePan(taps, 16);
      deltaY += step.deltaY;
      taps = panKeyUp(panKeyDown(step.state, "KeyS", "down"), "KeyS");
    }
    const rest = run(taps, 60);
    expect(deltaY + rest.deltaY).toBeCloseTo(-3 * panStepPixels);
    expect(rest.state).toBe(idlePan);
  });

  it("stops on keyup once past a step, and ignores keys it never saw", () => {
    const held = run(panKeyDown(idlePan, "KeyD", "right"), 20).state;
    const released = panKeyUp(held, "KeyD");
    expect(released).toBe(idlePan);
    expect(advancePan(released, 16)).toEqual({ deltaX: 0, deltaY: 0, state: idlePan });
    expect(panKeyUp(held, "KeyQ")).toBe(held);
    // Releasing one of two keys keeps the other going.
    const two = panKeyDown(held, "KeyW", "up");
    const one = panKeyUp(run(two, 10).state, "KeyD");
    const after = advancePan(one, 16);
    expect(after.deltaX).toBe(0);
    expect(after.deltaY).toBeGreaterThan(0);
  });

  it("ignores a second keydown for a held key and caps a late frame", () => {
    const held = panKeyDown(idlePan, "KeyD", "right");
    expect(panKeyDown(held, "KeyD", "right")).toBe(held);
    const late = advancePan(run(held, 20).state, 500);
    expect(-late.deltaX).toBeCloseTo((panMotion.cruiseSpeed * panMotion.maxFrameMs) / 1000);
    expect(advancePan(held, -5).deltaX).toBeCloseTo(0);
  });

  it("drops a released key its opposite cancels", () => {
    const state = panKeyUp(panKeyDown(panKeyDown(idlePan, "KeyD", "right"), "KeyA", "left"), "KeyA");
    const step = advancePan(state, 16);
    expect([step.deltaX, step.deltaY]).toEqual([0, 0]);
    expect([...step.state.keys.keys()]).toEqual(["KeyD"]);
    expect(advancePan(panKeyUp(state, "KeyD"), 16).state).toBe(idlePan);
  });
});
