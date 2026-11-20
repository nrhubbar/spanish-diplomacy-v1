import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { D20BattleOutcome, GameState, GradeId, TurnOutcome } from "../../main/engine/types";
import { affectedFaction, attackSucceeded, changedHands, claimants, decisiveBattle, groupBattles, groupTerritory, siteKey } from "../../main/presentation/battle";
import { chooseDestination, chooseOrder, type PlanningSession } from "../../main/state/planning";
import type { Draft } from "../../main/state/session";
import { army, loss, madridRepulsed, roadMeeting, side } from "../battleFixtures";
import { armyIn, faction, spain, spainId, territory, unit } from "../support";

function d20(overrides: Partial<D20BattleOutcome> = {}): D20BattleOutcome {
  return {
    attacker: side(army("north-san-quintin-25", "north", "castilla-y-leon", 8)),
    attackerFactionId: faction("north"),
    column: 2,
    defender: side(army("rep-wad-ras-1", "republic", "madrid", 4)),
    demoralizedUnitIds: [],
    dice: "d20",
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

describe("d20 battles in the turn report (C14, D1)", () => {
  it("rings the defender when ground changed hands or the defenders lost more", () => {
    expect(affectedFaction(d20({ ground: 1 }))).toBe("republic");
    expect(affectedFaction(d20({ losses: [loss("rep-wad-ras-1", 300), loss("north-san-quintin-25", 100)] }))).toBe("republic");
    expect(affectedFaction(d20({ losses: [loss("rep-wad-ras-1", 100), loss("north-san-quintin-25", 300)] }))).toBe("north");
    expect(affectedFaction(d20())).toBe("north");
    // With no defenders on record the attacker is named.
    expect(affectedFaction(d20({ defender: side(), ground: "all" }))).toBe("north");
  });

  it("counts only a grade that takes the whole territory as a success", () => {
    expect(attackSucceeded(d20({ ground: "all" }))).toBe(true);
    expect(attackSucceeded(d20({ ground: 2 }))).toBe(false);
  });

  it("leads a card with the attack that went furthest: ground first, then the score", () => {
    const pushed = d20({ attackerFactionId: faction("south"), ground: 2, score: 9 });
    const checked = d20({ score: 15 });
    const outcomes = [checked, pushed] as readonly TurnOutcome[];
    const [group] = groupBattles(outcomes);
    expect(group?.battles).toHaveLength(2);
    expect(decisiveBattle(group!).battle).toBe(pushed);
    const higher = d20({ attackerFactionId: faction("south"), score: 18 });
    const [scores] = groupBattles([checked, higher]);
    expect(decisiveBattle(scores!).battle).toBe(higher);
    const taken = d20({ ground: "all", score: 1 });
    const [whole] = groupBattles([pushed, taken]);
    expect(decisiveBattle(whole!).battle).toBe(taken);
    expect(claimants(whole!)).toHaveLength(1);
  });

  it("keys a meeting on the road by both territories, with no territory and no change of hands", () => {
    expect(siteKey(roadMeeting)).toMatch(/^meeting:/u);
    const [group] = groupBattles([roadMeeting]);
    expect(group?.kind).toBe("meeting");
    expect(groupTerritory(group!)).toBeUndefined();
    expect(changedHands(group!)).toBe(false);
    const [held] = groupBattles([madridRepulsed]);
    expect(groupTerritory(held!)).toBe("madrid");
  });
});

describe("order choices at the edges (O2, C1, P6)", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  function planning(state: GameState, draft: Draft, factionId = "republic"): PlanningSession {
    return { draft, factionId: faction(factionId), game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
  }

  it("asks for a selection before any order", () => {
    expect(chooseOrder(scenario, planning(start, { orders: [], selectedUnitIds: [] }), "attack").draft.feedback).toMatch(/^Select at least one (army|unit) first\.$/u);
  });

  it("plans Attack and Hold where the units stand, with or without a territory selected", () => {
    const vitoria = unit("rep-vitoria-8");
    const attack = chooseOrder(scenario, planning(start, { orders: [], selectedTerritoryId: territory("andalucia"), selectedUnitIds: [vitoria] }), "attack");
    expect(attack.draft.feedback).toMatch(/^1 (army|unit) will attack where they stand\.$/u);
    expect(attack.draft.selectedTerritoryId).toBe("andalucia");
    const hold = chooseOrder(scenario, planning(start, { orders: [], selectedUnitIds: [vitoria, unit("rep-wad-ras-1")] }), "hold");
    expect(hold.draft.feedback).toMatch(/^2 (armies|units) will hold\.$/u);
    expect(hold.draft.selectedUnitIds).toEqual([]);
    expect(hold.draft.selectedTerritoryId).toBeUndefined();
  });

  it("refuses a withdrawal with no way out, and plans the only one at once", () => {
    const trapped = chooseOrder(scenario, planning(start, { orders: [], selectedTerritoryId: territory("islas-baleares"), selectedUnitIds: [unit("rep-baleares-37")] }), "withdraw");
    expect(trapped.draft.feedback).toMatch(/no way out through your own sub-territories\.$/u);
    const asturias = chooseOrder(scenario, planning(start, { orders: [], selectedTerritoryId: territory("asturias"), selectedUnitIds: [unit("rep-asturian-militia")] }), "withdraw");
    expect(asturias.draft.orders).toEqual([{ factionId: "republic", from: "asturias", kind: "withdraw", to: "cantabria", unitId: "rep-asturian-militia" }]);
  });

  it("says where a withdrawal may go when the choice is refused", () => {
    const choosing = chooseOrder(scenario, planning(start, { orders: [], selectedTerritoryId: territory("andalucia"), selectedUnitIds: [unit("rep-vitoria-8")] }), "withdraw");
    expect(chooseDestination(scenario, choosing, territory("andalucia")).draft.feedback).toBe("Choose a different territory as the destination.");
    expect(chooseDestination(scenario, choosing, territory("galicia")).draft.feedback).toMatch(/^Withdraw to a highlighted territory/u);
  });

  it("refuses Rest to healthy units and Entrench to demoralized ones, with or without a territory", () => {
    expect(chooseOrder(scenario, planning(start, { orders: [], selectedUnitIds: [unit("rep-wad-ras-1")] }), "rest").draft.feedback).toMatch(/^Only demoralized (armies|units) rest\.$/u);
    const shaken = armyIn(start, "rep-wad-ras-1");
    const state: GameState = { ...start, units: { ...start.units, [shaken.id]: { ...shaken, morale: { demoralized: true, quietTurns: 0 } } } };
    expect(chooseOrder(scenario, planning(state, { orders: [], selectedUnitIds: [shaken.id] }), "entrench").draft.feedback).toMatch(/cannot entrench\. They rest instead\.$/u);
    const resting = chooseOrder(scenario, planning(state, { orders: [], selectedUnitIds: [shaken.id] }), "rest");
    expect(resting.draft.feedback).toMatch(/^1 (army|unit) will rest\.$/u);
    expect(resting.draft.selectedUnitIds).toEqual([]);
  });

  it("explains a destination that is not connected, or that the units cannot reach together", () => {
    const madrid = [unit("rep-wad-ras-1"), unit("rep-covadonga-4")];
    const choosing = chooseOrder(scenario, planning(start, { orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: madrid }), "move");
    expect(choosing.draft.stage).toEqual({ orderKind: "move", step: "choose-destination" });
    expect(chooseDestination(scenario, choosing, territory("ceuta")).draft.feedback).toMatch(/is not connected to Madrid\. Choose a highlighted territory\.$/u);
    // A move by rail keeps its legs.
    const ride = chooseDestination(scenario, choosing, territory("valencia"));
    expect(ride.draft.orders[0]?.kind === "move" ? ride.draft.orders[0].legs?.map((leg) => leg.kind) : []).toContain("rail");
  });
});
