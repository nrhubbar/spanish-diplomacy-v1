import { describe, expect, it } from "vitest";
import {
  clampMapCamera,
  initialMapCamera,
  mapSemanticLevel,
  panMapCamera,
  renderedMapScale,
  zoomMapCamera
} from "../main/components/mapCamera";

const viewport = { height: 400, width: 600 } as const;

describe("map camera", () => {
  it("keeps a small pan range at overview scale", () => {
    expect(panMapCamera(initialMapCamera, -36, 0, viewport)).toEqual({ scale: 1, x: -24, y: 0 });
    expect(panMapCamera(initialMapCamera, 36, 0, viewport)).toEqual({ scale: 1, x: 24, y: 0 });
  });

  it("clamps scale and translation to the rendered board", () => {
    const clamped = clampMapCamera({ scale: 8, x: -9000, y: 9000 }, viewport);
    expect(clamped.scale).toBe(3);
    expect(clamped.x).toBeCloseTo(-672);
    expect(clamped.y).toBeCloseTo(448);
  });

  it("zooms around the requested screen position", () => {
    expect(zoomMapCamera(initialMapCamera, 2, 100, 100, viewport)).toEqual({
      scale: 2,
      x: 200,
      y: 100
    });
    expect(zoomMapCamera(initialMapCamera, 0.5, 100, 100, viewport)).toEqual(initialMapCamera);
  });

  it("exposes stable rendered scale and semantic levels", () => {
    expect(renderedMapScale(initialMapCamera)).toBeCloseTo(1.08);
    expect(mapSemanticLevel(1)).toBe("overview");
    expect(mapSemanticLevel(1.45)).toBe("operational");
    expect(mapSemanticLevel(2.1)).toBe("detail");
  });
});
