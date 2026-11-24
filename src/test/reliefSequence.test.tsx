import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detailProgress, imageFading, isClear, nextRelief, picturesToLoad, type Relief, type ReliefEvent, reliefRefined, startRelief } from "../main/map/reliefSequence";
import { TerrainLayer } from "../main/map/TerrainLayer";
import { fadeOpacity, terrainRenderingConfig } from "../main/map/terrainRendering";
import type { MapRect } from "../main/scenarios/loader";

const after = (relief: Relief, ...events: readonly ReliefEvent[]): Relief => events.reduce(nextRelief, relief);
const gl = (kind: "arrived" | "faded" | "failed", layer: number): ReliefEvent => ({ by: "webgl", kind, layer });
const image = (kind: "arrived" | "faded" | "failed", layer: number): ReliefEvent => ({ by: "images", kind, layer });
const settled: ReliefEvent = { kind: "settled" };

describe("the order the relief's pictures come in", () => {
  const overview = after(startRelief(3, "webgl"), gl("arrived", 0));
  const whole = after(overview, settled, gl("arrived", 1));

  it("is the overview, then the rest after a moment, and the detail once wanted", () => {
    expect(picturesToLoad(startRelief(3, "webgl"), true)).toEqual([0]);
    expect(picturesToLoad(overview, true)).toEqual([]);
    expect(picturesToLoad(after(overview, settled), false)).toEqual([1]);
    expect(picturesToLoad(after(overview, settled), true)).toEqual([1, 2]);
    expect(picturesToLoad(whole, false)).toEqual([]);
    expect(picturesToLoad(whole, true)).toEqual([2]);
  });

  it("is refined once what is meant to be shown is, without a detail nobody wants yet", () => {
    expect(reliefRefined(after(overview, settled), false)).toBe(false);
    expect(reliefRefined(whole, false)).toBe(true);
    expect(detailProgress(whole, false)).toBe("waiting");
    expect(reliefRefined(whole, true)).toBe(false);
    expect(detailProgress(whole, true)).toBe("loading");
    const fading = after(whole, gl("arrived", 2));
    expect(reliefRefined(fading, true)).toBe(false);
    expect(detailProgress(fading, true)).toBe("loading");
    const shown = after(fading, gl("faded", 2));
    expect(reliefRefined(shown, true)).toBe(true);
    expect(detailProgress(shown, true)).toBe("shown");
  });

  it("goes on without a detail that failed, and does not ask for it again", () => {
    const failed = after(whole, gl("failed", 2));
    expect(failed.renderer).toBe("webgl");
    expect(reliefRefined(failed, true)).toBe(true);
    expect(detailProgress(failed, true)).toBe("failed");
    expect(picturesToLoad(failed, true)).toEqual([]);
  });

  it("counts a lone picture as the overview, and two as overview and detail", () => {
    const lone = after(startRelief(1, "webgl"), gl("arrived", 0));
    expect(reliefRefined(lone, false)).toBe(true);
    expect(detailProgress(lone, true)).toBe("none");
    expect(detailProgress(startRelief(0, "webgl"), true)).toBe("none");
    expect(isClear(startRelief(1, "images"), 0)).toBe(false);
    expect(reliefRefined(overview, false)).toBe(false);
    expect(reliefRefined(after(startRelief(2, "webgl"), gl("arrived", 0)), false)).toBe(true);
  });

  it("starts again with images when WebGL fails, keeping the overview that stood in", () => {
    const lost = after(whole, image("arrived", 0), { kind: "images-only" });
    expect(lost).toMatchObject({ renderer: "images", settled: true, stages: ["shown", "pending", "pending"] });
    expect(after(lost, gl("arrived", 2), gl("failed", 1))).toBe(lost);
    expect(after(whole, image("failed", 0), { kind: "images-only" }).stages[0]).toBe("pending");
    expect(isClear(lost, 1)).toBe(false);
    expect(isClear(lost, 2)).toBe(true);
    const fading = after(lost, image("arrived", 2));
    expect([isClear(fading, 2), imageFading(fading), imageFading(after(whole, gl("arrived", 2)))]).toEqual([false, true, false]);
  });

  it("never fades below clear or above solid", () => {
    expect([-5, 0, terrainRenderingConfig.detailFadeMs / 2, 9000].map(fadeOpacity)).toEqual([0, 0, 0.5, 1]);
  });
});

describe("the relief as images", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const rect = (width: number): MapRect => ({ height: 10, width, x: 0, y: 0 });
  const pictures = (name: string) => [{ bounds: rect(3000), url: `${name}-overview` }, { bounds: rect(1000), url: `${name}-detail` }];
  const terrain = (name: string, width: number) => <TerrainLayer layers={pictures(name)} onFallback={vi.fn()} place={(bounds) => bounds} visible={rect(width)} />;
  const images = (within: HTMLElement) => [...within.querySelectorAll("img")];

  it("is refined with the overview, fades the detail in when zoomed, and starts again with another map", () => {
    const { container, rerender } = render(terrain("a", 900));
    const layer = container.querySelector(".terrain-layer");
    expect(layer).toHaveAttribute("data-refined", "false");
    for (const each of images(container)) fireEvent.load(each);
    expect(layer).toHaveAttribute("data-refined", "true");
    rerender(terrain("a", 300));
    const detail = images(container)[1] as HTMLImageElement;
    expect(layer).toHaveAttribute("data-refined", "false");
    expect(detail).toHaveStyle({ opacity: "0", transition: "opacity 300ms" });
    fireEvent.load(detail);
    expect(detail).toHaveStyle({ opacity: "1" });
    expect(layer).toHaveAttribute("data-detail", "loading");
    act(() => { vi.advanceTimersByTime(terrainRenderingConfig.detailFadeMs); });
    expect(layer).toHaveAttribute("data-detail", "shown");
    expect(layer).toHaveAttribute("data-refined", "true");
    rerender(terrain("b", 900));
    expect(images(container).map((each) => each.getAttribute("src"))).toEqual(["b-overview"]);
    expect(container.querySelector(".terrain-layer")).toHaveAttribute("data-detail", "waiting");
  });

  it("stays on the overview when the detail fails", () => {
    const { container } = render(terrain("a", 300));
    fireEvent.load(images(container)[0] as HTMLImageElement);
    fireEvent.error(images(container)[1] as HTMLImageElement);
    expect(images(container)[1]).toHaveStyle({ opacity: "0" });
    expect(container.querySelector(".terrain-layer")).toHaveAttribute("data-detail", "failed");
    expect(container.querySelector(".terrain-layer")).toHaveAttribute("data-refined", "true");
  });
});
