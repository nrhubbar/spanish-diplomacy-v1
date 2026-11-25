import { describe, expect, it } from "vitest";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, SubTerritoryId } from "../main/engine/types";
import { chooseOrder, chooseDestination, orderCounts, orderKindsFor, orderOf, type PlanningSession, selectTerritory, toggleUnit } from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { armyIn, faction, spain, spainId, territory, unit, withUnits, testGame, told } from "./support";

/** R1: with Granada the Republic's Andalusian ground is one pocket, with ways out to Castilla-La Mancha and Murcia. */
function withGranada(state: GameState): GameState {
  const granada = state.subTerritories["granada" as SubTerritoryId];
  if (granada === undefined) throw new Error("granada");
  return { ...state, subTerritories: { ...state.subTerritories, ["granada" as SubTerritoryId]: { ...granada, holder: faction("republic") } } };
}

function planning(state: GameState, factionId = "republic"): PlanningSession {
  return {
    draft: emptyDraft,
    factionId: faction(factionId),
    game: { assignments: {}, history: [], ready: [], scenarioId: spainId, gameId: testGame, state },
    phase: "planning"
  };
}

describe("planning in contested ground (C1, Q-UX-14)", () => {
  it("offers Attack, Withdraw and Disband, and Attack is the default order", () => {
    const scenario = spain();
    const session = selectTerritory(planning(initialGameState(scenario)), territory("andalucia"));
    expect(orderKindsFor(session, scenario)).toEqual(["attack", "withdraw", "disband"]);
    expect(orderKindsFor(selectTerritory(session, territory("madrid")), scenario)).toEqual(["move", "entrench", "disband"]);
    expect(orderOf(session, armyIn(session.game.state, "rep-vitoria-8"), scenario)).toBe("attack");
    expect(orderCounts(session, scenario).attack).toBeGreaterThan(0);
  });

  it("plans a Withdraw to a chosen destination, and Attack drops it again", () => {
    const scenario = spain();
    const session = selectTerritory(planning(withGranada(initialGameState(scenario))), territory("andalucia"));
    const choosing = chooseOrder(scenario, session, "withdraw");
    expect(choosing.draft.stage).toEqual({ orderKind: "withdraw", step: "choose-destination" });
    const refused = chooseDestination(scenario, choosing, territory("extremadura"));
    expect(refused.draft.orders).toEqual([]);
    const planned = chooseDestination(scenario, choosing, territory("murcia"));
    expect(planned.draft.orders).toEqual([{ factionId: "republic", from: "andalucia", kind: "withdraw", to: "murcia", unitId: "rep-vitoria-8" }]);
    expect(orderOf(planned, armyIn(planned.game.state, "rep-vitoria-8"), scenario)).toBe("withdraw");
    const back = chooseOrder(scenario, toggleUnit(selectTerritory(planned, territory("andalucia")), unit("rep-vitoria-8")), "attack");
    expect(back.draft.orders).toEqual([]);
  });

  it("plans a Withdraw at once when there is one way out, and refuses when there is none", () => {
    const scenario = spain();
    const pocket = selectTerritory(planning(withUnits(scenario, [["north-milan-32", "north", "asturias"]]), "north"), territory("asturias"));
    expect(told(scenario, chooseOrder(scenario, pocket, "withdraw").draft.feedback)).toMatch(/no way out/);
    const state = withUnits(scenario, [["rep-castilla-3", "republic", "extremadura"]]);
    const single = chooseOrder(scenario, selectTerritory(planning(state), territory("extremadura")), "withdraw");
    expect(single.draft.orders.map((order) => order.to)).toEqual(["castilla-la-mancha"]);
  });
});
