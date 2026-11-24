import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { RollLedger } from "../../main/components/RollLedger";
import { fightingSide } from "../../main/engine/d20/modifiers";
import { fightingValue } from "../../main/engine/d20/rules";
import { initialGameState } from "../../main/engine/resolution";
import type { BattleSide, BuildingId, CombatModifier, BattleOutcome, GeneralId, Scenario, SubTerritoryId, TraitId, UnitId } from "../../main/engine/types";
import { battleLedger, whoFought } from "../../main/presentation/battleLedger";
import { effectName } from "../../main/presentation/rollLedger";
import { factionName, unitName } from "../../main/presentation/text";
import { BattleRoll } from "../../main/screens/report/BattleRoll";
import { army, side } from "../battleFixtures";
import { faction, shippedRegistry, spainId, territory } from "../support";

afterEach(cleanup);

const minus = "−";
const { scenario } = shippedRegistry().require(spainId);
const miaja = "jose-miaja" as GeneralId;

function battle(overrides: Partial<BattleOutcome> = {}): BattleOutcome {
  return {
    attacker: side(army("north-leon-recon", "north", "aragon", 4)),
    attackerFactionId: faction("north"),
    column: 2,
    defender: side(army("rep-wad-ras-1", "republic", "madrid", 2)),
    demoralizedUnitIds: [],
    die: 12,
    grade: scenario.d20.grades[0]!.id,
    ground: 0,
    kind: "battle",
    losses: [],
    modifiers: [],
    oddsLabel: "2:1",
    retreats: [],
    score: 12,
    site: { kind: "assault", occupation: { kind: "held" }, territoryId: territory("madrid") },
    surrenderedUnitIds: [],
    ...overrides
  };
}

describe("the battle ledger (D7)", () => {
  it("names each effect as the owner drew it", () => {
    const cases: readonly (readonly [CombatModifier, string])[] = [
      [{ kind: "dug-in", level: 2, roll: -4 }, "Dug in, level 2"],
      [{ factionId: faction("republic"), kind: "faction", modifierId: "any", name: "Popular resistance", role: "defence", roll: -3 }, "Popular resistance"],
      [{ factionId: faction("republic"), generalId: miaja, kind: "general", role: "defence", roll: -1 }, `${scenario.index.generals.get(miaja)!.name} commands`],
      [{ factionId: faction("republic"), generalId: "nobody" as GeneralId, kind: "general", role: "defence", roll: -1 }, "The general commands"],
      [{ generalId: miaja, kind: "trait", role: "attack", roll: 1, traitId: "unlisted" as TraitId }, `${scenario.index.generals.get(miaja)!.name} is unlisted`],
      [{ generalId: miaja, kind: "trait", role: "attack", roll: 1, traitId: scenario.generalTraits[0]!.id }, `${scenario.index.generals.get(miaja)!.name} is ${scenario.generalTraits[0]!.name.toLowerCase()}`],
      [{ kind: "barricades", roll: -1 }, "Barricades (city held)"],
      [{ factionId: faction("north"), kind: "fatigue", role: "attack", roll: -2 }, "Attackers fatigued"],
      [{ factionId: faction("republic"), kind: "fatigue", role: "defence", roll: 2 }, "Defenders fatigued"],
      [{ factionId: faction("north"), kind: "air-support", role: "attack", roll: 3, unitIds: ["north-leon-recon" as UnitId] }, "Ground Support, 1 aircraft"],
      [{ buildingId: "fortifications" as BuildingId, kind: "building", roll: -1, subTerritoryId: "madrid" as SubTerritoryId }, "Fortifications"],
      [{ buildingId: "gone" as BuildingId, kind: "building", roll: -1, subTerritoryId: "madrid" as SubTerritoryId }, "Fortifications"]
    ];
    for (const [modifier, name] of cases) expect(effectName(modifier, scenario)).toBe(name);
  });

  it("adds the rows to the total and the die to the outcome, and leaves out effects of zero", () => {
    const modifiers: readonly CombatModifier[] = [{ kind: "barricades", roll: -1 }, { kind: "amphibious", roll: 0 }, { kind: "odds-overflow", roll: 3 }];
    const ledger = battleLedger(scenario, battle({ modifiers, score: 14 }));
    expect(ledger).toEqual({ clamp: undefined, outcome: 14, rows: [{ label: "Barricades (city held)", value: -1 }, { label: "Odds beyond 6:1", value: 3 }], total: 2 });
  });

  it("says what the outcome was before it was kept on the table, at both ends", () => {
    expect(battleLedger(scenario, battle({ die: 1, modifiers: [{ kind: "barricades", roll: -3 }], score: 0 })).clamp).toBe(`${minus}2, kept within 0 to 20`);
    expect(battleLedger(scenario, battle({ die: 19, modifiers: [{ kind: "odds-overflow", roll: 4 }], score: 20 })).clamp).toBe("23, kept within 0 to 20");
  });

  it("prints plus, minus and zero with their tones, and says so when nothing changed the roll", () => {
    const { container } = render(<RollLedger rows={[{ label: "A", value: 2 }, { label: "B", value: -2 }, { label: "C", value: 0 }]} title="Known effects" total={0} />);
    expect(screen.getByRole("table", { name: "Known effects" })).toBeInTheDocument();
    expect([...container.querySelectorAll("tbody td")].map((cell) => [cell.textContent, cell.getAttribute("data-tone")])).toEqual([["+2", "plus"], [`${minus}2`, "minus"], ["0", "none"]]);
    expect(screen.getByRole("row", { name: "Total 0" })).toBeInTheDocument();
    cleanup();
    render(<RollLedger rows={[]} total={0} />);
    expect(screen.getByRole("cell", { name: "Nothing changes the roll." })).toBeInTheDocument();
  });
});

describe("who fought (D7)", () => {
  const state = initialGameState(scenario);

  it("records the men and morale that make each unit's value", () => {
    const units = Object.values(state.units).filter((unit) => unit.territoryId === territory("madrid"));
    const tired = units.map((unit, index) => ({ ...unit, morale: { ...unit.morale, demoralized: index % 2 === 0 }, strength: Math.max(1, Math.round(unit.strength * 0.8)) }));
    const recorded: BattleSide = fightingSide(scenario, state, tired.map((unit) => ({ from: unit.territoryId, unit })), "defence");
    for (const [index, entry] of recorded.armies.entries()) {
      const unit = tired[index]!;
      expect(entry).toMatchObject({ demoralized: unit.morale.demoralized, men: unit.strength, unitId: unit.id });
      const again = { ...unit, morale: { ...unit.morale, demoralized: entry.demoralized }, strength: entry.men };
      expect(entry.value).toBe(fightingValue(scenario, state.raised, again, "defence"));
    }
    expect(recorded.armies.find((entry) => entry.unitId === "rep-wad-ras-1")?.fullMen).toBe(550);
  });

  it("gives each unit's men and morale, a demoralized unit's share, and only the post of a general", () => {
    const general = Object.values(state.units).find((unit) => scenario.index.unitTypes.get(scenario.index.units.get(unit.id)!.type)?.kind === "general")!;
    const fought = battle({
      attacker: side(army("south-ju52-bombers", "south", "andalucia", 1, { fullMen: 2500, men: 2500 })),
      defender: side(army("rep-wad-ras-1", "republic", "madrid", 2, { demoralized: true, fullMen: 550, men: 400 }), army(general.id, "republic", "madrid", 0))
    });
    const [attack, defence] = whoFought(scenario, fought);
    expect(attack).toEqual({
      fighters: [{ demoralized: undefined, detail: "2,500 of 2,500 men, steady", id: "south-ju52-bombers", name: unitName(scenario, "south-ju52-bombers" as UnitId), value: 1 }],
      heading: `${factionName(scenario, faction("south"))} attack: 1`
    });
    expect(defence?.heading).toBe(`${factionName(scenario, faction("republic"))} defence: 2`);
    expect(defence?.fighters[0]).toMatchObject({ demoralized: "demoralized (counts half)", detail: "400 of 550 men, ", value: 2 });
    expect(defence?.fighters[1]).toMatchObject({ demoralized: undefined, detail: "General", value: 0 });
    const third: Scenario = { ...scenario, combat: { ...scenario.combat, demoralizationFactor: 0.3 } };
    expect(whoFought(third, fought)[1]?.fighters[0]?.demoralized).toBe("demoralized (counts 30%)");
  });

  it("is closed until opened, below the bands", async () => {
    const { container } = render(<BattleRoll battle={battle()} scenario={scenario} />);
    const fold = container.querySelector("details")!;
    expect(fold.open).toBe(false);
    expect(fold.previousElementSibling).toHaveClass("battle-bands");
    await userEvent.click(screen.getByText("Who fought"));
    expect(fold.open).toBe(true);
    const table = within(fold).getByRole("table");
    expect(within(table).getByRole("row", { name: /Wad-Ras.*700 of 700 men, steady 2/u })).toBeInTheDocument();
  });

  it("marks a demoralized unit and the share it counts for", () => {
    render(<BattleRoll battle={battle({ defender: side(army("rep-wad-ras-1", "republic", "madrid", 2, { demoralized: true, fullMen: 550, men: 400 })) })} scenario={scenario} />);
    expect(screen.getByText("demoralized (counts half)")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByText("400 of 550 men,")).toHaveClass("who-fought-detail");
  });
});
