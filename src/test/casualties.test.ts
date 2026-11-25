import { describe, expect, it } from "vitest";
import { casualtiesAfter, turnCasualties } from "../main/engine/casualties";
import { initialGameState } from "../main/engine/resolution";
import type { BattleOutcome, TurnOutcome } from "../main/engine/types";
import { viewFor } from "../main/engine/visibility";
import { casualtiesView, menInFull, menInShort } from "../main/presentation/casualties";
import { faction, move, spain, territory, unit } from "./support";

const scenario = spain();
const start = initialGameState(scenario);
const order = move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon");

function battle(part: Partial<BattleOutcome>): TurnOutcome {
  return { attacker: { armies: [], value: 0 }, attackerFactionId: faction("republic"), column: 1, defender: { armies: [], value: 0 }, demoralizedUnitIds: [], die: 1, grade: "stalemate", ground: 0, kind: "battle", losses: [], modifiers: [], oddsLabel: "1:1", retreats: [], score: 1, site: { between: [territory("madrid"), territory("castilla-y-leon")], kind: "meeting" }, surrenderedUnitIds: [], ...part } as unknown as TurnOutcome;
}

const totals = (...outcomes: TurnOutcome[]): Readonly<Record<string, number>> => Object.fromEntries(turnCasualties(scenario, start, outcomes));

describe("casualties", () => {
  it("counts battles, break-ups and surrenders for each side", () => {
    expect(totals(battle({ losses: [{ destroyed: false, men: 120, unitId: unit("rep-wad-ras-1") }, { destroyed: true, men: 710, unitId: unit("north-san-marcial-22") }] }))).toEqual({ north: 710, republic: 120 });
    expect(totals(battle({ losses: [{ destroyed: false, men: 50, unitId: unit("rep-wad-ras-1") }], surrenderedMen: { [unit("rep-wad-ras-1")]: 500 }, surrenderedUnitIds: [unit("rep-wad-ras-1")] }))).toEqual({ republic: 550 });
  });

  it("counts surrenders on a blocked path, units disbanded by an impossible move, and cold", () => {
    expect(totals(
      { factionId: faction("republic"), from: territory("madrid"), kind: "path-surrender", men: 400, unitId: unit("rep-wad-ras-1") },
      { kind: "invalid-order", men: 30, order: { ...order, unitId: unit("rep-covadonga-4") }, refusal: { code: "not-connected" } },
      { factionId: faction("north"), kind: "frostbite", men: 5, territoryId: territory("castilla-y-leon"), unitId: unit("north-san-marcial-22") }
    )).toEqual({ north: 5, republic: 430 });
    expect(totals({ capturedByFactionId: faction("north"), cause: { kind: "standoff", opposingFactionIds: [] }, kind: "disbanded-move", men: 9, order })).toEqual({ republic: 9 });
  });

  it("counts a surrender once, however many outcomes report it", () => {
    const id = unit("rep-wad-ras-1");
    expect(totals(
      battle({ surrenderedMen: { [id]: 500 }, surrenderedUnitIds: [id] }),
      { factionId: faction("republic"), from: territory("madrid"), kind: "path-surrender", men: 500, unitId: id }
    )).toEqual({ republic: 500 });
  });

  it("counts a unit destroyed in battle once when it is also listed as surrendered, in either order", () => {
    const id = unit("rep-wad-ras-1");
    const broken = battle({ losses: [{ destroyed: true, men: 710, unitId: id }] });
    const surrender: TurnOutcome = { factionId: faction("republic"), from: territory("madrid"), kind: "path-surrender", men: 500, unitId: id };
    expect(totals(battle({ losses: [{ destroyed: true, men: 710, unitId: id }], surrenderedMen: { [id]: 710 }, surrenderedUnitIds: [id] }))).toEqual({ republic: 710 });
    expect(totals(broken, surrender)).toEqual({ republic: 710 });
    expect(totals(surrender, broken)).toEqual({ republic: 710 });
    expect(totals(broken, { capturedByFactionId: faction("north"), cause: { kind: "standoff", opposingFactionIds: [] }, kind: "disbanded-move", men: 9, order })).toEqual({ republic: 710 });
    // Men it lost in the battle that did not destroy it are its own, apart from those who then surrender.
    expect(totals(battle({ losses: [{ destroyed: false, men: 210, unitId: id }] }), surrender)).toEqual({ republic: 710 });
  });

  it("leaves out generals, aircraft, unknown units and every other way a unit changes", () => {
    expect(totals(
      battle({ losses: [{ destroyed: true, men: 100, unitId: unit("rep-general-miaja") }, { destroyed: true, men: 100, unitId: unit("nobody") }, { destroyed: false, men: 0, unitId: unit("rep-covadonga-4") }] }),
      { factionId: faction("republic"), from: territory("madrid"), kind: "path-surrender", men: 100, unitId: unit("rep-ni52-fighters") },
      { factionId: faction("republic"), kind: "no-move" },
      { kind: "successful-move", order },
      { kind: "unit-disbanded", men: 900, unitId: unit("rep-wad-ras-1") } as unknown as TurnOutcome
    )).toEqual({});
  });

  it("adds each turn to the total, starting from nothing, and everyone may see it", () => {
    const cold: TurnOutcome = { factionId: faction("north"), kind: "frostbite", men: 5, territoryId: territory("castilla-y-leon"), unitId: unit("north-san-marcial-22") };
    expect(casualtiesAfter(scenario, start, [])).toEqual({});
    const once = { ...start, ...casualtiesAfter(scenario, start, [cold]) };
    expect(once.casualties).toEqual({ north: 5 });
    const twice = { ...once, ...casualtiesAfter(scenario, once, [cold, battle({ losses: [{ destroyed: false, men: 7, unitId: unit("rep-wad-ras-1") }] })]) };
    expect(twice.casualties).toEqual({ north: 10, republic: 7 });
    expect(casualtiesAfter(scenario, twice, []).casualties).toEqual({ north: 10, republic: 7 });
    expect(viewFor(scenario, twice, undefined).casualties).toEqual({ north: 10, republic: 7 });
  });
});

describe("the casualty figures", () => {
  it("shortens them to one decimal", () => {
    expect([0, 999, 1000, 12_418, 36_993, 999_949, 999_950, 1_234_567].map(menInShort)).toEqual(["0", "999", "1k", "12.4k", "37k", "999.9k", "1M", "1.2M"]);
    expect(menInFull(36_993)).toBe("36,993");
  });

  it("splits the total by side", () => {
    const view = casualtiesView(scenario, { casualties: { [faction("north")]: 10 } });
    expect(view.total).toBe(10);
    expect(view.sides.map((side) => [side.factionId, side.men])).toEqual(scenario.factions.map((each) => [each.id, each.id === "north" ? 10 : 0]));
    expect(casualtiesView(scenario, {}).total).toBe(0);
  });
});
