import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clearOnScreen } from "../main/map/placement";
import { mouthTaper, RiverLayer, WaterLabelLayer } from "../main/map/WaterLayer";
import {
  alongCurve,
  curveFootprint,
  displayText,
  pointFootprint,
  riverLabelType,
  spreadSpacing,
  textWidth,
  visibleWater,
  waterLabelType,
  waterTierShown
} from "../main/map/waterLabels";
import { loadPackage, type MapPackage, PackageValidationError } from "../main/scenarios/loader";
import { checkWater, curveLength, indexWater, type MapRiver, polylinePoints } from "../main/scenarios/water";
import { mapSchema } from "../main/scenarios/schema/mapSchema";
import tinyMap from "./fixtures/scenarios/tiny-front/map.json";
import tinyScenario from "./fixtures/scenarios/tiny-front/scenario.json";
import { spainId, testRegistry } from "./support";

type Json = Record<string, unknown>;

const identity = (point: { readonly x: number; readonly y: number }) => point;
const straight = "M0 100l200 0";

function tinyWithWater(water: Json): readonly string[] {
  const map = { ...structuredClone(tinyMap), ...water };
  try {
    loadPackage({
      assetPaths: new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]),
      mapDocument: map,
      mapPath: "map.json",
      scenarioDocument: structuredClone(tinyScenario),
      scenarioPath: "scenario.json"
    });
    return [];
  } catch (error) {
    if (error instanceof PackageValidationError) return error.issues;
    throw error;
  }
}

function waterMap(rivers: readonly MapRiver[], labels: Json[] = []): MapPackage {
  const document = mapSchema.parse({ ...structuredClone(tinyMap), waterLabels: labels });
  return { ...testRegistry().require(spainId).map, ...indexWater(document), rivers };
}

const river = (id: string, rank: MapRiver["rank"], extra: Partial<MapRiver> = {}): MapRiver => ({ id, name: `R\u00edo ${id}`, path: straight, rank, ...extra });

describe("water data (map package)", () => {
  it("reads compact polyline path data, one list per move", () => {
    expect(polylinePoints("M10-5l2 0 0-3M-1 .5l1 1")).toEqual([[{ x: 10, y: -5 }, { x: 12, y: -5 }, { x: 12, y: -8 }], [{ x: -1, y: 0.5 }, { x: 0, y: 1.5 }]]);
    expect(curveLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11);
  });

  it("indexes rivers and both kinds of water label", () => {
    const document = mapSchema.parse({
      ...structuredClone(tinyMap),
      rivers: [{ id: "big", labelPath: straight, mouth: "M200 100l5 0", name: "R\u00edo Grande", path: straight, rank: "main" }],
      waterLabels: [{ text: "Bay", tier: "detail", x: 10, y: 20 }, { paths: [straight, "M0 50l100 0"], text: "Open Sea", tier: "overview" }]
    });
    const { rivers, waterLabels } = indexWater(document);
    expect(rivers[0]?.label?.length).toBe(200);
    expect(rivers[0]?.mouth).toBe("M200 100l5 0");
    expect(waterLabels[0]).toEqual({ kind: "point", text: "Bay", tier: "detail", x: 10, y: 20 });
    expect(waterLabels[1]?.kind === "curve" ? waterLabels[1].curves.map((curve) => curve.length) : []).toEqual([200, 100]);
  });

  it("defaults to no water, so packages without rivers stay valid", () => {
    expect(tinyWithWater({})).toEqual([]);
    expect(testRegistry().require(spainId).map.rivers.length).toBeGreaterThan(8);
  });

  it("rejects malformed paths, duplicate rivers, and water outside the view box", () => {
    expect(tinyWithWater({ rivers: [river("a", "main", { path: "M0 0 L5 5" })] }).join(" ")).toContain("Polylines");
    expect(tinyWithWater({ rivers: [river("a", "main"), river("a", "tributary")] })).toEqual(['map.rivers[1]: duplicate river id "a"']);
    expect(tinyWithWater({ rivers: [{ ...river("a", "main"), labelPath: "M0 0l-5 0" }] })).toEqual(["map.rivers.a: leaves the view box"]);
    expect(tinyWithWater({ waterLabels: [{ text: "Far", tier: "detail", x: 900, y: 0 }] })).toEqual(['map.waterLabels[0] "Far": outside the view box']);
    expect(checkWater(mapSchema.parse({ ...structuredClone(tinyMap), waterLabels: [{ paths: ["M0 0l300 0"], text: "Wide", tier: "overview" }] }))).toHaveLength(1);
  });
});

describe("water names (W1, W2, W5)", () => {
  it("shows each tier from its zoom", () => {
    expect(waterTierShown("overview", "overview")).toBe(true);
    expect(waterTierShown("operational", "overview")).toBe(false);
    expect(waterTierShown("operational", "operational")).toBe(true);
    expect(waterTierShown("detail", "operational")).toBe(false);
    expect(waterTierShown("detail", "detail")).toBe(true);
  });

  it("sets open seas in Spanish capitals and spreads them along their water", () => {
    expect(displayText("Oc\u00e9ano Atl\u00e1ntico", waterLabelType.overview)).toBe("OC\u00c9ANO ATL\u00c1NTICO");
    expect(displayText("Golfo de C\u00e1diz", waterLabelType.operational)).toBe("Golfo de C\u00e1diz");
    const type = waterLabelType.overview;
    expect(spreadSpacing("MAR", type, 10)).toBe(type.letterSpacing);
    expect(spreadSpacing("MAR", type, 10000)).toBe(type.widest);
    const between = spreadSpacing("MAR", type, 60);
    expect(between).toBeGreaterThan(type.letterSpacing);
    expect(textWidth("MAR", type, between)).toBeCloseTo(48);
  });

  it("walks along a curve and clamps to its ends", () => {
    const curve = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    expect(alongCurve(curve, 5)).toEqual({ direction: { x: 1, y: 0 }, point: { x: 5, y: 0 } });
    expect(alongCurve(curve, 15)).toEqual({ direction: { x: 0, y: 1 }, point: { x: 10, y: 5 } });
    expect(alongCurve(curve, 99).point).toEqual({ x: 10, y: 10 });
    expect(alongCurve(curve, -3).point).toEqual({ x: 0, y: 0 });
  });

  it("covers the text on a curve with squares lifted off the line, and refuses a curve shorter than its text", () => {
    const curve = { length: 200, path: straight, points: [{ x: 0, y: 100 }, { x: 200, y: 100 }] };
    const footprint = curveFootprint(curve, "R\u00edo Ebro", riverLabelType, 1, identity) ?? [];
    expect(footprint.length).toBeGreaterThan(3);
    expect(footprint.every((rect) => rect.y + rect.height < 100)).toBe(true);
    expect(Math.min(...footprint.map((rect) => rect.x))).toBeGreaterThan(50);
    expect(curveFootprint(curve, "R\u00edo Ebro", riverLabelType, 0.1, identity)).toBeUndefined();
    expect(pointFootprint({ x: 100, y: 50 }, "Bay", waterLabelType.detail)[0]?.y).toBeCloseTo(50 - waterLabelType.detail.fontSize);
  });

  it("hides a footprint the screen edge would cut or an obstacle would cover", () => {
    const viewport = { height: 100, width: 100 };
    expect(clearOnScreen([{ height: 10, width: 10, x: 10, y: 10 }], viewport, [])).toBe(true);
    expect(clearOnScreen([{ height: 10, width: 10, x: 95, y: 10 }], viewport, [])).toBe(false);
    expect(clearOnScreen([{ height: 10, width: 10, x: 10, y: 10 }], viewport, [{ height: 5, width: 5, x: 12, y: 12 }])).toBe(false);
  });

  it("picks the first curve that fits, labels main rivers from the operational zoom, and yields to obstacles", () => {
    const map = waterMap(
      [river("ebro", "main", { label: { length: 200, path: straight, points: [{ x: 0, y: 100 }, { x: 200, y: 100 }] } }), river("sil", "tributary")],
      [
        { paths: ["M0 5l200 0", "M0 150l200 0"], text: "Mar", tier: "overview" },
        { text: "Bay", tier: "detail", x: 100, y: 60 }
      ]
    );
    const view = { level: "overview" as const, obstacles: [], scale: 1, toScreen: identity, viewport: { height: 200, width: 200 } };
    const overview = visibleWater(map, view);
    expect(overview.labels.map(({ curve, label }) => [label.text, curve?.path])).toEqual([["Mar", "M0 150l200 0"]]);
    expect(overview.riverLabels).toEqual([]);
    const detail = visibleWater(map, { ...view, level: "detail" });
    expect(detail.labels.map(({ label }) => label.text)).toEqual(["Mar", "Bay"]);
    expect(detail.riverLabels.map((entry) => entry.id)).toEqual(["ebro"]);
    const blocked = visibleWater(map, { ...view, level: "detail", obstacles: [{ height: 40, width: 200, x: 0, y: 40 }, { height: 20, width: 200, x: 0, y: 85 }] });
    expect(blocked.labels.map(({ label }) => label.text)).toEqual(["Mar"]);
    expect(blocked.riverLabels).toEqual([]);
  });
});

describe("water layer (R1, R2, R5)", () => {
  const rivers = [river("ebro", "main", { mouth: "M200 100l5 0" }), river("sil", "tributary")];

  it("draws main rivers at every zoom and tributaries from the operational zoom, under main rivers", () => {
    const overview = render(<svg><RiverLayer level="overview" rivers={rivers} unit={2} /></svg>);
    expect([...overview.container.querySelectorAll("[data-river-id]")].map((element) => element.getAttribute("data-river-id"))).toEqual(["ebro"]);
    const operational = render(<svg><RiverLayer level="operational" rivers={rivers} unit={2} /></svg>);
    expect([...operational.container.querySelectorAll("[data-river-id]")].map((element) => element.getAttribute("data-river-id"))).toEqual(["sil", "ebro"]);
    expect(operational.container.querySelector(".map-rivers")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("sizes strokes in screen pixels and tapers a mouth into the sea", () => {
    const { container } = render(<svg><RiverLayer level="detail" rivers={rivers} unit={0.5} /></svg>);
    const ebro = container.querySelector('[data-river-id="ebro"]');
    expect(ebro?.querySelector(".map-river-water")?.getAttribute("stroke-width")).toBe("1.2");
    const mouth = [...(ebro?.querySelectorAll(".map-river-water.map-river-mouth") ?? [])];
    expect(mouth).toHaveLength(mouthTaper.length);
    expect(mouth.map((path) => Number(path.getAttribute("stroke-width")))).toEqual([...mouthTaper.map((step) => 1.2 * step.width)]);
    expect(mouth.map((path) => path.getAttribute("stroke-dasharray"))).toEqual(mouthTaper.map((step) => `${String(step.reach)} 2`));
    expect(container.querySelectorAll('[data-river-id="sil"] .map-river-mouth')).toHaveLength(0);
  });

  it("sets curved names on their own curves and straight names at their points", () => {
    const curve = { length: 200, path: straight, points: [{ x: 0, y: 100 }, { x: 200, y: 100 }] };
    const { container } = render(
      <svg>
        <WaterLabelLayer
          unit={2}
          water={{
            labels: [
              { curve, label: { curves: [curve], kind: "curve", text: "Mar Balear", tier: "overview" }, letterSpacing: 3 },
              { label: { kind: "point", text: "Bah\u00eda de Palma", tier: "detail", x: 5, y: 6 }, letterSpacing: waterLabelType.detail.letterSpacing }
            ],
            riverLabels: [{ ...river("ebro", "main"), label: curve }]
          }}
        />
      </svg>
    );
    const paths = [...container.querySelectorAll("textPath")];
    expect(paths.map((path) => path.textContent)).toEqual(["MAR BALEAR", "R\u00edo ebro"]);
    for (const path of paths) expect(container.querySelector(path.getAttribute("href") ?? "none")?.getAttribute("d")).toBe(straight);
    const sea = container.querySelector(".map-water-overview");
    expect(sea?.getAttribute("letter-spacing")).toBe("6");
    const bay = container.querySelector(".map-water-detail");
    expect([bay?.getAttribute("x"), bay?.getAttribute("y"), bay?.textContent]).toEqual(["5", "6", "Bah\u00eda de Palma"]);
    expect(container.querySelector(".map-river-label tspan")?.getAttribute("dy")).toBe(String(-riverLabelType.lift * 2));
  });
});
