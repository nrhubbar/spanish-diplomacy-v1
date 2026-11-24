import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RollLedger } from "../../main/components/RollLedger";
import type { CombatModifier } from "../../main/engine/types";
import { effectName, rollLedger } from "../../main/presentation/rollLedger";
import { faction, spain, unit } from "../support";

afterEach(cleanup);

const scenario = spain();
const [general] = scenario.generals;
const north = faction("north");

describe("the roll ledger", () => {
  it("names every effect plainly", () => {
    const named = (modifier: CombatModifier): string => effectName(modifier, scenario);
    expect(named({ factionId: north, generalId: general!.id, kind: "general", role: "defence", roll: -1 })).toBe(`${general!.name} commands`);
    expect(named({ factionId: north, generalId: "x" as never, kind: "general", role: "defence", roll: -1 })).toBe("The general commands");
    const trait = scenario.generalTraits.find((each) => each.id === general!.traitId)!;
    expect(named({ generalId: general!.id, kind: "trait", role: "attack", roll: 1, traitId: general!.traitId })).toBe(`${general!.name} is ${trait.name.toLowerCase()}`);
    expect(named({ generalId: "x" as never, kind: "trait", role: "attack", roll: 1, traitId: "x" as never })).toBe("The general is x");
    expect(named({ kind: "dug-in", level: 2, roll: -4 })).toBe("Dug in, level 2");
    expect(named({ factionId: north, kind: "faction", modifierId: "m", name: "Local support", role: "defence", roll: -1 })).toBe("Local support");
    expect(named({ kind: "unit-bonus", points: 3, role: "attack", roll: 1, unitTypeId: "artillery-group" as never })).toBe("Artillery group · attackers");
    expect(named({ kind: "unit-bonus", points: 3, role: "defence", roll: -1, unitTypeId: "artillery-group" as never })).toBe("Artillery group · defenders");
    expect(named({ kind: "pass", name: "Pajares", roll: -2 })).toBe("Pajares pass, crossed by every unit");
    expect(named({ factionId: north, kind: "air-support", role: "attack", roll: 6, unitIds: [unit("a"), unit("b")] })).toBe("Ground Support, 2 aircraft");
    expect(named({ factionId: north, kind: "air-support", role: "defence", roll: -3, unitIds: [] })).toBe("Defenders' Ground Support");
    expect(named({ kind: "barricades", roll: -1 })).toBe("Barricades (city held)");
  });

  it("sums its rows, without the effects that change nothing", () => {
    expect(rollLedger(scenario, [{ kind: "barricades", roll: -1 }, { kind: "dug-in", level: 0, roll: 0 }, { kind: "odds-overflow", roll: 3 }])).toEqual({
      rows: [{ label: "Barricades (city held)", value: -1 }, { label: "Odds beyond 6:1", value: 3 }],
      total: 2
    });
  });

  it("shows plus in green and minus in red, the total last, and says when nothing changes the roll", () => {
    const { rerender } = render(<RollLedger rows={[{ label: "Barricades", value: -1 }, { label: "Support", value: 1 }]} total={0} totalLabel="Total known now" />);
    const table = screen.getByRole("table", { name: "Effects on the roll:" });
    const cell = (name: string): HTMLElement => within(within(table).getByRole("rowheader", { name }).closest("tr")!).getByRole("cell");
    expect(cell("Barricades")).toHaveAttribute("data-tone", "minus");
    expect(cell("Barricades")).toHaveTextContent("\u22121");
    expect(cell("Support")).toHaveAttribute("data-tone", "plus");
    expect(cell("Total known now")).toHaveAttribute("data-tone", "none");
    rerender(<RollLedger rows={[]} total={0} />);
    expect(screen.getByText("Nothing changes the roll.")).toBeVisible();
    expect(screen.getByRole("rowheader", { name: "Total" })).toBeVisible();
  });
});
