import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorksBadge } from "../../main/map/WorksBadge";
import { armyFigures, dugInLabel, figuresDugInLabel, figuresWorks } from "../../main/presentation/army";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, TerritoryId } from "../../main/engine/types";
import { spainD20, unit } from "../support";

/**
 * m3r2-probe, note 12, as R8 settles it: the d20 works are stored as pips (1 to 3), and each pip
 * takes 2 off the attacker's roll. Copied from branch `m3r2-probe`, where it recorded the old
 * behaviour (the roll stored as the level: six pips and "Dug in +6" after two quiet turns).
 */
afterEach(cleanup);

describe("note 12: the d20 works badge", () => {
  it("stores pips, so two quiet turns show two filled pips of three and 'Dug in level 2 (+4)'", () => {
    const scenario = spainD20();
    const start = initialGameState(scenario);
    const madrid = "madrid" as TerritoryId;
    const level = 2 * scenario.combat.diggingIn.perTurn;
    const state: GameState = { ...start, fortification: { ...start.fortification, [madrid]: { factionId: start.units[unit("rep-wad-ras-1")]!.factionId, level } } };
    const figures = armyFigures(scenario, state, state.units[unit("rep-wad-ras-1")]!);
    expect(figures.dugIn).toBe(2);
    expect(figures.dugInRoll).toBe(4);
    expect(dugInLabel(figures.dugIn!, figures.dugInRoll!)).toBe("Dug in level 2 (+4)");
    const { container } = render(<WorksBadge level={figures.dugIn!} max={scenario.combat.diggingIn.max} />);
    const circles = [...container.querySelectorAll("circle")];
    expect(circles).toHaveLength(3);
    expect(circles.filter((circle) => circle.getAttribute("fill") !== "none")).toHaveLength(2);
  });
});

describe("works in words (R8)", () => {
  it("labels the figures' works, reading a pip as 1 when the roll is unknown, and nothing without works", () => {
    const scenario = spainD20();
    const state = initialGameState(scenario);
    const figures = armyFigures(scenario, state, state.units[unit("rep-wad-ras-1")]!);
    expect(figuresWorks(figures)).toBeUndefined();
    expect(figuresDugInLabel(figures)).toBe("");
    expect(figuresWorks({ ...figures, dugIn: 2 })).toEqual({ dugIn: 2, dugInRoll: 2 });
    expect(figuresDugInLabel({ ...figures, dugIn: 3, dugInRoll: 6 })).toBe("Dug in level 3 (+6)");
  });
});
