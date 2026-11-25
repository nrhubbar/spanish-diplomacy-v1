// Rev 2 phase 0 (m3r2-contract): the shared-function stubs, link works and the new report events.
import { describe, expect, it } from "vitest";
import { airBattle, airBattleOdds } from "../main/engine/air/airBattle";
import { buildableId, currentLevel, maxLevel, projectCost, projectKey, siteRefusal } from "../main/engine/economy/catalogue";
import { advanceQueues } from "../main/engine/economy/queues";
import { isPass, linkBetween, linkKey, linkModifiers } from "../main/engine/network/links";
import { reachFor } from "../main/engine/network/reach";
import { arrivalPocket, pocketOfArmy, pocketsOf } from "../main/engine/partition/pockets";
import { initialGameState } from "../main/engine/resolution";
import { unitName } from "../main/presentation/text";
import type { AirBattleAircraft, AirBattleInput, BuildProject, SubTerritoryId, TurnOutcome } from "../main/engine/types";
import { outcomesFor } from "../main/engine/visibility";
import { projectIcon } from "../main/components/economy/EconomyIcon";
import { projectBaseName, projectEffectText, projectName } from "../main/presentation/economy";
import { airLines } from "../main/presentation/systemText/air";
import { contestedLines } from "../main/presentation/systemText/contested";
import { faction, said, spain, territory, unit, withUnits } from "./support";

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

  it("scores one d20 with both sides' air rolls and the defender's AA, and its odds agree", () => {
    const table = scenario.air!.battleTable;
    expect(airBattle(table, input, 12)).toEqual({ die: 12, modifier: -2, row: table[2], score: 10 });
    expect(airBattleOdds(table, input).reduce((sum, { chance }) => sum + chance, 0)).toBeCloseTo(1);
  });
});

describe("link works (R7; the rules are in networkEngine.test.ts)", () => {
  it("keys, prices and levels them", () => {
    expect(projectKey(link("new-rail"))).toBe(projectKey(link("new-rail", "guadarrama", "madrid")));
    expect(projectKey(link("new-rail"))).not.toBe(projectKey(link("road-upgrade")));
    expect(projectCost(scenario, link("new-rail"))).toEqual({ cost: { funds: 10, manpower: 6 }, turns: 5 });
    expect(buildableId(link("rail-upgrade"))).toBeUndefined();
    const madrid = start.subTerritories[sub("madrid")];
    expect(madrid === undefined ? undefined : currentLevel(madrid, link("rail-upgrade"))).toBe(0);
    expect(maxLevel(scenario, link("rail-upgrade"))).toBe(0);
    expect(said(scenario, siteRefusal(scenario, start, faction("republic"), sub("madrid"), link("road-upgrade")))).toBe("Trucks can use this road already.");
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
    expect(projectEffectText(scenario, link("road-upgrade"))).toBe("a road trucks can use");
    expect(projectEffectText(scenario, link("new-rail"))).toBe("longer rail moves");
    expect(projectIcon(scenario, link("road-upgrade"))).toBe("flag");
    expect(projectIcon(scenario, link("rail-upgrade"))).toBe("rail");
  });
});

describe("the new report events (R1, R2, R11)", () => {
  const battle: Extract<TurnOutcome, { readonly kind: "air-battle" }> = {
    aircraftLost: [],
    battleIndex: 0,
    input: { attacker: { aircraft: [], antiAir: 0, factionId: faction("north") }, defender: { aircraft: [], antiAir: 2, factionId: faction("republic") } },
    kind: "air-battle",
    result: { die: 11, modifier: -2, row: { aircraftLost: { attacker: 0, defender: 0 }, name: "Contested sky", support: "none", upTo: 12 }, score: 9 },
    support: { attacker: { roll: 0, unitIds: [] }, defender: { roll: 0, unitIds: [] } },
    territoryId: territory("madrid")
  };
  const cut: TurnOutcome = { factionId: faction("republic"), kind: "pocket-cut", subTerritoryIds: [sub("malaga")], territoryId: territory("andalucia"), unitIds: [unit("rep-wad-ras-1")] };
  const flipped: TurnOutcome = { factionId: faction("north"), kind: "territory-flipped", subTerritoryIds: [sub("alava")], territoryId: territory("pais-vasco") };
  const context = { scenario };

  it("reads them as plain sentences", () => {
    const start = "Air battle over Madrid, Northern Insurgent Command against Republican Government";
    expect(airLines["air-battle"](battle, context)).toBe(`${start}: Contested sky (9); no Ground Support counts.`);
    const plane = (id: string, factionId: string): AirBattleAircraft => ({ airRoll: 1, factionId: faction(factionId), mission: "support", supportRoll: 3, unitId: unit(id) });
    const bomber = plane("r_north_bomber-squadron_1", "north");
    const fighter = plane("r_republic_fighter-squadron_1", "republic");
    const fought = {
      ...battle,
      input: { attacker: { ...battle.input.attacker, aircraft: [bomber, plane("r_north_bomber-squadron_2", "north")] }, defender: { ...battle.input.defender, aircraft: [fighter] } }
    };
    const none = { roll: 0, unitIds: [] };
    expect(airLines["air-battle"](fought, context)).toBe(
      `${start}: Contested sky (9); no Ground Support counts; Northern Insurgent Command's aircraft return home; Republican Government's aircraft return home.`
    );
    const row = { aircraftLost: { attacker: 1, defender: 0 }, name: "Defender commands the air", support: "defender", upTo: 3 } as const;
    expect(airLines["air-battle"]({ ...fought, aircraftLost: [bomber.unitId], result: { ...fought.result, row, score: 2 }, support: { attacker: none, defender: { roll: 3, unitIds: [fighter.unitId] } } }, context)).toBe(
      `${start}: Defender commands the air (2); Republican Government gets Ground Support; Northern Insurgent Command loses ${unitName(scenario, bomber.unitId)}; Northern Insurgent Command's other aircraft are driven off.`
    );
    // The winner may have no Ground Support to give, and a side with no aircraft left has none to drive off.
    const swept = { ...row, aircraftLost: { attacker: 0, defender: 1 }, name: "Attacker commands the air", support: "attacker" } as const;
    expect(airLines["air-battle"]({ ...fought, aircraftLost: [fighter.unitId], result: { ...fought.result, row: swept, score: 19 } }, context)).toBe(
      `${start}: Attacker commands the air (19); no Ground Support counts; Republican Government loses ${unitName(scenario, fighter.unitId)}.`
    );
    expect(contestedLines["pocket-cut"](cut as never, context)).toBe("Republican Government: 1 army is cut off in Andalucía, in a pocket of Málaga.");
    expect(contestedLines["pocket-cut"]({ ...cut, unitIds: [unit("a"), unit("b")] }, context)).toMatch(/: 2 armies are cut off/u);
    expect(contestedLines["territory-flipped"](flipped as never, context)).toBe("Northern Insurgent Command now holds all of País Vasco: no other side has ground armies there.");
  });

  it("shows them to every side", () => {
    expect(outcomesFor(scenario, start, [battle, cut, flipped], faction("south"))).toEqual([battle, cut, flipped]);
  });
});
