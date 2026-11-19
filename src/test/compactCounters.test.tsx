import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialGameState } from "../main/engine/resolution";
import type { GameState } from "../main/engine/types";
import { CounterLayer, compactMetrics, counterMetrics, crowdedDisplacement, individualCountersFromZoom, layoutCounters } from "../main/map/CounterLayer";
import { armyItems, groupedItems, itemTerritory } from "../main/map/counterItems";
import { placeCounterStacks } from "../main/map/placement";
import { staticMapView } from "../main/map/view";
import { groupFigures, groupLabel } from "../main/presentation/army";
import { armyIn, faction, spain, spainId, territory, testRegistry } from "./support";

const spainMap = () => testRegistry().require(spainId).map;
/** A phone-sized overview: the whole map squeezed into a few hundred pixels. */
const squeeze = (point: { readonly x: number; readonly y: number }) => ({ x: point.x * 0.35, y: point.y * 0.35 });
const spread = (point: { readonly x: number; readonly y: number }) => ({ x: point.x * 3, y: point.y * 3 });

function shakenCovadonga(): GameState {
  const base = initialGameState(spain());
  const covadonga = armyIn(base, "rep-covadonga-4");
  return {
    ...base,
    fortification: { [territory("madrid")]: { factionId: faction("republic"), level: 2 } },
    units: { ...base.units, [covadonga.id]: { ...covadonga, morale: { demoralized: true, quietTurns: 0 } } }
  };
}

describe("compact counters", () => {
  afterEach(cleanup);

  it("groups each faction's armies in a territory, keeping lone armies and the selected territory individual", () => {
    const game = initialGameState(spain());
    const items = groupedItems(game, territory("catalunya"));
    const madrid = items.find((item) => item.key === "group:madrid:republic");
    expect(madrid?.kind === "group" ? madrid.units.map((unit) => unit.id) : []).toEqual([
      "rep-wad-ras-1", "rep-covadonga-4", "rep-madrid-security", "rep-madrid-sierra-column"
    ]);
    expect(items.filter((item) => itemTerritory(item) === "catalunya").map((item) => item.kind)).toEqual(["army", "army", "army"]);
    expect(items.find((item) => itemTerritory(item) === "galicia")?.kind).toBe("army");
    expect(items.filter((item) => itemTerritory(item) === "asturias").map((item) => item.key)).toEqual(["rep-asturian-militia", "group:asturias:north"]);
    expect(armyItems(game)).toHaveLength(Object.keys(game.units).length);
  });

  it("sums a group's values and men and names it in words", () => {
    const game = shakenCovadonga();
    const madrid = Object.values(game.units).filter((unit) => unit.territoryId === "madrid");
    const figures = groupFigures(spain(), game, madrid);
    expect(figures).toMatchObject({ attack: 12, count: 4, defence: 18, demoralizedCount: 1, dugIn: 2, fullAttack: 14, reduced: true, strength: 9100 });
    expect(groupLabel("Republican Government", "Madrid", figures))
      .toBe("Republican Government, 4 armies in Madrid, combined attack 12, defence 18, 9100 of 9100 men, 1 demoralized, dug in +2");
  });

  it("is compact on a phone's overview, stays individual at the detail zoom, and reacts to crowding", () => {
    const game = initialGameState(spain());
    const map = spainMap();
    const narrow = layoutCounters(game, map, 1.25, squeeze, [], { narrow: true });
    expect(narrow.compact).toBe(true);
    expect(narrow.metrics).toBe(compactMetrics.overview);
    expect(narrow.items.length).toBeLessThan(Object.keys(game.units).length);
    expect(narrow.positions.size).toBe(narrow.items.length);
    expect(layoutCounters(game, map, 2.1, squeeze, [], { narrow: true }).compact).toBe(false);
    const roomy = layoutCounters(game, map, 1.25, spread, [], { narrow: false });
    expect(roomy.compact).toBe(false);
    expect(roomy.metrics).toBe(counterMetrics.overview);
    expect(layoutCounters(game, map, 1.45, squeeze, [], { narrow: false }).compact).toBe(true);
    const expanded = layoutCounters(game, map, 1.25, squeeze, [], { expandedTerritoryId: territory("madrid"), narrow: true });
    expect(expanded.items.filter((item) => itemTerritory(item) === "madrid").every((item) => item.kind === "army")).toBe(true);
  });

  it("sums every stack below 125% zoom and keeps today's rules from there (Z1)", () => {
    const game = initialGameState(spain());
    const map = spainMap();
    const armies = Object.keys(game.units).length;
    const at = (zoom: number) => layoutCounters(game, map, zoom, spread, [], { narrow: false });
    expect(individualCountersFromZoom).toBe(1.25);
    for (const zoom of [1, 1.24]) {
      const summed = at(zoom);
      expect(summed.compact).toBe(true);
      expect(summed.metrics).toBe(compactMetrics.overview);
      expect(summed.items).toEqual(groupedItems(game, undefined));
      expect(summed.items.length).toBeLessThan(armies);
    }
    // With room to spare, 125% and the operational level show every army one by one.
    for (const [zoom, metrics] of [[1.25, counterMetrics.overview], [1.45, counterMetrics.operational]] as const) {
      const individual = at(zoom);
      expect(individual.compact).toBe(false);
      expect(individual.metrics).toBe(metrics);
      expect(individual.items).toHaveLength(armies);
    }
  });

  it("splits the expanded territory into armies below 125% zoom (Z2)", () => {
    const game = initialGameState(spain());
    const layout = layoutCounters(game, spainMap(), 1, spread, [], { expandedTerritoryId: territory("madrid"), narrow: false });
    expect(layout.compact).toBe(true);
    const madrid = layout.items.filter((item) => itemTerritory(item) === "madrid");
    expect(madrid.map((item) => item.kind)).toEqual(["army", "army", "army", "army"]);
    expect(layout.items.find((item) => item.key === "group:asturias:north")?.kind).toBe("group");
  });

  it("measures how far crowding pushes a stack", () => {
    const metrics = counterMetrics.overview;
    const free = placeCounterStacks([{ anchor: { x: 100, y: 100 }, anchorKey: "a", id: "a" }], metrics, []);
    expect(free.maxDisplacement).toBe(0);
    // A label just under the anchor pushes the stack one step down.
    const nudged = placeCounterStacks([{ anchor: { x: 100, y: 100 }, anchorKey: "a", id: "a" }], metrics, [{ height: 10, width: 32, x: 84, y: 104 }]);
    expect(nudged.maxDisplacement).toBe(metrics.height / 2 + metrics.gap);
    expect(nudged.maxDisplacement).toBeLessThan(crowdedDisplacement(metrics));
  });

  it("draws a group with its total, count, and badges, and opens it by selecting the territory", async () => {
    const game = shakenCovadonga();
    const layout = layoutCounters(game, spainMap(), 1, squeeze, [], { narrow: true });
    const onSelectTerritory = vi.fn();
    const ordered = Object.values(game.units).filter((unit) => unit.territoryId === "madrid").map((unit) => unit.id);
    render(
      <CounterLayer
        game={game}
        layout={layout}
        level="overview"
        scenario={spain()}
        unitSymbols={new Map()}
        view={{ ...staticMapView, onSelectTerritory, orderedUnitIds: new Set(ordered), unitOrders: new Map(ordered.map((id) => [id, "move"])) }}
      />
    );
    const group = screen.getByRole("button", { name: /^Republican Government, 4 armies in Madrid/ });
    expect(group).toHaveAccessibleName(/1 demoralized, dug in \+2, 4 moving$/);
    expect(group).toHaveAttribute("data-ordered", "true");
    expect(group.querySelector(".unit-counter-current")?.textContent).toBe("12-18");
    expect(group.querySelector(".unit-counter-count")?.textContent).toBe("\u00d74");
    expect(group.querySelector(".unit-counter-works")).not.toBeNull();
    await userEvent.setup().click(group);
    expect(onSelectTerritory).toHaveBeenCalledWith("madrid");
    cleanup();
    render(<CounterLayer game={game} layout={layout} level="overview" scenario={spain()} unitSymbols={new Map()} view={staticMapView} />);
    expect(screen.getByRole("button", { hidden: true, name: /4 armies in Madrid/ })).toHaveAttribute("tabindex", "-1");
  });
});
