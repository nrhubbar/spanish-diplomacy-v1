import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import { aircraftLost, airBattle, groundSupport } from "../../main/engine/air/airBattle";
import type { AirBattleAircraft, AirBattleInput, AirBattleOutcome, AirMissionOrder, BattleOutcome, GameState, RaisedUnitDefinition, TurnOutcome, UnitTypeId } from "../../main/engine/types";
import { raisedUnitId } from "../../main/engine/recruitment/rules";
import { groupBattles } from "../../main/presentation/battle";
import { airBands, airBattleFor, airBattleView } from "../../main/presentation/battleAir";
import { unitName } from "../../main/presentation/text";
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

/** The air battle of these planes on the Spanish table, for a die. */
function outcome(die: number, attacker: readonly AirBattleAircraft[], defender: readonly AirBattleAircraft[], antiAir: number): AirBattleOutcome {
  const input: AirBattleInput = { attacker: { aircraft: attacker, antiAir: 0, factionId: republic }, defender: { aircraft: defender, antiAir, factionId: north }, supportMax: 2 };
  const result = airBattle(scenario.air!.battleTable, input, die);
  return { aircraftLost: aircraftLost(input, result.row), battleIndex: 0, input, kind: "air-battle", result, support: groundSupport(input, result.row), territoryId: target };
}

describe("the air battle in words (presentation/battleAir)", () => {
  const bombers = plane("rep-breguet-bombers", "support", 1, 3);
  const fighters = plane("rep-ni52-fighters", "support", 2, 3);

  it("shows one die, both sides' aircraft and AA in one ledger, the score and the row it hit", () => {
    const view = airBattleView(scenario, outcome(12, [bombers, fighters], [plane("north-leon-recon", "patrol", 2, 0, north)], 3));
    expect(view).toMatchObject({ clamp: undefined, die: 12, score: 10 });
    expect(view.ledger.total).toBe(-2);
    expect(view.ledger.rows.map((row) => row.value)).toEqual([1, 2, -2, -3]);
    expect(view.ledger.rows[0]?.label).toMatch(/ on Ground Support · attackers$/u);
    expect(view.ledger.rows[2]?.label).toMatch(/ on Patrol · defenders$/u);
    expect(view.ledger.rows[3]?.label).toBe("Anti-air in Castilla y León · defenders");
    expect(view.bands.map(({ hit, range }) => [range, hit])).toEqual([["0–3", false], ["4–8", false], ["9–12", true], ["13–17", false], ["18–20", false]]);
    expect(view.bands.map(({ effect, name }) => `${name}: ${effect}`)).toEqual([
      "Defender commands the air: Defenders' Ground Support; attackers lose one aircraft",
      "Defender holds the edge: Defenders' Ground Support; attackers driven off",
      "Contested sky: No Ground Support; every aircraft returns home",
      "Attacker holds the edge: Attackers' Ground Support; defenders driven off",
      "Attacker commands the air: Attackers' Ground Support; defenders lose one aircraft"
    ]);
    expect(view.results).toEqual([
      "Republican Government's aircraft return home and give no Ground Support.",
      "Northern Insurgent Command's aircraft return home."
    ]);
  });

  it("says when the score is kept on the table, and lists a row of one score as that score", () => {
    expect(airBattleView(scenario, outcome(1, [bombers], [], 3))).toMatchObject({ clamp: "−1, kept within 0 to 20", score: 0 });
    expect(airBattleView(scenario, outcome(20, [bombers], [], 0))).toMatchObject({ clamp: "21, kept within 0 to 20", score: 20 });
    const rows = [{ aircraftLost: { attacker: 2, defender: 1 }, name: "a", support: "none", upTo: 0 }, { aircraftLost: { attacker: 0, defender: 0 }, name: "b", support: "attacker", upTo: 20 }] as const;
    expect(airBands(rows, 0).map(({ effect, hit, range }) => [range, hit, effect])).toEqual([
      ["0", true, "No Ground Support; attackers lose 2 aircraft; defenders lose one aircraft"],
      ["1–20", false, "Attackers' Ground Support; defenders driven off"]
    ]);
    const airless = { ...scenario };
    delete airless.air;
    expect(airBattleView(airless, outcome(12, [bombers], [], 3)).bands).toEqual([]);
  });

  it("says who got Ground Support, who was driven off and who was lost", () => {
    const results = (...args: Parameters<typeof outcome>) => airBattleView(scenario, outcome(...args)).results;
    const defending = [plane("north-leon-recon", "support", 1, 3, north), plane("south-ju52-bombers", "support", 1, 4, north)];
    const wins = "Republican Government's Ground Support counts: +3 × 2 aircraft = +6 on the attack roll.";
    expect(results(19, [bombers, fighters], [], 3)).toEqual([wins]);
    expect(results(13, [bombers, fighters], [plane("north-leon-recon", "patrol", 2, 0, north)], 0)).toEqual([wins, "Northern Insurgent Command's aircraft are driven off."]);
    // The attacker commands the air: the defender loses its weakest in the air, and the rest are driven off.
    const [recon, junkers] = ["north-leon-recon", "south-ju52-bombers"].map((id) => unitName(scenario, unit(id)));
    expect(results(20, [bombers, fighters], defending, 0)).toEqual([
      wins, `Northern Insurgent Command loses ${String(junkers)}, shot down.`, "Northern Insurgent Command's other aircraft are driven off and give no Ground Support."
    ]);
    expect(results(20, [bombers, fighters], [defending[0]!], 0)).toEqual([wins, `Northern Insurgent Command loses ${String(recon)}, shot down.`]);
    const lost = `Republican Government loses ${unitName(scenario, bombers.unitId)}, shot down.`;
    expect(results(3, [bombers], [], 3)).toEqual([lost, "Northern Insurgent Command wins the air, but has no Ground Support to give."]);
    expect(results(5, [bombers], defending, 0)).toEqual([
      "Republican Government's aircraft are driven off and give no Ground Support.",
      "Northern Insurgent Command's Ground Support counts: +7 from 2 aircraft on the defence roll."
    ]);
    // A side can be two factions: each is named by its own aircraft.
    const allied = [plane("north-leon-recon", "support", 1, 3, north), plane("south-ju52-bombers", "support", 1, 4, faction("south"))];
    expect(results(5, [bombers], allied, 0)[1]).toBe("Northern Insurgent Command and Southern Insurgent Command's Ground Support counts: +7 from 2 aircraft on the defence roll.");
    expect(results(13, [bombers, fighters], allied, 0).slice(1)).toEqual(["Northern Insurgent Command's aircraft are driven off and give no Ground Support.", "Southern Insurgent Command's aircraft are driven off and give no Ground Support."]);
    const patrol = plane("rep-ni52-fighters", "patrol", 2, 0);
    expect(results(15, [patrol], [plane("north-leon-recon", "patrol", 2, 0, north)], 0)).toEqual([
      "Republican Government wins the air, but has no Ground Support to give.", "Northern Insurgent Command's aircraft are driven off."
    ]);
    // An aircraft that adds nothing to its side's roll has no line.
    expect(airBattleView(scenario, outcome(12, [{ ...bombers, airRoll: 0 }], [], 3)).ledger.rows).toHaveLength(1);
  });

  it("finds a battle's air battle by its territory and attacker; meetings have none", () => {
    const air = outcome(12, [bombers], [], 3);
    const battle = { attackerFactionId: republic, kind: "battle", site: { kind: "assault", territoryId: target } } as unknown as BattleOutcome;
    expect(airBattleFor([air], battle)).toBe(air);
    expect(airBattleFor([air], { ...battle, attackerFactionId: north })).toBeUndefined();
    expect(airBattleFor([air], { ...battle, site: { between: [target, territory("madrid")], kind: "meeting" } } as unknown as BattleOutcome)).toBeUndefined();
  });

  it("draws the die, the ledger, the score, the table and the result", () => {
    const { rerender } = render(<BattleAir air={outcome(12, [bombers, fighters], [], 3)} scenario={scenario} />);
    const section = screen.getByRole("region", { name: "Air battle" });
    expect(within(section).getByText("Die roll 12")).toBeInTheDocument();
    expect(within(section).getByRole("table", { name: "Effects on the roll:" })).toBeVisible();
    expect(section.querySelectorAll("[aria-current]")).toHaveLength(1);
    expect(section.querySelector("[aria-current]")).toHaveTextContent("Contested sky");
    expect(section.querySelector(".battle-outcome")).toHaveTextContent("Outcome: 12");
    expect(within(section).getByText(/^Republican Government's aircraft return home/u)).toBeVisible();
    rerender(<BattleAir air={outcome(1, [bombers], [], 3)} scenario={scenario} />);
    expect(screen.getByText("(−1, kept within 0 to 20)")).toBeVisible();
  });
});

describe("the battle card in a turn (U10, R11)", () => {
  const aaId = raisedUnitId(north, "anti-air-battery" as UnitTypeId, 1);
  const raised: RaisedUnitDefinition = { factionId: north, fullStrength: 300, id: aaId, type: "anti-air-battery" as UnitTypeId };
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
