import { cleanup, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { GeneralTrait, Scenario, TraitId, UnitId, UnitState } from "../../main/engine/types";
import { generalOf } from "../../main/engine/air/pieces";
import { CounterLayer } from "../../main/map/CounterLayer";
import { generalWords } from "../../main/presentation/generals";
import { ArmyPicker } from "../../main/screens/ArmyPicker";
import type { PlanningSession } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, shippedRegistry, spainId, spainWithAir, testStore } from "../support";

/** N10: a general's die effect in words, from the scenario's effects. */

afterEach(cleanup);

const scenario = spainWithAir();
const initial = initialGameState(scenario);
const isGeneral = (unit: UnitState): boolean => generalOf(scenario, initial.raised, unit.id) !== undefined;
const miaja = Object.values(initial.units).find((unit) => generalOf(scenario, initial.raised, unit.id)?.name === "José Miaja")!;
const withTrait = (effects: GeneralTrait["effects"]): Scenario => ({ ...scenario, generalTraits: scenario.generalTraits.map((trait) => ({ ...trait, effects })) });
const effectOf = (changed: Scenario): string | undefined => generalWords(changed, initial.raised, miaja.id)?.effect;
/** The general's unit type with these effects only. */
const withTypeEffects = (changed: Scenario): Scenario => {
  const typeId = scenario.index.units.get(miaja.id)!.type;
  const type = { ...scenario.index.unitTypes.get(typeId)!, effects: [] };
  return { ...changed, index: { ...changed.index, unitTypes: new Map([...changed.index.unitTypes, [typeId, type]]) }, unitTypes: changed.unitTypes.map((each) => (each.id === typeId ? type : each)) };
};

describe("a general in words (N10)", () => {
  it("names him, his trait and his effect on the battle roll", () => {
    expect(generalWords(scenario, initial.raised, miaja.id)?.text).toBe("José Miaja, Tenacious: +1 on the battle roll of his army; +1 more when defending.");
    const infantry = Object.values(initial.units).find((unit) => !isGeneral(unit))!;
    expect(generalWords(scenario, initial.raised, infantry.id)).toBeUndefined();
  });

  it("reads each kind of effect from the scenario", () => {
    expect(effectOf(withTrait([{ kind: "roll-modifier", role: "attack", roll: -1 }]))).toBe("+1 on the battle roll of his army; 1 less when attacking.");
    expect(effectOf(withTrait([{ kind: "no-rally" }]))).toBe("+1 on the battle roll of his army; he can't restore its morale.");
    expect(effectOf(withTrait([]))).toBe("+1 on the battle roll of his army.");
    const bare = withTypeEffects(withTrait([{ kind: "roll-modifier", role: "defence", roll: 2 }, { kind: "no-rally" }]));
    expect(effectOf(bare)).toBe("+2 on the battle roll of his army when defending.");
    expect(effectOf(withTypeEffects(withTrait([])))).toBe("No effect on the battle roll.");
    const stranger = { ...scenario, generalTraits: scenario.generalTraits.map((trait) => ({ ...trait, id: `other-${trait.id}` as TraitId })) };
    expect(generalWords(stranger, initial.raised, miaja.id)?.text).toBe("José Miaja: +1 on the battle roll of his army.");
  });

  it("is on his unit card, described and in view", () => {
    const session: PlanningSession = {
      draft: { ...emptyDraft, selectedTerritoryId: miaja.territoryId }, factionId: faction("republic"), game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state: initial }, phase: "planning"
    };
    render(<Provider store={testStore()}><ArmyPicker own={[miaja]} scenario={scenario} session={session} /></Provider>);
    expect(screen.getByText("+1 on the battle roll of his army; +1 more when defending.")).toBeVisible();
    const card = screen.getAllByRole("button").find((button) => button.classList.contains("formation-button"));
    expect(card).toHaveAccessibleDescription(/battle roll of his army/u);
  });

  it("is on his map counter, for the pointer and in its name", () => {
    const pkg = shippedRegistry().require(spainId);
    const other = Object.values(initial.units).find((unit) => !isGeneral(unit))!;
    const items = [miaja, other].map((unit) => ({ key: unit.id, kind: "army" as const, unit }));
    const positions = new Map([miaja, other].map((unit) => [unit.id as string, { x: 0, y: 0 }]));
    render(
      <CounterLayer
        game={initial}
        layout={{ compact: false, items, metrics: { gap: 4, height: 39, perRow: 4, width: 54 }, positions }}
        level="operational"
        scenario={pkg.scenario}
        unitSymbols={new Map()}
        view={{ onSelectUnit: () => undefined, orderedUnitIds: new Set<UnitId>(), selectedUnitIds: new Set<UnitId>() } as never}
      />
    );
    const counter = screen.getByRole("button", { name: /José Miaja, Tenacious: \+1 on the battle roll of his army; \+1 more when defending\.$/u });
    expect(counter.querySelector(".unit-counter-tip")?.textContent).toContain("battle roll");
    expect(counter.getAttribute("title")).toBeNull();
    expect(document.querySelectorAll(".unit-counter-tip")).toHaveLength(1);
  });
});
