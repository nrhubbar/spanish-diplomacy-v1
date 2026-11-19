import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CameraBounds, pixelsPerUnit } from "../main/map/camera";
import { panStepPixels } from "../main/map/keyboard";
import { useMapCamera } from "../main/map/useMapCamera";

const bounds: CameraBounds = { content: { height: 4000, width: 4000, x: 0, y: 0 }, focus: { height: 1000, width: 1000, x: 1500, y: 1500 } };
const noInsets = () => ({ bottom: 0, right: 0 });

let now = 0;
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;

/** Runs the pending animation frame `ms` after the last one. */
function frame(ms = 16): void {
  now += ms;
  const pending = [...frames];
  frames = new Map();
  act(() => { for (const [, callback] of pending) callback(now); });
}

function keyDown(key: string, code: string, repeat = false, modifiers: { readonly altKey?: boolean; readonly ctrlKey?: boolean; readonly metaKey?: boolean } = {}) {
  const event = { altKey: false, code, ctrlKey: false, key, metaKey: false, preventDefault: vi.fn(), repeat, target: document.body, ...modifiers };
  return event as typeof event & KeyboardEvent<HTMLDivElement>;
}

async function mountCamera() {
  const hook = renderHook(() => useMapCamera(bounds, noInsets, vi.fn()));
  await act(async () => {
    hook.result.current.containerRef(document.createElement("div"));
    await Promise.resolve();
  });
  expect(hook.result.current.measured).toBe(true);
  return hook;
}

describe("smooth keyboard panning in the camera hook (K1)", () => {
  beforeEach(() => {
    now = 0;
    frames = new Map();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrame;
      nextFrame += 1;
      frames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pans every frame while a key is held and stops on keyup", async () => {
    const { result } = await mountCamera();
    const start = result.current.camera.centerX;
    const event = keyDown("d", "KeyD");
    act(() => { result.current.onKeyDown(event); });
    expect(event.preventDefault).toHaveBeenCalled();
    const positions: number[] = [];
    for (let step = 0; step < 10; step += 1) {
      frame();
      positions.push(result.current.camera.centerX);
    }
    expect(positions.every((x, index) => x > (positions[index - 1] ?? start))).toBe(true);
    // Shift released first still stops the key: it is tracked by its code.
    act(() => { window.dispatchEvent(new globalThis.KeyboardEvent("keyup", { code: "KeyD", key: "D" })); });
    frame();
    const stopped = result.current.camera.centerX;
    frame();
    expect(result.current.camera.centerX).toBe(stopped);
    expect(frames.size).toBe(0);
  });

  it("glides a tap about one step", async () => {
    const { result } = await mountCamera();
    const start = result.current.camera;
    act(() => { result.current.onKeyDown(keyDown("w", "")); });
    act(() => { window.dispatchEvent(new globalThis.KeyboardEvent("keyup", { key: "W" })); });
    for (let step = 0; step < 20; step += 1) frame();
    const scale = pixelsPerUnit(start, result.current.viewport, bounds);
    expect((start.centerY - result.current.camera.centerY) * scale).toBeCloseTo(panStepPixels);
    expect(frames.size).toBe(0);
  });

  it("ignores auto-repeat and keeps the key from scrolling the page", async () => {
    const { result } = await mountCamera();
    const repeat = keyDown("ArrowRight", "ArrowRight", true);
    act(() => { result.current.onKeyDown(repeat); });
    expect(repeat.preventDefault).toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it("leaves pan keys with Cmd, Ctrl, or Alt to the browser", async () => {
    const { result } = await mountCamera();
    for (const modifier of ["altKey", "ctrlKey", "metaKey"] as const) {
      const chord = keyDown("d", "KeyD", false, { [modifier]: true });
      act(() => { result.current.onKeyDown(chord); });
      expect(chord.preventDefault).not.toHaveBeenCalled();
    }
    expect(frames.size).toBe(0);
  });

  it("stops at once when the window loses focus or the page is hidden", async () => {
    const { result, unmount } = await mountCamera();
    act(() => { result.current.onKeyDown(keyDown("d", "KeyD")); });
    frame();
    act(() => { window.dispatchEvent(new Event("blur")); });
    expect(frames.size).toBe(0);
    const afterBlur = result.current.camera.centerX;

    act(() => { result.current.onKeyDown(keyDown("s", "KeyS")); });
    frame();
    expect(result.current.camera.centerX).toBe(afterBlur);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(frames.size).toBe(1);
    hidden.mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(frames.size).toBe(0);

    act(() => { result.current.onKeyDown(keyDown("a", "KeyA")); });
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });
});
