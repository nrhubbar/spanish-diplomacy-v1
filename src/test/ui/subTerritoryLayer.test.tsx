import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, SubTerritoryId } from "../../main/engine/types";
import type { MapLayerProps } from "../../main/map/layers/slots";
import { SubTerritoryLayer, SubTerritoryWash, subTerritoryAt } from "../../main/map/layers/SubTerritoryLayer";
import { type MapView, staticMapView } from "../../main/map/view";
import type { ScenarioPackage } from "../../main/scenarios/loader";
import { spainId, spainM2, testRegistry } from "../support";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const toScreen = (point: { readonly x: number; readonly y: number }) => ({ x: point.x * 2 + 10, y: point.y * 2 + 5 });
const spainPackage = (): ScenarioPackage => testRegistry().require(spainId);

type Layer = typeof SubTerritoryWash;

function renderLayer(Component: Layer, props: Partial<MapLayerProps> = {}) {
  const scenarioPackage = props.scenarioPackage ?? spainPackage();
  const game = props.game ?? initialGameState(scenarioPackage.scenario);
  const view: MapView = props.view ?? staticMapView;
  const { container } = render(
    <svg>
      <Component game={game} level={props.level ?? "overview"} scenarioPackage={scenarioPackage} toScreen={toScreen} unitSymbols={new Map()} view={view} />
    </svg>
  );
  return container;
}

describe("the sub-territory wash (X2)", () => {
  it("washes the provinces of contested territories in their holders' colours, under the camera's transform", async () => {
    const container = renderLayer(SubTerritoryWash);
    await waitFor(() => { expect(container.querySelector(".sub-territory-wash")).not.toBeNull(); });
    const layer = container.querySelector(".sub-territory-wash");
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer?.querySelector("g[transform]")).toHaveAttribute("transform", "translate(10 5) scale(2)");
    expect(layer?.querySelector("pattern")).toHaveAttribute("patternTransform", "scale(0.5) rotate(45)");
    const sevilla = layer?.querySelector("[data-sub-territory-id='sevilla']");
    expect(sevilla?.tagName.toLowerCase()).toBe("g");
    expect(sevilla).toHaveAttribute("data-holder");
    expect(sevilla?.querySelector(".sub-territory-fill")?.getAttribute("fill")).toMatch(/^#/u);
    expect(sevilla?.querySelector(".sub-territory-hatch")).toHaveAttribute("fill", "url(#sub-territory-hatch)");
    // At the overview, uncontested provinces are not drawn at all.
    expect(layer?.querySelector("[data-sub-territory-id='madrid']")).toBeNull();
    expect(layer?.querySelector(".sub-territory-hit")).toBeNull();
  });

  it("makes every other province hit-testable when zoomed in", async () => {
    const container = renderLayer(SubTerritoryWash, { level: "operational" });
    await waitFor(() => { expect(container.querySelector(".sub-territory-hit")).not.toBeNull(); });
    const madrid = container.querySelector("[data-sub-territory-id='madrid']");
    expect(madrid).toHaveClass("sub-territory-hit");
    expect(container.querySelector("g[data-sub-territory-id='sevilla']")).not.toBeNull();
  });

  it("washes a province with no holder in parchment", async () => {
    const start = initialGameState(spainPackage().scenario);
    const sevilla = start.subTerritories[sub("sevilla")]!;
    const unheld = { ...sevilla };
    delete (unheld as { holder?: unknown }).holder;
    const game: GameState = { ...start, subTerritories: { ...start.subTerritories, [sub("sevilla")]: unheld } };
    const container = renderLayer(SubTerritoryWash, { game });
    await waitFor(() => { expect(container.querySelector("[data-sub-territory-id='sevilla']")).not.toBeNull(); });
    expect(container.querySelector("[data-sub-territory-id='sevilla'] .sub-territory-fill")).toHaveAttribute("fill", "#d8c59d");
    expect(container.querySelector("[data-sub-territory-id='sevilla']")).not.toHaveAttribute("data-holder");
  });

  it("draws nothing at the overview with no contested territory, without partition, or without provinces on the map", () => {
    const start = initialGameState(spainPackage().scenario);
    const settled: GameState = { ...start, control: Object.fromEntries(Object.entries(start.control).map(([id, control]) => [id, control.kind === "contested" ? { factionId: control.factionIds[0]!, kind: "controlled" as const } : control])) };
    expect(renderLayer(SubTerritoryWash, { game: settled }).querySelector(".sub-territory-wash")).toBeNull();
    cleanup();
    const base = spainPackage();
    expect(renderLayer(SubTerritoryWash, { scenarioPackage: { ...base, scenario: spainM2() } }).querySelector(".sub-territory-wash")).toBeNull();
    cleanup();
    const bare = { ...base.map };
    delete (bare as { subTerritories?: unknown }).subTerritories;
    expect(renderLayer(SubTerritoryWash, { level: "detail", scenarioPackage: { ...base, map: bare } }).querySelector(".sub-territory-wash")).toBeNull();
  });
});

describe("sub-territory names, stars and the focus outline (X2, X3)", () => {
  it("shows nothing at the overview without a focused province", () => {
    expect(renderLayer(SubTerritoryLayer).querySelector(".sub-territory-labels")).toBeNull();
  });

  it("names the provinces of contested territories and stars every capital when zoomed in", () => {
    const { scenario } = spainPackage();
    const container = renderLayer(SubTerritoryLayer, { level: "operational" });
    const layer = container.querySelector(".sub-territory-labels");
    expect(layer).not.toBeNull();
    const names = [...container.querySelectorAll(".sub-territory-name")].map((text) => text.textContent);
    expect(names).toContain("C\u00f3rdoba");
    // Uncontested Madrid's provinces are not named.
    expect(names).not.toContain("Henares");
    const stars = container.querySelectorAll(".sub-territory-star");
    expect(stars.length).toBe(scenario.territories.filter((entry) => entry.capitalSubTerritoryId !== undefined).length);
    expect([...stars].every((star) => star.textContent === "\u2605")).toBe(true);
    expect(container.querySelector(".sub-territory-focus-outline")).toBeNull();
  });

  it("stars a capital with a city above the city, and names a capital without one", () => {
    const { map, scenario } = spainPackage();
    const container = renderLayer(SubTerritoryLayer, { level: "detail" });
    const withCity = scenario.subTerritories.find((entry) => entry.cityIds.length > 0 && scenario.index.territories.get(entry.territoryId)?.capitalSubTerritoryId === entry.id);
    expect(withCity).toBeDefined();
    const group = container.querySelector(`[data-sub-territory-label='${withCity!.id}']`);
    const star = toScreen(map.subTerritories!.entries.get(withCity!.id)!.capital);
    expect(group?.querySelector(".sub-territory-star")).toHaveAttribute("y", String(star.y - 7));
    expect(group?.querySelector(".sub-territory-name")).toBeNull();
    const ordinary = container.querySelector("[data-sub-territory-label='cordoba']");
    expect(ordinary?.querySelector(".sub-territory-star")).toBeNull();
    expect(ordinary?.querySelector(".sub-territory-name")).toHaveAttribute("x", String(toScreen(map.subTerritories!.entries.get(sub("cordoba"))!.label).x));
  });

  it("outlines the focused province, and names its territory's provinces", async () => {
    const view: MapView = { ...staticMapView, focusedSubTerritoryId: sub("henares") };
    const container = renderLayer(SubTerritoryLayer, { level: "operational", view });
    await waitFor(() => { expect(container.querySelector(".sub-territory-focus-outline")).not.toBeNull(); });
    expect(container.querySelector(".sub-territory-focus-outline")?.parentElement).toHaveAttribute("transform", "translate(10 5) scale(2)");
    expect([...container.querySelectorAll(".sub-territory-name")].map((text) => text.textContent)).toContain("Henares");
  });

  it("outlines a focused province at the overview without labels", async () => {
    const view: MapView = { ...staticMapView, focusedSubTerritoryId: sub("henares") };
    const container = renderLayer(SubTerritoryLayer, { view });
    await waitFor(() => { expect(container.querySelector(".sub-territory-focus-outline")).not.toBeNull(); });
    expect(container.querySelector(".sub-territory-name")).toBeNull();
    expect(container.querySelector(".sub-territory-star")).toBeNull();
  });

  it("skips provinces the map has no points for", () => {
    const base = spainPackage();
    const entries = new Map([...base.map.subTerritories!.entries].filter(([id]) => id !== sub("cordoba")));
    const map = { ...base.map, subTerritories: { ...base.map.subTerritories!, entries } };
    const container = renderLayer(SubTerritoryLayer, { level: "detail", scenarioPackage: { ...base, map } });
    expect(container.querySelector("[data-sub-territory-label='cordoba']")).toBeNull();
    expect(container.querySelector("[data-sub-territory-label='sevilla']")).not.toBeNull();
  });
});

describe("finding the province under a point (X3)", () => {
  it("finds nothing where the browser cannot hit-test", () => {
    expect(subTerritoryAt(1, 1)).toBeUndefined();
  });

  it("reads the nearest province id under the point", () => {
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hit.setAttribute("data-sub-territory-id", "henares");
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("data-sub-territory-id", "sevilla");
    const inner = document.createElementNS("http://www.w3.org/2000/svg", "path");
    group.append(inner);
    const plain = document.createElement("div");
    const fake = vi.fn<(x: number, y: number) => Element[]>();
    Object.defineProperty(document, "elementsFromPoint", { configurable: true, value: fake });
    try {
      fake.mockReturnValueOnce([plain, hit]);
      expect(subTerritoryAt(3, 4)).toBe("henares");
      expect(fake).toHaveBeenCalledWith(3, 4);
      fake.mockReturnValueOnce([inner]);
      expect(subTerritoryAt(3, 4)).toBe("sevilla");
      fake.mockReturnValueOnce([plain]);
      expect(subTerritoryAt(3, 4)).toBeUndefined();
    } finally {
      delete (document as { elementsFromPoint?: unknown }).elementsFromPoint;
    }
  });
});
