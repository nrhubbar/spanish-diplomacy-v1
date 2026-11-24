import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CombatModifier, BattleOutcome, GeneralId, GradeDefinition, GradeId, SubTerritoryId, TraitId, UnitTypeId, WeatherId } from "../../main/engine/types";
import {
  battleBands,
  battleTitle,
  gradeEffect,
  gradeFamily,
  gradeOf,
  groundText,
  isBattle,
  resultKeyOf
} from "../../main/presentation/grades";
import { chanceTone, modifierName, modifierPhrase, oddsSummary, percent, signed } from "../../main/presentation/odds";
import { BattleRoll } from "../../main/screens/report/BattleRoll";
import { army, madridRepulsed, resistance, side } from "../battleFixtures";
import { faction, spainWithAir, territory } from "../support";

const minus = "\u2212";
const dot = "\u00b7";

function d20Battle(overrides: Partial<BattleOutcome> = {}): BattleOutcome {
  return {
    attacker: side(army("north-san-quintin-25", "north", "castilla-y-leon", 8)),
    attackerFactionId: faction("north"),
    column: 2,
    defender: side(army("rep-wad-ras-1", "republic", "madrid", 4)),
    demoralizedUnitIds: [],
    die: 12,
    grade: "stalemate" as GradeId,
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

function grade(attacker: GradeDefinition["attacker"], defender: Partial<GradeDefinition["defender"]>, ground: GradeDefinition["ground"]): GradeDefinition {
  return { attacker, defender: { demoralized: "none", lossPercent: 0, weakestDestroyed: false, ...defender }, ground, id: "test" as GradeId, name: "Test" };
}

const none = { demoralized: "none", lossPercent: 0 } as const;

describe("d20 grades in words (D1, D2, D8)", () => {
  const scenario = spainWithAir();

  it("tells battles from other outcomes", () => {
    expect(isBattle(d20Battle())).toBe(true);
    expect(isBattle(madridRepulsed)).toBe(true);
    expect(isBattle({ kind: "raid" })).toBe(false);
  });

  it("finds the battle's grade in the catalogue, and nothing without one", () => {
    expect(gradeOf(scenario, d20Battle())?.name).toBe("Stalemate");
    expect(gradeOf(scenario, d20Battle({ grade: "no-such-grade" as GradeId }))).toBeUndefined();
  });

  it("draws every grade as the nearest result family", () => {
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 10 }, { lossPercent: 100 }, "all"))).toBe("defender-eliminated");
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 35 }, { lossPercent: 35 }, "all"))).toBe("defender-exchange");
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 10 }, { lossPercent: 35 }, "all"))).toBe("defender-demoralized");
    expect(gradeFamily(grade(none, none, 1))).toBe("defender-demoralized");
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 100 }, none, 0))).toBe("attacker-eliminated");
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 10 }, { lossPercent: 10 }, 0))).toBe("both-demoralized");
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 10 }, { demoralized: "half" }, 0))).toBe("both-demoralized");
    expect(gradeFamily(grade({ demoralized: "none", lossPercent: 10 }, none, 0))).toBe("attacker-attrition");
    expect(gradeFamily(grade({ demoralized: "half", lossPercent: 20 }, none, 0))).toBe("attacker-demoralized");
  });

  it("keys and titles a battle by its grade", () => {
    expect(resultKeyOf(scenario, madridRepulsed)).toBe("attacker-attrition");
    expect(resultKeyOf(scenario, d20Battle({ grade: "defender-destroyed" as GradeId }))).toBe("defender-eliminated");
    expect(resultKeyOf(scenario, d20Battle({ grade: "no-such-grade" as GradeId }))).toBe("both-demoralized");
    expect(battleTitle(scenario, madridRepulsed)).toBe("Attack checked");
    expect(battleTitle(scenario, d20Battle({ grade: "costly-victory" as GradeId }))).toBe("Costly victory");
    expect(battleTitle(scenario, d20Battle({ grade: "no-such-grade" as GradeId }))).toBe("no-such-grade");
  });

  it("says the ground a grade takes", () => {
    expect(groundText("all")).toBe("takes all");
    expect(groundText(0)).toBe("no ground");
    expect(groundText(1)).toMatch(/^1 \S+ changes hands$/u);
    expect(groundText(2)).toMatch(/^2 \S+ change hands$/u);
  });

  it("writes a band's effect on both sides", () => {
    expect(gradeEffect(grade(none, none, 0))).toBe("no effect");
    expect(gradeEffect(grade({ demoralized: "none", lossPercent: 100 }, none, 0))).toBe("attacker destroyed");
    expect(gradeEffect(grade({ demoralized: "none", lossPercent: 10 }, { demoralized: "half", lossPercent: 20 }, "all")))
      .toBe(`takes all ${dot} attacker ${minus}10% ${dot} defender ${minus}20%, half demoralized`);
    expect(gradeEffect(grade(none, { demoralized: "all", lossPercent: 35, weakestDestroyed: true }, "all")))
      .toBe(`takes all ${dot} defender ${minus}35%, all demoralized ${dot} weakest defender destroyed`);
  });

  it("lays out the battle's column as bands, marking the one the score hit", () => {
    const bands = battleBands(scenario, d20Battle({ score: 12 }));
    expect(bands.length).toBeGreaterThan(1);
    expect(bands[0]?.band.from).toBe(0);
    expect(bands.at(-1)?.band.to).toBe(20);
    expect(bands.filter((band) => band.hit)).toHaveLength(1);
    const hit = bands.find((band) => band.hit);
    expect(hit?.band.from).toBeLessThanOrEqual(12);
    expect(hit?.band.to).toBeGreaterThanOrEqual(12);
    expect(bands.every((band) => band.grade !== undefined)).toBe(true);
    for (const band of bands) expect(band.range).toBe(band.band.from === band.band.to ? String(band.band.from) : `${String(band.band.from)}\u2013${String(band.band.to)}`);
  });
});

describe("modifier names and odds words (C15, A2, D5, D7)", () => {
  const scenario = spainWithAir();
  const general = "jose-miaja" as GeneralId;

  it("names every modifier kind", () => {
    const cases: readonly (readonly [CombatModifier, string | RegExp])[] = [
      [{ kind: "dug-in", level: 3, roll: -3 }, "Dug in level 3 (+3)"],
      [resistance, "Popular resistance +1"],
      [{ kind: "odds-overflow", roll: 2 }, "Odds beyond 6:1"],
      [{ halvings: 1, kind: "odds-halving", roll: -1 }, "Odds below 1:1 (1 halving)"],
      [{ halvings: 2, kind: "odds-halving", roll: -2 }, "Odds below 1:1 (2 halvings)"],
      [{ factionId: faction("republic"), generalId: general, kind: "general", role: "defence", roll: -1 }, "General"],
      [{ generalId: general, kind: "trait", role: "attack", roll: 1, traitId: "siege-master" as TraitId }, "General's trait: siege master"],
      [{ kind: "barricades", roll: -2 }, "Barricades (city held)"],
      [{ kind: "unit-bonus", points: 6, role: "attack", roll: 2, unitTypeId: "artillery-group" as UnitTypeId }, /\S/u],
      [{ kind: "unit-bonus", points: 6, role: "attack", roll: 2, unitTypeId: "no-such-type" as UnitTypeId }, "Supporting arms"],
      [{ factionId: faction("north"), kind: "fatigue", role: "attack", roll: -1 }, "Fatigued"],
      [{ factionId: faction("republic"), kind: "fatigue", role: "defence", roll: 1 }, "Defenders fatigued"],
      [{ kind: "weather", roll: -2, weatherId: "severe-cold" as WeatherId }, "Severe cold"],
      [{ kind: "amphibious", roll: -2 }, "Amphibious assault"],
      [{ factionId: faction("north"), kind: "air-support", role: "attack", roll: 2, unitIds: [] }, "Bomber support"],
      [{ factionId: faction("republic"), kind: "air-support", role: "defence", roll: -2, unitIds: [] }, "Bomber support for the defender"],
      [{ buildingId: "fortifications" as never, kind: "building", roll: -2, subTerritoryId: "madrid" as SubTerritoryId }, "Fortifications"]
    ];
    for (const [modifier, name] of cases) expect(modifierName(modifier, scenario)).toMatch(typeof name === "string" ? new RegExp(`^${name.replace(/[()+]/gu, "\\$&")}$`, "u") : name);
    expect(modifierName({ kind: "unit-bonus", points: 6, role: "attack", roll: 2, unitTypeId: "artillery-group" as UnitTypeId })).toBe("Supporting arms");
  });

  it("phrases odds steps and the weather with their roll change", () => {
    expect(modifierPhrase({ kind: "odds-overflow", roll: 2 })).toBe("Odds beyond 6:1 +2");
    expect(modifierPhrase({ halvings: 1, kind: "odds-halving", roll: -1 })).toBe(`Odds below 1:1 (1 halving) ${minus}1`);
    expect(modifierPhrase({ kind: "weather", roll: 0, weatherId: "rain" as WeatherId })).toBe("Rain 0");
    expect(modifierPhrase({ kind: "dug-in", level: 1, roll: -1 })).toBe("Dug in level 1 (+1)");
  });

  it("signs numbers, rounds percentages and tones chances", () => {
    expect(signed(2)).toBe("+2");
    expect(signed(-3)).toBe(`${minus}3`);
    expect(signed(0)).toBe("0");
    expect(percent(0.456)).toBe("46%");
    expect(chanceTone(0.7)).toBe("good");
    expect(chanceTone(0.5)).toBe("even");
    expect(chanceTone(0.2)).toBe("poor");
  });

  it("summarises reinforcement, unopposed moves and battles", () => {
    expect(oddsSummary({ kind: "reinforcement" } as never)).toMatchObject({ chip: "Reinforce", tone: "safe" });
    expect(oddsSummary({ kind: "unopposed" } as never)).toMatchObject({ chip: "Unopposed", tone: "safe" });
    const summary = oddsSummary({ kind: "battle", oddsLabel: "2:1", takeChance: 0.5 } as never);
    expect(summary).toEqual({ chip: `\u2248 2:1 ${dot} 50%`, label: `Approx. 2:1 ${dot} 50%`, sentence: "Approximately 2:1, 50 percent to take it.", tone: "even" });
  });
});

describe("the d20 battle card's roll (D8)", () => {
  const scenario = spainWithAir();

  it("shows the odds, the die, every term, the score and the column's bands", () => {
    const battle = d20Battle({ die: 12, modifiers: [{ kind: "dug-in", level: 2, roll: -2 }, resistance], score: 9 });
    const { container } = render(<BattleRoll battle={battle} scenario={scenario} />);
    expect(container.querySelector(".battle-odds")).toHaveTextContent(`2:1 odds ${dot} the 2:1 column of the d20 table`);
    expect(screen.getByText("Die roll 12")).toBeInTheDocument();
    const ledger = screen.getByRole("table", { name: "Effects on the roll:" });
    expect(within(ledger).getAllByRole("row").map((row) => row.textContent)).toEqual([`Dug in, level 2${minus}2`, `Popular resistance${minus}1`, `Total${minus}3`]);
    expect(container.querySelector(".battle-outcome")).toHaveTextContent(/^Outcome: 9$/u);
    const table = screen.getByRole("table", { name: "What each score in the 2:1 column does" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.length).toBe(battleBands(scenario, battle).length);
    const current = rows.filter((row) => row.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveClass("battle-band-hit");
    expect(rows.some((row) => row.getAttribute("data-ground") === "all")).toBe(true);
  });

  it("says when the score was kept within 0 to 20, and reads the lowest column", () => {
    const battle = d20Battle({ column: 0, die: 2, modifiers: [{ halvings: 2, kind: "odds-halving", roll: -4 }], oddsLabel: "1:4", score: 0 });
    const { container } = render(<BattleRoll battle={battle} scenario={scenario} />);
    expect(container.querySelector(".battle-outcome")).toHaveTextContent(`Outcome: 0 (${minus}2, kept within 0 to 20)`);
    expect(container.querySelector(".battle-odds")).toHaveTextContent("the below 1:1 column");
  });
});
