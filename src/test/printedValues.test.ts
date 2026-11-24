import { describe, expect, it } from "vitest";
import { fightingSide } from "../main/engine/d20/modifiers";
import { initialGameState } from "../main/engine/resolution";
import type { CombatRole } from "../main/engine/types";
import { armyFigures, groupFigures, printedValue, valuesLabel } from "../main/presentation/army";
import { shippedRegistry, spainId } from "./support";

describe("printed values (D7: zero stays 0)", () => {
  const { scenario } = shippedRegistry().require(spainId);
  const state = initialGameState(scenario);
  const units = Object.values(state.units);

  it("prints what each unit would count for in a battle", () => {
    for (const unit of units) {
      const counted = (role: CombatRole) => fightingSide(scenario, state, [{ from: unit.territoryId, unit }], role).value;
      expect([unit.id, printedValue(scenario, unit, "attack"), printedValue(scenario, unit, "defence")]).toEqual([unit.id, counted("attack"), counted("defence")]);
    }
  });

  it("prints 0-0 for a general and 0-1 for aircraft, not struck through", () => {
    const kindOf = (id: string) => scenario.index.unitTypes.get(scenario.index.units.get(units.find((unit) => unit.id === id)!.id)!.type)?.kind;
    const general = units.find((unit) => kindOf(unit.id) === "general")!;
    const figures = armyFigures(scenario, state, general);
    expect([valuesLabel(figures.attack, figures.defence), figures.reduced]).toEqual(["0-0", false]);
    const aircraft = units.filter((unit) => kindOf(unit.id) === "air");
    expect(aircraft.length).toBeGreaterThan(1);
    expect(aircraft.map((unit) => armyFigures(scenario, state, unit)).map(({ attack, defence, reduced }) => [attack, defence, reduced])).toEqual(aircraft.map(() => [0, 1, false]));
    expect(groupFigures(scenario, state, aircraft.slice(0, 2))).toMatchObject({ attack: 0, defence: 2 });
  });

  it("keeps a weak unit's value at 1", () => {
    const weak = { ...units.find((unit) => unit.id === "rep-wad-ras-1")!, strength: 1 };
    expect(printedValue(scenario, weak, "attack")).toBe(1);
  });
});
