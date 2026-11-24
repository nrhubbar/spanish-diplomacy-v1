import { describe, expect, it } from "vitest";
import {
  type CameraBounds,
  clampCamera,
  initialCamera,
  mapToScreen,
  panCamera,
  screenToMap,
  semanticLevel,
  visibleRect,
  zoomCameraAt
} from "../main/map/camera";
import { idleGesture, pointerDown, pointerMove, pointerUp } from "../main/map/gesture";
import { classifyKeyTarget, mapKeyIntent, shouldHandleMapKey } from "../main/map/keyboard";
import { legendEntries } from "../main/map/MapLegend";
import { paneLayoutFor } from "../main/map/MapPane";
import { paneWidthFor } from "../main/map/paneSize";
import { prepareGeometry, prepareSymbol } from "../main/map/markup";
import { intersects, placeCounters, visibleContextLabels } from "../main/map/placement";
import { groupRoutes, routeCurve } from "../main/map/routes";
import { terrainFrustum, terrainRenderMetrics } from "../main/map/terrainRendering";
import { staticMapView } from "../main/map/view";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { type BattleOutcome, type BouncedMoveOutcome, type GradeId, isMoveOrder } from "../main/engine/types";
import {
  bounceReason,
  controlDescription,
  controllerName,
  describeOutcome,
  describeOutcomeGroup,
  groupOutcomes,
  listNames,
  unitDesignation
} from "../main/presentation/text";
import { turnLabel } from "../main/presentation/turn";
import { faction, move, spain, territory, testRegistry, tiny, tinyId, unit, withUnits } from "./support";
import { pinned } from "./pinned";

const bounds: CameraBounds = { content: { height: 200, width: 200, x: 0, y: 0 }, focus: { height: 100, width: 100, x: 50, y: 50 } };
const viewport = { height: 400, insetBottom: 0, insetRight: 200, width: 600 };

describe("camera", () => {
  it("frames the focus area in the unobscured part of the viewport", () => {
    const camera = initialCamera(viewport, bounds);
    expect(camera.zoom).toBe(1);
    const focusCenter = mapToScreen({ x: 100, y: 100 }, camera, viewport, bounds);
    expect(focusCenter.x).toBeCloseTo((600 - 200) / 2);
    expect(focusCenter.y).toBeCloseTo(200);
    expect(screenToMap(focusCenter, camera, viewport, bounds).x).toBeCloseTo(100);
    const sheet = initialCamera({ height: 400, insetBottom: 100, insetRight: 0, width: 400 }, bounds);
    expect(mapToScreen({ x: 100, y: 100 }, sheet, { height: 400, insetBottom: 100, insetRight: 0, width: 400 }, bounds).y).toBeCloseTo(150);
  });

  it("pans, zooms about a point, and clamps", () => {
    const camera = initialCamera(viewport, bounds);
    expect(panCamera(camera, 40, 0, viewport, bounds).centerX).toBeLessThan(camera.centerX);
    const focus = { x: 120, y: 90 };
    const before = screenToMap(focus, camera, viewport, bounds);
    const zoomed = zoomCameraAt(camera, 2, focus, viewport, bounds);
    expect(zoomed.zoom).toBe(2);
    expect(screenToMap(focus, zoomed, viewport, bounds).x).toBeCloseTo(before.x);
    expect(clampCamera({ centerX: -50, centerY: 999, zoom: 9 }, bounds)).toEqual({ centerX: 0, centerY: 200, zoom: 4 });
    expect(visibleRect({ centerX: 100, centerY: 100, zoom: 1 }, viewport, bounds).width).toBeCloseTo(600 / 4);
  });

  it("names semantic levels", () => {
    expect([1, 1.5, 2.5].map(semanticLevel)).toEqual(["overview", "operational", "detail"]);
  });
});

describe("gestures", () => {
  const camera = { centerX: 100, centerY: 100, zoom: 1 };

  it("treats a small press as a click and a long drag as a pan", () => {
    let state = pointerDown(idleGesture, 1, { x: 10, y: 10 }, camera);
    const still = pointerMove(state, 1, { x: 12, y: 11 }, viewport, bounds);
    expect(still.camera).toBeUndefined();
    const drag = pointerMove(still.state, 1, { x: 60, y: 10 }, viewport, bounds);
    expect(drag.camera?.centerX).toBeLessThan(100);
    state = pointerUp(drag.state, 1, drag.camera ?? camera);
    expect(state.moved).toBe(true);
    expect(pointerMove(idleGesture, 9, { x: 0, y: 0 }, viewport, bounds).camera).toBeUndefined();
  });

  it("pinches to zoom", () => {
    let state = pointerDown(idleGesture, 1, { x: 100, y: 100 }, camera);
    state = pointerDown(state, 2, { x: 200, y: 100 }, camera);
    const pinch = pointerMove(state, 2, { x: 300, y: 100 }, viewport, bounds);
    expect(pinch.camera?.zoom).toBeCloseTo(2);
    const lifted = pointerUp(pinch.state, 2, pinch.camera ?? camera);
    expect(lifted.pointers.size).toBe(1);
    expect(lifted.start?.camera.zoom).toBeCloseTo(2);
  });
});

describe("keyboard (B3)", () => {
  it("maps keys to intents", () => {
    expect(mapKeyIntent("w")).toEqual({ direction: "up", kind: "pan" });
    expect(mapKeyIntent("ArrowRight")).toEqual({ direction: "right", kind: "pan" });
    expect(["+", "-", "0", "Enter", "Escape"].map((key) => mapKeyIntent(key)?.kind)).toEqual(["zoom-in", "zoom-out", "reset", "select", undefined]);
  });

  it("leaves Enter and Space to native controls and every key to editable fields", () => {
    const select = { kind: "select" } as const;
    const pan = { direction: "left", kind: "pan" } as const;
    expect(shouldHandleMapKey(select, "native-control")).toBe(false);
    expect(shouldHandleMapKey(pan, "native-control")).toBe(true);
    expect(shouldHandleMapKey(pan, "editable")).toBe(false);
    expect(shouldHandleMapKey(select, "map")).toBe(true);
    const button = document.createElement("button");
    const input = document.createElement("input");
    const region = document.createElementNS("http://www.w3.org/2000/svg", "path");
    expect([classifyKeyTarget(button), classifyKeyTarget(input), classifyKeyTarget(region), classifyKeyTarget(null)]).toEqual(["native-control", "editable", "map", "map"]);
  });
});

describe("context labels", () => {
  const portugal = { text: "Portugal", x: 100, y: 200 };
  const identity = (point: { readonly x: number; readonly y: number }) => point;
  const viewport = { height: 400, width: 600 };

  it("draws a context label that fits on screen and touches no counter", () => {
    expect(visibleContextLabels([portugal], identity, viewport, [{ height: 24, width: 32, x: 300, y: 300 }])).toEqual([portugal]);
  });

  it("hides a context label the map edge would cut", () => {
    expect(visibleContextLabels([portugal], (point) => ({ ...point, x: point.x - 60 }), viewport, [])).toEqual([]);
    expect(visibleContextLabels([portugal], (point) => ({ ...point, x: point.x + 460 }), viewport, [])).toEqual([]);
    expect(visibleContextLabels([portugal], (point) => ({ ...point, y: 5 }), viewport, [])).toEqual([]);
    expect(visibleContextLabels([portugal], (point) => ({ ...point, y: 401 }), viewport, [])).toEqual([]);
  });

  it("hides a context label a counter would cover, since counters sit at their own places", () => {
    expect(visibleContextLabels([portugal], identity, viewport, [{ height: 24, width: 32, x: 90, y: 180 }])).toEqual([]);
  });
});

describe("counter placement (V3, V4, V7)", () => {
  const metrics = { gap: 2, height: 20, perRow: 2, width: 30 };

  it("stacks units sharing an anchor and wraps rows", () => {
    const positions = placeCounters(["a", "b", "c"].map((id) => ({ anchor: { x: 100, y: 100 }, anchorKey: "k", id })), metrics, []);
    expect(positions.get("a")?.y).toBe(positions.get("b")?.y);
    expect(positions.get("c")?.y).toBeGreaterThan(positions.get("a")?.y ?? 0);
  });

  it("moves a stack off obstacles and other stacks", () => {
    const label = { height: 30, width: 200, x: 0, y: 100 };
    const positions = placeCounters([
      { anchor: { x: 100, y: 100 }, anchorKey: "one", id: "a" },
      { anchor: { x: 100, y: 100 }, anchorKey: "two", id: "b" }
    ], metrics, [label]);
    const a = positions.get("a");
    const b = positions.get("b");
    expect(intersects({ height: 20, width: 30, x: a?.x ?? 0, y: a?.y ?? 0 }, label)).toBe(false);
    expect(intersects({ height: 20, width: 30, x: a?.x ?? 0, y: a?.y ?? 0 }, { height: 20, width: 30, x: b?.x ?? 0, y: b?.y ?? 0 })).toBe(false);
  });

  it("reaches further out on a crowded front, and covers as little as it can when nothing is free", () => {
    // Everything within two stack widths of the anchor is taken; three widths out is free.
    const crowd = { height: 400, width: 120, x: 20, y: -100 };
    const far = placeCounters([{ anchor: { x: 100, y: 100 }, anchorKey: "k", id: "a" }], metrics, [crowd]).get("a");
    expect(intersects({ height: 20, width: 30, x: far?.x ?? 0, y: far?.y ?? 0 }, crowd)).toBe(false);

    // Only a sliver on the right is uncovered: the stack takes the slot overlapping least.
    const walls = [{ height: 400, width: 125, x: 0, y: -100 }, { height: 400, width: 400, x: 140, y: -100 }];
    const squeezed = placeCounters([{ anchor: { x: 100, y: 100 }, anchorKey: "k", id: "a" }], metrics, walls).get("a");
    expect(squeezed?.x).toBeGreaterThan(100);
  });
});

describe("routes (V10)", () => {
  it("groups identical routes and counts them", () => {
    const scenario = tiny();
    const state = withUnits(scenario, [["a", "red", "westfold"], ["b", "red", "westfold"], ["c", "blue", "harbor"]]);
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "a", "westfold", "lowlands"), move("red", "b", "westfold", "lowlands")] }], 1);
    const groups = groupRoutes([move("red", "a", "westfold", "highlands")], result.outcomes);
    expect(groups.map((group) => [group.kind, group.count])).toEqual([["planned", 1], ["moved", 2]]);
  });

  it("gives each faction's route along a shared origin and destination its own lane", () => {
    const groups = groupRoutes([
      move("red", "a", "westfold", "lowlands"),
      move("blue", "b", "westfold", "lowlands"),
      move("red", "c", "westfold", "lowlands"),
      move("blue", "d", "lowlands", "westfold")
    ], []);
    expect(groups.map((group) => [group.factionId, group.from, group.count, group.lane])).toEqual([
      ["red", "westfold", 2, 0],
      ["blue", "westfold", 1, 1],
      ["blue", "lowlands", 1, 0]
    ]);
  });

  it("bows the sea lanes' arcs (order lines follow the links instead, U8)", () => {
    const curve = routeCurve({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(curve.control.y).toBeGreaterThan(0);
    expect(curve.end).toEqual({ x: 100, y: 0 });
  });
});

describe("markup and rendering helpers", () => {
  it("parses geometry once into focusable territories and outline copies (B14)", () => {
    const { map } = testRegistry().require(tinyId);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><metadata>x</metadata><script>alert(1)</script><path id="tf-harbor" onclick="evil()" d="M0 0 L1 1"/><path id="tf-westfold" d="M0 0"/><path id="context" d="M0 0"/></svg>';
    const prepared = prepareGeometry(svg, map, (id) => `Name ${id}`);
    expect(prepared.markup).toContain('data-territory-id="harbor"');
    expect(prepared.markup).toContain('aria-label="Name harbor"');
    expect(prepared.markup).not.toContain("script");
    expect(prepared.markup).not.toContain("onclick");
    expect(prepared.markup).not.toContain("metadata");
    expect(prepared.outlines.get("harbor" as never)).not.toContain("id=");
  });

  it("recolors unit symbols", () => {
    const symbol = prepareSymbol('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><path id="Friendly Fill" d="M0 0"/></svg>', "#123456");
    expect(symbol).toContain("fill:#123456");
    expect(symbol).toContain('viewBox="0 0 600 400"');
    expect(symbol).not.toContain("id=");
  });

  it("sizes terrain from the layout box and mirrors the camera", () => {
    expect(terrainRenderMetrics(0, 300.4, 3, 16)).toEqual({ anisotropy: 8, height: 300, pixelRatio: 2, width: 1 });
    expect(terrainFrustum({ height: 10, width: 20, x: 5, y: 7 })).toEqual({ bottom: -17, left: 5, right: 25, top: -7 });
  });

  it("chooses the pane layout from the map width", () => {
    expect(paneLayoutFor(600)).toBe("sheet");
    expect(paneLayoutFor(1200)).toBe("side");
    expect([paneWidthFor(500), paneWidthFor(1200), paneWidthFor(3000)]).toEqual([300, 360, 416]);
  });

  it("builds legend entries from what is shown (V9)", () => {
    const scenario = pinned(spain());
    const state = initialGameState(scenario);
    // m11: Spain has rail on the board from the start.
    expect(legendEntries(scenario, state, staticMapView)).toEqual(["contested", "sea", "rail"]);
    // Equal attacks meeting head-on bounce without a battle (M20); Spain's shared territories
    // also fight their standing battles (M27), so their results join the legend.
    const result = resolveTurn(scenario, state, [
      { factionId: faction("republic"), orders: [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon")] },
      { factionId: faction("north"), orders: [move("north", "north-san-marcial-22", "castilla-y-leon", "madrid")] }
    ], 1);
    expect(legendEntries(scenario, state, { ...staticMapView, outcomes: result.outcomes, plannedOrders: result.submittedOrders.filter(isMoveOrder) })).toEqual(["contested", "sea", "planned", "bounced", "attacker-eliminated", "both-demoralized", "defender-demoralized", "defender-exchange", "rail"]);
  });
});

describe("player-facing text", () => {
  it("formats outcomes, causes, labels, and designations", () => {
    const scenario = tiny();
    // Red Guard and Blue Marines both attack at 4, so they meet head-on and bounce (M20).
    const state = withUnits(scenario, [["red-guard", "red", "highlands"], ["blue-marines", "blue", "harbor"], ["red-rangers", "red", "westfold"]]);
    const result = resolveTurn(scenario, state, [
      { factionId: faction("red"), orders: [move("red", "red-guard", "highlands", "harbor"), move("red", "red-rangers", "westfold", "isle")] },
      { factionId: faction("blue"), orders: [move("blue", "blue-marines", "harbor", "highlands")] }
    ], 1);
    const text = result.outcomes.map((outcome) => describeOutcome(scenario, outcome)).join(" | ");
    expect(text).toContain("met Blue Union head-on");
    expect(text).toContain("impossible order");
    expect(describeOutcome(scenario, { factionId: faction("red"), kind: "no-move" })).toContain("no units");
    expect(describeOutcome(scenario, { factionId: faction("red"), kind: "no-move", unitId: "red-guard" as never })).toBe("Red Guard held.");
    expect(bounceReason(scenario, { holdingFactionIds: [faction("blue")], kind: "held" })).toBe("held by Blue Union");
    expect(bounceReason(scenario, { kind: "standoff", opposingFactionIds: [faction("blue"), faction("red")] })).toBe("standoff with Blue Union and Red League");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
    expect(turnLabel(scenario, 1)).toContain("Day 1");
    expect(turnLabel(scenario, 2)).toBe("Turn 2");
    expect(controlDescription(scenario, undefined)).toBe("Uncontrolled");
    expect(controlDescription(scenario, { factionIds: [faction("red"), faction("blue")], kind: "contested" })).toBe("Contested by Red League and Blue Union");
    expect(controllerName(scenario, { factionIds: [], kind: "contested" })).toBe("Contested");
    expect(unitDesignation("Wad-Ras Infantry Regiment No. 1")).toBe("WR1");
    expect(unitDesignation("Asturian Workers Militia")).toBe("AWM");
    // Accented letters belong to their word, so "Arag\u00f3n" is one word, not "Arag" and "n".
    expect(unitDesignation("Arag\u00f3n Infantry Regiment No. 17")).toBe("A17");
    expect(unitDesignation("San Quint\u00edn Infantry Regiment No. 25")).toBe("SQ25");
  });

  it("describes a disbanded move", () => {
    const scenario = tiny();
    const text = describeOutcome(scenario, {
      capturedByFactionId: faction("blue"),
      cause: { holdingFactionIds: [faction("blue")], kind: "held" },
      kind: "disbanded-move",
      men: 500,
      order: move("red", "red-rangers", "highlands", "harbor")
    });
    expect(text).toBe("Red League: Red Rangers was lost. It tried to move from Highlands to Harbor and bounced: held by Blue Union. Blue Union took Highlands.");
  });

  it("gives one-line headlines for battles and unit statuses", () => {
    const scenario = tiny();
    const army = (unitId: string, factionId: string, from: string, value: number) =>
      ({ demoralized: false, factionId: faction(factionId), from: territory(from), fullMen: 700, men: 700, unitId: unit(unitId), value });
    const battle: BattleOutcome = {
      attacker: { armies: [army("red-guard", "red", "westfold", 4), army("red-rangers", "red", "highlands", 3)], value: 7 },
      attackerFactionId: faction("red"),
      column: 1,
      defender: { armies: [army("blue-marines", "blue", "harbor", 5)], value: 5 },
      demoralizedUnitIds: [],
      die: 12,
      grade: "stalemate" as GradeId,
      ground: 0,
      kind: "battle",
      losses: [],
      modifiers: [],
      oddsLabel: "1:1",
      retreats: [],
      score: 12,
      site: { kind: "assault", occupation: { kind: "held" }, territoryId: territory("harbor") },
      surrenderedUnitIds: []
    };
    expect(describeOutcome(scenario, battle)).toBe("Battle for Harbor: Stalemate.");
    expect(describeOutcome(scenario, { ...battle, site: { between: [territory("harbor"), territory("highlands")], kind: "meeting" } }))
      .toBe("Battle on the road between Harbor and Highlands: Stalemate.");
    expect(groupOutcomes([battle])[0]?.unitIds).toEqual(["red-guard", "red-rangers", "blue-marines"]);
    const bounced: BouncedMoveOutcome = {
      cause: { holdingFactionIds: [faction("blue")], kind: "held" },
      kind: "bounced-move",
      order: move("red", "red-rangers", "highlands", "harbor"),
      retreatedTo: territory("westfold")
    };
    expect(describeOutcome(scenario, bounced)).toBe("Red League: Red Rangers tried to move from Highlands to Harbor and bounced: held by Blue Union. It fell back to Westfold.");
    expect(describeOutcomeGroup(scenario, { outcome: bounced, unitIds: [unit("red-rangers"), unit("red-guard")] })).toContain("They fell back to Westfold.");
    expect(describeOutcome(scenario, { factionId: faction("red"), kind: "recovered", territoryId: territory("westfold"), unitId: unit("red-guard") }))
      .toBe("Red Guard recovered its morale in Westfold.");
    expect(describeOutcome(scenario, { kind: "reinforcement-arrived", order: move("red", "red-rangers", "highlands", "westfold") }))
      .toBe("Red League: Red Rangers moved from Highlands to Westfold as reinforcements.");
  });
});
