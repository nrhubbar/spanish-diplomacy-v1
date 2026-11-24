import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { initialGameState } from "../../main/engine/resolution";
import type { BattleOutcome, GameState, GradeId, Scenario, SubTerritoryId, TurnOutcome, UnitTypeId } from "../../main/engine/types";
import { legendEntries, MapLegend } from "../../main/map/MapLegend";
import { type MapView, staticMapView } from "../../main/map/view";
import {
  capitalLabel,
  factionLabel,
  listNames,
  plural,
  subTerritoryLabel,
  territoryLabel,
  typeLabel,
  unitLabel,
  unitsLabel
} from "../../main/presentation/systemText/lines";
import { madridRepulsed } from "../battleFixtures";
import { faction, move, spain, spainWithAir, territory, tiny, unit } from "../support";

afterEach(cleanup);

const entryTexts = (): readonly string[] => within(screen.getByRole("list")).getAllByRole("listitem").map((entry) => entry.textContent.replace(/\s+/gu, " ").trim());

describe("the map legend (V9)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  it("lists the factions on the map, the army counter, and what the board shows", () => {
    const { container } = render(<MapLegend game={start} scenario={scenario} view={staticMapView} />);
    expect(container.querySelector("details.map-legend summary")?.textContent).toBe("Legend");
    const texts = entryTexts();
    for (const name of scenario.factions.map((entry) => entry.name)) expect(texts).toContain(name);
    expect(texts.some((text) => /attack-defence, men as a bar$/u.test(text))).toBe(true);
    expect(texts).toContain("Contested");
    expect(texts).toContain("Sea crossing");
    expect(texts.some((text) => text.startsWith("Possible destination"))).toBe(false);
  });

  it("adds destinations, planned and completed moves, bounces, losses, battles, demoralized armies and works", () => {
    const shaken = start.units[unit("rep-wad-ras-1")]!;
    const game: GameState = {
      ...start,
      fortification: { [territory("madrid")]: { factionId: faction("republic"), level: 2 } },
      units: { ...start.units, [shaken.id]: { ...shaken, morale: { demoralized: true, quietTurns: 0 } } }
    };
    const order = move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha");
    const outcomes = [
      { kind: "successful-move", order },
      { kind: "bounced-move", order },
      { kind: "disbanded-move", men: 500, order },
      madridRepulsed
    ] as unknown as readonly TurnOutcome[];
    const view: MapView = { ...staticMapView, destinationIds: [territory("castilla-la-mancha")], outcomes, plannedOrders: [order] };
    const { container } = render(<MapLegend game={game} scenario={scenario} view={view} />);
    const texts = entryTexts();
    expect(texts).toEqual(expect.arrayContaining(["Possible destination", "Planned move", "Completed move", "Bounced move", "Demoralized: half values, cannot attack", "Dug in: one pip per level of works"]));
    expect(texts.some((text) => /^(Army|Units?) lost or surrendered$/u.test(text))).toBe(true);
    expect(texts.some((text) => text.startsWith("Battle: "))).toBe(true);
    expect(container.querySelectorAll(".legend-medallion").length).toBeGreaterThan(0);
    expect(container.querySelector(".legend-icon:not(.legend-medallion)")).not.toBeNull();
    expect(container.querySelector(".legend-swatch.legend-planned")).not.toBeNull();
  });

  it("shows the odds wording once estimates are at hand, and a reinforcement as a completed move", () => {
    const order = move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha");
    const view: MapView = { ...staticMapView, destinationEstimates: new Map(), destinationIds: [territory("madrid")], outcomes: [{ kind: "reinforcement-arrived", order } as unknown as TurnOutcome] };
    expect(legendEntries(scenario, start, view)).toEqual(expect.arrayContaining(["destination-odds", "moved"]));
  });

  it("keys a d20 battle by its grade's family", () => {
    const d20 = spainWithAir();
    const battle: BattleOutcome = {
      ...madridRepulsed,
      die: 18,
      grade: "defender-destroyed" as GradeId,
      ground: "all",
      score: 20
    } as unknown as BattleOutcome;
    expect(legendEntries(d20, initialGameState(d20), { ...staticMapView, outcomes: [battle] })).toContain("defender-eliminated");
  });

  it("leaves out what the map lacks: armies, contested ground, the sea", () => {
    const board = tiny();
    const startTiny = initialGameState(board);
    const settled = Object.fromEntries(Object.entries(startTiny.control).map(([id, control]) => [id, control.kind === "contested" ? { factionId: control.factionIds[0]!, kind: "controlled" as const } : control])) as GameState["control"];
    const empty: GameState = { ...startTiny, control: settled, units: {} };
    render(<MapLegend game={empty} scenario={{ ...board, connections: board.connections.filter((connection) => connection.kind !== "sea") }} view={staticMapView} />);
    const texts = entryTexts();
    expect(texts.some((text) => /attack-defence/u.test(text))).toBe(false);
    expect(texts).not.toContain("Sea crossing");
    expect(texts).not.toContain("Contested");
  });
});

describe("report-line helpers", () => {
  const scenario = spain();

  it("lists names in prose", () => {
    expect(listNames([])).toBe("");
    expect(listNames(["A"])).toBe("A");
    expect(listNames(["A", "B"])).toBe("A and B");
    expect(listNames(["A", "B", "C"])).toBe("A, B and C");
  });

  it("names factions, territories, sub-territories and types, or falls back to the id", () => {
    expect(factionLabel(scenario, faction("republic"))).toMatch(/Republic/u);
    expect(factionLabel(scenario, faction("nobody"))).toBe("nobody");
    expect(territoryLabel(scenario, territory("madrid"))).toBe("Madrid");
    expect(territoryLabel(scenario, territory("atlantis"))).toBe("atlantis");
    expect(subTerritoryLabel(scenario, "henares" as SubTerritoryId)).toBe("Henares");
    expect(subTerritoryLabel(scenario, "atlantis" as SubTerritoryId)).toBe("atlantis");
    expect(typeLabel(scenario, "militia-column" as UnitTypeId)).toBe("Militia column");
    expect(typeLabel(scenario, "dragon" as UnitTypeId)).toBe("dragon");
  });

  it("names where a territory recruits: its capital, else the territory", () => {
    expect(capitalLabel(scenario, territory("catalunya"))).toBe("Barcelona");
    const noCapital: Scenario = {
      ...scenario,
      index: {
        ...scenario.index,
        territories: new Map([...scenario.index.territories].map(([id, entry]) => {
          if (id !== territory("catalunya")) return [id, entry];
          const copy = { ...entry };
          delete (copy as { capitalSubTerritoryId?: unknown }).capitalSubTerritoryId;
          return [id, copy];
        }))
      }
    };
    expect(capitalLabel(noCapital, territory("catalunya"))).toBe(scenario.index.territories.get(territory("catalunya"))?.name);
  });

  it("names scenario and recruited units, and counts in words", () => {
    const recruited = raisedUnitId(faction("republic"), "militia-column" as UnitTypeId, 2);
    expect(unitLabel(scenario, recruited)).toBe("Militia column No. 2");
    expect(unitsLabel(scenario, [unit("rep-wad-ras-1"), recruited])).toMatch(/^.+ and Militia column No\. 2$/u);
    expect(plural(1, "unit", "units")).toBe("unit");
    expect(plural(0, "unit", "units")).toBe("units");
    expect(plural(3, "unit", "units")).toBe("units");
  });
});
