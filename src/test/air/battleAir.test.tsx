import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import type { AirBattleAircraft, AirBattleOutcome, AirMissionOrder, BattleOutcome, GameState, RaisedUnitDefinition, TurnOutcome, UnitTypeId } from "../../main/engine/types";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { groupBattles } from "../../main/presentation/battle";
import { airBattleFor, airBattleView } from "../../main/presentation/battleAir";
import { BattleAir } from "../../main/screens/report/BattleAir";
import { BattleReport } from "../../main/screens/report/BattleReport";
import { faction, move, spainWithAir, territory, unit } from "../support";

/** U10, R11: the air battle on the battle card. */

afterEach(cleanup);

const scenario = spainWithAir();
const republic = faction("republic");
const north = faction("north");
const target = territory("castilla-y-leon");
const plane = (id: string, mission: AirBattleAircraft["mission"], airRoll: number, supportRoll: number, factionId = republic): AirBattleAircraft =>
  ({ airRoll, factionId, mission, supportRoll, unitId: unit(id) });

function outcome(winner: AirBattleOutcome["result"]["winner"], attacker: readonly AirBattleAircraft[], defender: readonly AirBattleAircraft[], antiAir: number): AirBattleOutcome {
  const sum = (planes: readonly AirBattleAircraft[]) => planes.reduce((total, aircraft) => total + aircraft.airRoll, 0);
  const rolls = { attacker: 12, defender: 7 };
  const counted = (planes: readonly AirBattleAircraft[], wins: boolean) => {
    const used = wins ? planes.filter((aircraft) => aircraft.mission === "support") : [];
    return { roll: used.reduce((total, aircraft) => total + aircraft.supportRoll, 0), unitIds: used.map((aircraft) => aircraft.unitId) };
  };
  return {
    battleIndex: 0,
    input: { attacker: { aircraft: attacker, antiAir: 0, factionId: republic }, defender: { aircraft: defender, antiAir, factionId: north }, supportMax: 2 },
    kind: "air-battle",
    result: { attackerTotal: rolls.attacker + sum(attacker), defenderTotal: rolls.defender + sum(defender) + antiAir, rolls, winner },
    support: { attacker: counted(attacker, winner === "attacker"), defender: counted(defender, winner === "defender") },
    territoryId: target
  };
}

describe("the air battle in words (presentation/battleAir)", () => {
  const bombers = plane("rep-breguet-bombers", "support", 1, 3);
  const fighters = plane("rep-ni52-fighters", "support", 2, 3);

  it("shows each side's aircraft and AA, its d20 sum, and who wins the air", () => {
    const view = airBattleView(scenario, outcome("attacker", [bombers, fighters], [], 3));
    expect(view.attacker).toMatchObject({ die: 12, faction: "Republican Government", sum: "d20 12 + 3 = 15", wins: true });
    expect(view.attacker.lines.map((line) => line.roll)).toEqual([1, 2]);
    expect(view.attacker.lines[0]?.label).toMatch(/ on Ground Support$/u);
    expect(view.attacker).not.toHaveProperty("none");
    expect(view.defender).toMatchObject({ lines: [{ label: "Anti-air in Castilla y León", roll: 3 }], none: "No aircraft over Castilla y León", sum: "d20 7 + 3 = 10", wins: false });
    expect(view.result).toBe("Republican Government wins the air: Ground Support +3 × 2 aircraft = +6 on the attack roll.");
  });

  it("words a tie, a winner without support, and support of mixed values", () => {
    expect(airBattleView(scenario, outcome("tie", [bombers], [], 3)).result).toBe("A tie in the air: neither side gets Ground Support.");
    expect(airBattleView(scenario, outcome("defender", [bombers], [], 3)).result).toBe("Northern Insurgent Command wins the air: Republican Government's Ground Support does not count.");
    const patrol = plane("rep-ni52-fighters", "patrol", 2, 0);
    expect(airBattleView(scenario, outcome("attacker", [patrol], [plane("north-leon-recon", "patrol", 2, 0, north)], 0)).result).toBe("Republican Government wins the air, with no Ground Support of its own to give.");
    expect(airBattleView(scenario, outcome("attacker", [patrol], [], 0)).attacker.sum).toBe("d20 12 + 2 = 14");
    expect(airBattleView(scenario, outcome("tie", [], [], 0)).attacker.sum).toBe("d20 12 = 12");
    const mixed = outcome("defender", [], [plane("north-leon-recon", "support", 1, 3, north), plane("south-ju52-bombers", "support", 1, 4, north)], 0);
    expect(airBattleView(scenario, mixed).result).toBe("Northern Insurgent Command wins the air: Ground Support +7 from 2 aircraft on the defence roll.");
  });

  it("finds a battle's air battle by its territory and attacker; meetings have none", () => {
    const air = outcome("attacker", [bombers], [], 3);
    const battle = { attackerFactionId: republic, kind: "battle", site: { kind: "assault", territoryId: target } } as unknown as BattleOutcome;
    expect(airBattleFor([air], battle)).toBe(air);
    expect(airBattleFor([air], { ...battle, attackerFactionId: north })).toBeUndefined();
    expect(airBattleFor([air], { ...battle, site: { between: [target, territory("madrid")], kind: "meeting" } } as unknown as BattleOutcome)).toBeUndefined();
  });

  it("draws the section with both panels, the result and the rule", () => {
    render(<BattleAir air={outcome("attacker", [bombers, fighters], [], 3)} scenario={scenario} />);
    const section = screen.getByRole("region", { name: "Air battle" });
    expect(within(section).getByText("Wins the air")).toBeVisible();
    expect(within(section).getByText("No aircraft over Castilla y León")).toBeVisible();
    expect(within(section).getByText("d20 12 + 3 = 15")).toBeVisible();
    expect(within(section).getByText(/Only one side ever gets Ground Support/u)).toBeVisible();
  });
});

describe("the battle card in a turn (U10, R11)", () => {
  const aaId = raisedUnitId(north, "anti-air-battery" as UnitTypeId, 1);
  const raised: RaisedUnitDefinition = { factionId: north, fullStrength: 300, id: aaId, name: "Anti-air battery No. 1", type: "anti-air-battery" as UnitTypeId };
  const start = initialGameState(scenario);
  const state: GameState = {
    ...start,
    raised: { ...start.raised, [raised.id]: raised },
    units: { ...start.units, [raised.id]: { factionId: north, fatigue: 0, id: raised.id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: target } }
  };
  const attack = ["rep-wad-ras-1", "rep-covadonga-4", "rep-madrid-security"].map((id) => move("republic", id, "madrid", "castilla-y-leon"));
  const support: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "support", territoryId: target }, unitId: unit("rep-breguet-bombers") };

  it("groups the air battle with its battle and draws it above the ground battle", () => {
    const result = resolveTurn(scenario, state, [{ factionId: republic, orders: [...attack, support] }], 3);
    const air = result.outcomes.find((entry): entry is Extract<TurnOutcome, { kind: "air-battle" }> => entry.kind === "air-battle");
    const group = groupBattles(result.outcomes).find((entry) => entry.key === "assault:castilla-y-leon");
    expect(air).toBeDefined();
    expect(group?.battles[0]?.air).toBe(air);
    render(<BattleReport focusedTerritoryId={target} result={result} scenario={scenario} seed={3} />);
    expect(screen.getAllByRole("region", { name: "Air battle" })).toHaveLength(1);
  });
});
