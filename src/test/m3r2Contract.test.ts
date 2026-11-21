// Rev 2 phase 0 (m3r2-contract): the shared-function stubs, link works and the new report events.
import { describe, expect, it } from "vitest";
import { airBattle, airBattleOdds } from "../main/engine/air/airBattle";
import { buildableId, currentLevel, maxLevel, projectCost, projectKey, siteRefusal } from "../main/engine/economy/catalogue";
import { advanceQueues } from "../main/engine/economy/queues";
import { isPass, linkBetween, linkKey, linkModifiers } from "../main/engine/network/links";
import { reachFor } from "../main/engine/network/reach";
import { arrivalPocket, pocketOfArmy, pocketsOf } from "../main/engine/partition/pockets";
import { initialGameState } from "../main/engine/resolution";
import type { AirBattleInput, BuildProject, SubTerritoryId, TurnOutcome } from "../main/engine/types";
import { outcomesFor } from "../main/engine/visibility";
import { projectIcon } from "../main/components/economy/EconomyIcon";
import { projectBaseName, projectEffectText, projectName } from "../main/presentation/economy";
import { airLines } from "../main/presentation/systemText/air";
import { contestedLines } from "../main/presentation/systemText/contested";
import { faction, spain, territory, unit, withUnits } from "./support";

const scenario = spain();
const start = initialGameState(scenario);
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const link = (work: "new-rail" | "rail-upgrade" | "road-upgrade", a = "madrid", b = "guadarrama"): BuildProject => ({ a: sub(a), b: sub(b), kind: "link", work });

describe("links (D2, network/links.ts)", () => {
  it("finds the link between two bordering sub-territories either way round, with its modifiers", () => {
    const somosierra = linkBetween(scenario, sub("segovia"), sub("guadarrama"));
    expect(somosierra).toBe(linkBetween(scenario, sub("guadarrama"), sub("segovia")));
    expect(somosierra === undefined ? [] : linkModifiers(somosierra)).toEqual([
      { kind: "road", level: "main" },
      { kind: "rail", level: "single" },
      { kind: "pass", name: "Somosierra" }
    ]);
    expect(somosierra !== undefined && isPass(somosierra)).toBe(true);
    const henares = linkBetween(scenario, sub("madrid"), sub("henares"));
    expect(henares !== undefined && isPass(henares)).toBe(false);
    expect(linkBetween(scenario, sub("madrid"), sub("barcelona"))).toBeUndefined();
    expect(linkKey("b", "a")).toBe("a|b");
  });

  it("ships one link per border, the pass rules, and Málaga's sea lane (R3, R6)", () => {
    expect(scenario.links).toHaveLength(scenario.subTerritoryBorders.length);
    expect(scenario.linkModifiers.pass).toEqual({ defenderRoll: -2, label: "Mountain pass", lostToFlanking: true, noMotor: true });
    expect(scenario.linkModifiers.rail?.rangeByLevel).toEqual({ main: 4, single: 2 });
    expect(scenario.linkProjects?.["new-rail"].turns).toBeGreaterThan(scenario.linkProjects?.["rail-upgrade"].turns ?? 0);
    expect(scenario.links.filter(isPass).map((entry) => entry.modifiers.find((modifier) => modifier.kind === "pass"))).toEqual([
      { kind: "pass", name: "Pajares" },
      { kind: "pass", name: "Somosierra" },
      { kind: "pass", name: "Despeñaperros" }
    ]);
    expect(scenario.connections.filter((connection) => connection.between.join() === "andalucia,murcia").map((connection) => [connection.kind, connection.entry])).toEqual([
      ["land", ["almeria", "murcia"]],
      ["sea", ["malaga", "murcia"]]
    ]);
  });
});

describe("reach (network/reach.ts; the rules are in networkEngine.test.ts)", () => {
  it("gives march, rail and sea reach with their links, and reasons where none", () => {
    const madrid = reachFor(scenario, start, faction("republic"), [unit("rep-wad-ras-1")]);
    expect(madrid.has(territory("madrid"))).toBe(false);
    expect(madrid.get(territory("castilla-la-mancha"))).toEqual({ mode: "march", ok: true, path: [{ from: "madrid", mode: "march", to: "toledo" }] });
    expect(madrid.get(territory("catalunya"))).toMatchObject({ mode: "rail", ok: true });
    expect(madrid.get(territory("galicia"))).toMatchObject({ ok: false, reasons: [{ code: "too-far" }, { code: "no-trucks" }, { code: "no-rail" }] });
    const valencia = withUnits(scenario, [["rep-wad-ras-1", "republic", "valencia"]]);
    expect(reachFor(scenario, valencia, faction("republic"), [unit("rep-wad-ras-1")]).get(territory("islas-baleares"))).toMatchObject({ mode: "sea", ok: true });
  });

  it("gives nothing for no units, another side's units, or units in different territories", () => {
    expect(reachFor(scenario, start, faction("republic"), []).size).toBe(0);
    expect(reachFor(scenario, start, faction("north"), [unit("rep-wad-ras-1")]).size).toBe(0);
    expect(reachFor(scenario, start, faction("republic"), [unit("rep-wad-ras-1"), unit("nowhere")]).size).toBe(0);
    expect(reachFor(scenario, start, faction("republic"), [unit("rep-wad-ras-1"), unit("rep-barcelona-security")]).size).toBe(0);
  });
});

describe("pockets (partition/pockets.ts stub)", () => {
  it("treats everything a side holds in a territory as one pocket", () => {
    const basque = pocketsOf(scenario, start, territory("pais-vasco"), faction("north"));
    expect(basque).toEqual([{ factionId: "north", subTerritoryIds: ["alava"], territoryId: "pais-vasco" }]);
    expect(pocketsOf(scenario, start, territory("catalunya"), faction("north"))).toEqual([]);
    expect(pocketOfArmy(scenario, start, unit("rep-wad-ras-1"))?.territoryId).toBe("madrid");
    expect(pocketOfArmy(scenario, start, unit("nowhere"))).toBeUndefined();
    expect(arrivalPocket(scenario, start, territory("castilla-y-leon"), territory("pais-vasco"), faction("north"))).toEqual(basque[0]);
  });
});

describe("air battle (air/airBattle.ts)", () => {
  const input: AirBattleInput = {
    attacker: { aircraft: [{ airRoll: 1, factionId: faction("north"), mission: "support", supportRoll: 3, unitId: unit("bomber") }], antiAir: 0, factionId: faction("north") },
    defender: { aircraft: [{ airRoll: 2, factionId: faction("republic"), mission: "patrol", supportRoll: 0, unitId: unit("fighter") }], antiAir: 1, factionId: faction("republic") }
  };

  it("adds each aircraft's air roll and the defender's AA to the d20s, and its odds agree", () => {
    expect(airBattle(input, { attacker: 12, defender: 3 })).toEqual({ attackerTotal: 13, defenderTotal: 6, rolls: { attacker: 12, defender: 3 }, winner: "attacker" });
    const odds = airBattleOdds(input);
    expect(odds.attackerWins + odds.defenderWins + odds.tie).toBeCloseTo(1);
  });
});

describe("link works (R7; the rules are in networkEngine.test.ts)", () => {
  it("keys, prices and levels them", () => {
    expect(projectKey(link("new-rail"))).toBe(projectKey(link("new-rail", "guadarrama", "madrid")));
    expect(projectKey(link("new-rail"))).not.toBe(projectKey(link("road-upgrade")));
    expect(projectCost(scenario, link("new-rail"))).toEqual({ cost: { funds: 24 }, turns: 8 });
    expect(buildableId(link("rail-upgrade"))).toBeUndefined();
    const madrid = start.subTerritories[sub("madrid")];
    expect(madrid === undefined ? undefined : currentLevel(madrid, link("rail-upgrade"))).toBe(0);
    expect(maxLevel(scenario, link("rail-upgrade"))).toBe(0);
    expect(siteRefusal(scenario, start, faction("republic"), sub("madrid"), link("road-upgrade"))).toBe("This is a main road already.");
  });

  it("leaves the site as it was when one finishes in its queue", () => {
    const madrid = start.subTerritories[sub("madrid")];
    if (madrid === undefined) throw new Error("no Madrid");
    const queued = { ...start, subTerritories: { ...start.subTerritories, [sub("madrid")]: { ...madrid, queue: [{ factionId: faction("republic"), paid: {}, progress: 7, project: link("new-rail") }] } } };
    const { events, systems } = advanceQueues(scenario, queued);
    expect(events).toContainEqual({ factionId: "republic", kind: "build-completed", project: link("new-rail"), subTerritoryId: "madrid" });
    expect(systems.subTerritories[sub("madrid")]).toEqual({ ...madrid, queue: [] });
  });

  it("names them and their icons in plain words", () => {
    expect(projectBaseName(scenario, link("new-rail"))).toBe("New rail line");
    expect(projectName(scenario, start.subTerritories[sub("madrid")], link("rail-upgrade"))).toBe("Rail upgrade");
    expect(projectEffectText(scenario, link("road-upgrade"))).toBe("a main road for trucks");
    expect(projectEffectText(scenario, link("new-rail"))).toBe("longer rail moves");
    expect(projectIcon(scenario, link("road-upgrade"))).toBe("flag");
    expect(projectIcon(scenario, link("rail-upgrade"))).toBe("rail");
  });
});

describe("the new report events (R1, R2, R11)", () => {
  const battle: TurnOutcome = {
    battleIndex: 0,
    input: { attacker: { aircraft: [], antiAir: 0, factionId: faction("north") }, defender: { aircraft: [], antiAir: 2, factionId: faction("republic") } },
    kind: "air-battle",
    result: { attackerTotal: 12, defenderTotal: 9, rolls: { attacker: 11, defender: 5 }, winner: "attacker" },
    support: { attacker: { roll: 3, unitIds: [] }, defender: { roll: 0, unitIds: [] } },
    territoryId: territory("madrid")
  };
  const cut: TurnOutcome = { factionId: faction("republic"), kind: "pocket-cut", subTerritoryIds: [sub("malaga")], territoryId: territory("andalucia"), unitIds: [unit("rep-wad-ras-1")] };
  const flipped: TurnOutcome = { factionId: faction("north"), kind: "territory-flipped", subTerritoryIds: [sub("alava")], territoryId: territory("pais-vasco") };
  const context = { scenario };

  it("reads them as plain sentences", () => {
    expect(airLines["air-battle"](battle as never, context)).toBe(
      "Air battle over Madrid: Northern Insurgent Command 12 against Republican Government 9; Northern Insurgent Command wins the air, and its Ground Support applies."
    );
    const tie = { ...battle, result: { attackerTotal: 9, defenderTotal: 9, rolls: { attacker: 8, defender: 6 }, winner: "tie" } };
    expect(airLines["air-battle"](tie as never, context)).toMatch(/a tie, so neither side's Ground Support applies\.$/u);
    expect(contestedLines["pocket-cut"](cut as never, context)).toBe("Republican Government: 1 army is cut off in Andalucía, in a pocket of Málaga.");
    expect(contestedLines["pocket-cut"]({ ...cut, unitIds: [unit("a"), unit("b")] }, context)).toMatch(/: 2 armies are cut off/u);
    expect(contestedLines["territory-flipped"](flipped as never, context)).toBe("Northern Insurgent Command now holds all of País Vasco: no other side has ground armies there.");
  });

  it("shows them to every side", () => {
    expect(outcomesFor(scenario, start, [battle, cut, flipped], faction("south"))).toEqual([battle, cut, flipped]);
  });
});
