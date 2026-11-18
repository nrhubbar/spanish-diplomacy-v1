import { describe, expect, it } from "vitest";
import {
  compactUnitStrength,
  iberiaMapProjectionTransform,
  mapAssetCompensation,
  mapKeyboardIntent,
  mapPresentationConfig,
  projectMapCoordinate,
  unitDesignation,
  unitMarkerPosition
} from "../main/components/mapPresentation";
import { terrainRenderMetrics, terrainRenderingConfig } from "../main/components/terrainRendering";

describe("map presentation", () => {
  it("keeps registered geography and overlays in one coordinate system", () => {
    expect(iberiaMapProjectionTransform).toBe("matrix(1 0 0 1 0 0)");
    expect(projectMapCoordinate({ x: 356.7, y: 613.8 })).toEqual({ x: 356.7, y: 613.8 });
  });

  it("interpolates counters and labels independently from terrain zoom", () => {
    const unitCompensation = mapAssetCompensation(
      3.24,
      mapPresentationConfig.unitCompensationExponent
    );
    const labelCompensation = mapAssetCompensation(
      3.24,
      mapPresentationConfig.labelCompensationExponent
    );

    expect(mapAssetCompensation(1.08, 0.42)).toBeCloseTo(0.9682, 3);
    expect(3.24 * unitCompensation).toBeGreaterThan(1.9);
    expect(unitCompensation).toBeGreaterThan(labelCompensation);
  });

  it.each([
    ["w", { deltaX: 0, deltaY: 36, kind: "pan" }],
    ["ArrowDown", { deltaX: 0, deltaY: -36, kind: "pan" }],
    ["a", { deltaX: 36, deltaY: 0, kind: "pan" }],
    ["ArrowRight", { deltaX: -36, deltaY: 0, kind: "pan" }],
    ["+", { kind: "zoom-in" }],
    ["_", { kind: "zoom-out" }],
    ["Home", { kind: "reset" }],
    [" ", { kind: "select" }]
  ] as const)("maps %s to a map intent", (key, expected) => {
    expect(mapKeyboardIntent(key)).toEqual(expected);
  });

  it("ignores keys that do not control the map", () => {
    expect(mapKeyboardIntent("Escape")).toBeUndefined();
  });

  it("positions stacked counters in stable rows", () => {
    const viewBox = { height: 225, width: 225, x: 238, y: 515 } as const;
    expect(unitMarkerPosition({ x: 350.5, y: 627.5 }, 0, viewBox)).toEqual({
      leftPercent: 50,
      topPercent: 50
    });
    expect(unitMarkerPosition({ x: 350.5, y: 627.5 }, 5, viewBox)).toEqual({
      leftPercent: 53.9,
      topPercent: 53.5
    });
  });

  it("builds compact strength and designation labels", () => {
    expect(compactUnitStrength(740)).toBe("740");
    expect(compactUnitStrength(1000)).toBe("1k");
    expect(compactUnitStrength(1750)).toBe("1.8k");
    expect(unitDesignation("Wad-Ras Infantry Regiment No. 1")).toBe("WR1");
    expect(unitDesignation("Security Battalion")).toBe("");
  });
});

describe("terrain rendering policy", () => {
  it("caps expensive display metrics while preserving valid minimums", () => {
    expect(terrainRenderMetrics(0, -2, 3, 16)).toEqual({
      anisotropy: terrainRenderingConfig.maxAnisotropy,
      height: 1,
      pixelRatio: terrainRenderingConfig.maxPixelRatio,
      width: 1
    });
    expect(terrainRenderMetrics(640, 480, 0.75, 0)).toEqual({
      anisotropy: 1,
      height: 480,
      pixelRatio: 1,
      width: 640
    });
  });
});
