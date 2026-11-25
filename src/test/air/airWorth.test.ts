import { describe, expect, it } from "vitest";
import { noSupport, raidGain, raidLoss, raidsSpared, supportFrom } from "../../main/ai/airWorth";
import { assess } from "../../main/ai/assessment";
import { planRecruits } from "../../main/ai/orders/recruit";
import { movePlanningView } from "../../main/ai/planningView";
import { marginalGain, recruitBoard, siteBattles, worthOf } from "../../main/ai/unitWorth";
import { seededRandom } from "../../main/engine/random";
import { raisedDefinition, raisedUnitId } from "../../main/engine/recruitment/rules";
import type { GameState, RecruitOrder, Resources, Scenario, SubTerritoryId, UnitTypeDefinition, UnitTypeId } from "../../main/engine/types";
import { heldWhole, oneShortOwners, type Placement } from "../aiBoards";
import { faction, spainWithAir, territory, unit, withUnits } from "../support";

// B-12: aircraft, anti-air and recon are recruited by what they are worth, not by a quota.

const scenario = spainWithAir();
const [republic, north] = [faction("republic"), faction("north")];
const typeOf = (id: string, on: Scenario = scenario): UnitTypeDefinition => on.unitTypes.find((type) => type.id === id)!;
const [bomber, fighter, recon, antiAir] = ["bomber-squadron", "fighter-squadron", "recon-flight", "anti-air-battery"].map((id) => typeOf(id)) as [UnitTypeDefinition, UnitTypeDefinition, UnitTypeDefinition, UnitTypeDefinition];
const rich = { funds: 200, manpower: 200 } as Resources;

/** A unit of any type on the map, standing beside the placed ones. */
function raise(state: GameState, factionId: string, type: string, at: string, serial = 1): GameState {
  const id = raisedUnitId(faction(factionId), type as UnitTypeId, serial);
  const definition = raisedDefinition(scenario, id)!;
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: definition.fullStrength, territoryId: territory(at) } }
  };
}

const raiseAll = (state: GameState, units: Placement): GameState => units.reduce((board, [type, factionId, at], index) => raise(board, factionId, type, at, index + 1), state);
const funded = (state: GameState, resources: Resources = rich): GameState => ({ ...state, treasuries: { ...state.treasuries, [republic]: resources, [north]: resources } });
const boardOf = (state: GameState, factionId = republic, on: Scenario = scenario) => recruitBoard(on, state, assess(on, movePlanningView(on, state, factionId), factionId));
const ordersOf = (state: GameState, factionId = republic, on: Scenario = scenario) => planRecruits({ factionId, memory: {}, planned: [], random: seededRandom(1), scenario: on, state });
const idsOf = (orders: readonly RecruitOrder[]): readonly string[] => orders.map((order) => order.unitTypeId);
/** Spain where only these types can be recruited. */
const only = (...ids: readonly string[]): Scenario => ({ ...scenario, unitTypes: scenario.unitTypes.filter((type) => ids.includes(type.id)) });
/** A rule of the board: the Republic holds most of Spain, the North the rest. */
const peace = (): GameState => heldWhole(scenario, { ...oneShortOwners, andalucia: "north", "islas-baleares": "republic" }, [["rep-vitoria-8", "republic", "madrid"]]);

describe("Ground Support at its odds (R11)", () => {
  const least = 0.35;
  const open = { antiAir: 0, patrols: [] };
  const average = (types: readonly UnitTypeDefinition[], against: Parameters<typeof supportFrom>[3] = open) =>
    supportFrom(scenario, republic, types, against, least).reduce((sum, { chance, roll }) => sum + chance * roll, 0);

  it("gives the same odds whether or not the enemy flies the same type", () => {
    const other = { ...fighter, id: "fighter-of-theirs" as UnitTypeId };
    const odds = (patrols: readonly UnitTypeDefinition[]) => supportFrom(scenario, republic, [fighter], { antiAir: 0, patrols }, 0);
    expect(odds([fighter])).toEqual(odds([other]));
    expect(odds([fighter])).not.toBe(noSupport);
    expect(odds([fighter]).reduce((sum, { chance }) => sum + chance, 0)).toBeCloseTo(1, 12);
  });

  it("adds all of it unopposed, up to the scenario's cap, and none without aircraft", () => {
    expect(supportFrom(scenario, republic, [], open, least)).toBe(noSupport);
    expect([[bomber], [bomber, fighter], [bomber, fighter, bomber]].map((types) => average(types))).toEqual([3, 6, 6]);
    const uncapped: Scenario = { ...scenario, air: { ...scenario.air!, supportMax: undefined } };
    expect(supportFrom(uncapped, republic, [bomber, bomber, fighter], open, least)).toEqual([{ chance: 1, roll: 9 }]);
  });

  it("fights the air battle against AA and Patrol, and flies none below the profile's chance", () => {
    // A lone bomber against AA is too unlikely to bring support; a fighter just reaches the chance.
    const aa = { antiAir: 3, patrols: [] };
    expect(supportFrom(scenario, republic, [bomber], aa, least)).toBe(noSupport);
    expect(average([fighter], aa)).toBeGreaterThan(0);
    expect(average([fighter], aa)).toBeLessThan(average([fighter]));
    expect(average([bomber, fighter], aa)).toBeGreaterThan(average([fighter], aa));
    expect(average([bomber, fighter], { antiAir: 0, patrols: [fighter] })).toBeLessThan(average([bomber, fighter]));
    expect(supportFrom(scenario, republic, [fighter], aa, least)).toBe(supportFrom(scenario, republic, [fighter], aa, least));
  });
});

describe("what a raid costs (U3)", () => {
  const state = peace();
  const site = (id: string) => state.subTerritories[id as SubTerritoryId]!;
  const at = (id: string, patch: Partial<ReturnType<typeof site>>): GameState => ({ ...state, subTerritories: { ...state.subTerritories, [id]: { ...site(id), ...patch } } });
  const loss = (board: GameState, id = "huesca", modifier = 0) => raidLoss(scenario, board, id as SubTerritoryId, modifier);
  const mines = { mines: 2 } as never;

  it("is a turn's income where the territory pays it, and what a building hit takes to rebuild", () => {
    // 8 to 14 cuts the income (7 faces), 15 to 20 hits a building (6 faces).
    expect(loss(at("huesca", { buildings: [], development: {} }))).toEqual({});
    expect(loss(at("huesca", { buildings: ["airfield" as never], development: mines }))).toEqual({ funds: expect.closeTo(0.35 * 3 + 0.3 * 6) });
    expect(loss(at("huesca", { buildings: ["airfield" as never, "barracks" as never], development: {} }))).toEqual({ funds: 0.3 * 5.5 });
    // With no building, the highest development level falls.
    expect(loss(at("huesca", { buildings: [], development: { farms: 1, mines: 2 } as never }))["funds" as never]).toBeCloseTo(0.35 * 3 + 0.3 * 3);
    // A contested territory pays nobody.
    const contested = at("huesca", { buildings: [], development: mines });
    const split: GameState = { ...contested, subTerritories: { ...contested.subTerritories, ["teruel" as SubTerritoryId]: { ...site("teruel"), holder: republic } } };
    expect(loss(split)).toEqual({ funds: expect.closeTo(0.3 * 3) });
    expect(loss(state, "nowhere")).toEqual({});
  });

  it("is less against anti-air", () => {
    const built = at("huesca", { buildings: ["airfield" as never], development: mines });
    expect(loss(built, "huesca", -3)["funds" as never]).toBeCloseTo(0.35 * 3 + 0.15 * 6);
  });
});

describe("aircraft by what they are worth", () => {
  it("buys a bomber to raid where raids pay and nobody is near to fight", () => {
    const state = funded(peace());
    const orders = ordersOf(state);
    expect(idsOf(orders)).toEqual(["bomber-squadron"]);
    // Foot, a fighter and the rest change nothing here.
    const near = siteBattles(boardOf(state), territory("madrid"), []);
    for (const id of ["infantry-regiment", "fighter-squadron", "anti-air-battery", "truck-column"]) expect(marginalGain(boardOf(state), typeOf(id), near)).toBe(0);
    // Nothing to raid in range, no bomber.
    const bare: GameState = { ...state, subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, site.holder === republic ? site : { ...site, buildings: [], development: {} }])) };
    expect(idsOf(ordersOf(bare))).toEqual([]);
  });

  it("counts a raid a turn while the bomber lasts, each next bomber on the next dearest target", () => {
    const state = funded(peace());
    const gain = (board: GameState, type: UnitTypeDefinition = bomber, ordered: readonly RecruitOrder[] = []) => {
      const read = boardOf(board);
      return raidGain(read, type, siteBattles(read, territory("madrid"), ordered));
    };
    expect(gain(state)).toBeGreaterThan(0);
    expect([fighter, recon, typeOf("infantry-regiment")].map((type) => gain(state, type))).toEqual([0, 0, 0]);
    const order: RecruitOrder = { factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: bomber.id };
    expect(gain(state, bomber, [order])).toBeLessThan(gain(state));
    expect(gain(raise(state, "republic", "bomber-squadron", "valencia"))).toBeCloseTo(gain(state, bomber, [order]), 2);
    // AA over every target lowers it; one that trains past the horizon never raids.
    const guarded = ["galicia", "navarra", "castilla-y-leon", "aragon", "la-rioja", "andalucia"].reduce((board, id, index) => raise(board, "north", "anti-air-battery", id, index + 1), state);
    expect(gain(guarded)).toBeLessThan(gain(state));
    expect(gain(state, { ...bomber, recruit: { ...bomber.recruit!, trainingTurns: 9 } })).toBe(0);
    expect(gain(state, { ...bomber, air: { ...bomber.air!, range: 0 } })).toBe(0);
    expect(gain(state, { ...bomber, recruit: undefined } as unknown as UnitTypeDefinition)).toBeGreaterThan(gain(state));
  });

  it("buys Ground Support when it is worth more than foot, and not when two squadrons fly it already", () => {
    const fight: Placement = [["rep-vitoria-8", "republic", "madrid"], ["rep-castilla-3", "republic", "madrid"], ["rep-sevilla-34", "republic", "madrid"], ["north-zamora-29", "north", "castilla-y-leon"], ["north-america-23", "north", "castilla-y-leon"]];
    const state = funded(heldWhole(scenario, { ...oneShortOwners, extremadura: "republic" }, fight));
    const near = (board: GameState) => ({ board: boardOf(board), site: siteBattles(boardOf(board), territory("madrid"), []) });
    const worth = (board: GameState, id: string) => { const read = near(board); return worthOf(read.board, typeOf(id), rich, read.site); };
    const [foot, choices] = ["infantry-regiment", only("infantry-regiment", "fighter-squadron")];
    expect(worth(state, "fighter-squadron")).toBeGreaterThan(worth(state, foot));
    const madrid = (board: GameState) => idsOf(ordersOf(board, republic, choices).filter((order) => order.territoryId === "madrid"));
    expect(madrid(state)[0]).toBe("fighter-squadron");
    // One a turn, however many slots.
    expect(madrid(state).filter((id) => id === "fighter-squadron")).toHaveLength(1);
    expect(madrid(state)).toContain(foot);
    const flown = raiseAll(state, [["fighter-squadron", "republic", "valencia"], ["bomber-squadron", "republic", "valencia"]]);
    expect(worth(flown, "fighter-squadron")).toBe(0);
    expect(madrid(flown)).not.toContain("fighter-squadron");
    expect(madrid(flown)).toContain(foot);
    // AA over the attack makes a bomber's support too unlikely to fly.
    const guarded = raise(state, "north", "anti-air-battery", "castilla-y-leon");
    const gainOf = (board: GameState, type: UnitTypeDefinition) => marginalGain(boardOf(board), type, near(board).site);
    const supportOnly: UnitTypeDefinition = { ...bomber, air: { ...bomber.air!, missions: ["support"] } };
    expect(gainOf(state, supportOnly)).toBeGreaterThan(0);
    expect(gainOf(guarded, supportOnly)).toBeLessThan(gainOf(state, supportOnly));
  });
});

describe("anti-air by what it protects", () => {
  const front: Placement = [["rep-vitoria-8", "republic", "madrid"], ["rep-castilla-3", "republic", "madrid"], ["north-zamora-29", "north", "castilla-y-leon"], ["north-america-23", "north", "castilla-y-leon"], ["north-aragon-17", "north", "castilla-y-leon"]];
  const state = funded(heldWhole(scenario, { ...oneShortOwners, extremadura: "republic" }, front));
  const raidsOn = (board: GameState, type: UnitTypeDefinition = antiAir, at = "valencia", ordered: readonly RecruitOrder[] = []) => {
    const read = boardOf(board);
    return raidsSpared(read, type, siteBattles(read, territory(at), ordered));
  };

  it("is not bought where nothing threatens", () => {
    expect(idsOf(ordersOf(state))).not.toContain("anti-air-battery");
    expect(idsOf(ordersOf(funded(peace())))).not.toContain("anti-air-battery");
    expect(raidsOn(state)).toBe(0);
    // Enemy aircraft out of reach threaten nothing.
    expect(raidsOn(raise(state, "south", "fighter-squadron", "melilla"))).toBe(0);
  });

  it("counts the raids it spares its territory while enemy bombers reach it, and the Ground Support it takes from them", () => {
    const raided = raise(state, "north", "bomber-squadron", "castilla-y-leon");
    expect(raidsOn(raided)).toBeGreaterThan(0);
    // Two bombers fly two raids, over the faction's ground by what they would cost.
    expect(raidsOn(raise(raided, "north", "bomber-squadron", "aragon", 2))).toBeGreaterThan(raidsOn(raided));
    // A fighter's Patrol intercepts them; infantry does nothing to them.
    expect(raidsOn(raided, fighter)).toBeGreaterThan(0);
    expect(raidsOn(raided, typeOf("infantry-regiment"))).toBe(0);
    // It is not worth a second battery, whether it stands, trains or is ordered.
    expect(raidsOn(raise(raided, "republic", "anti-air-battery", "valencia"))).toBe(0);
    const training: GameState["training"] = [{ factionId: republic, paid: {}, paused: false, territoryId: territory("valencia"), turnsLeft: 1, typeId: antiAir.id, unitId: unit("battery") }];
    expect(raidsOn({ ...raided, training })).toBe(0);
    expect(raidsOn(raided, antiAir, "valencia", [{ factionId: republic, kind: "recruit", territoryId: territory("valencia"), unitTypeId: antiAir.id }])).toBe(0);
    // Ground worth no raid spares none.
    const bare: GameState = { ...raided, subTerritories: Object.fromEntries(Object.entries(raided.subTerritories).map(([id, site]) => [id, { ...site, buildings: [], development: {} }])) };
    expect(raidsOn(bare)).toBe(0);
    // Madrid faces the North's stack with Ground Support: the battery is worth more than its own defence and raids.
    const gain = (board: GameState) => marginalGain(boardOf(board), antiAir, siteBattles(boardOf(board), territory("madrid"), []));
    const supported = raise(raided, "north", "fighter-squadron", "castilla-y-leon", 3);
    expect(gain(supported)).toBeGreaterThan(gain(raided));
    expect(gain(supported)).toBeGreaterThan(gain(state) + raidsOn(supported, antiAir, "madrid"));
    // Ground Support flies over one battle a turn: the more fronts, the less likely here.
    const wider = raiseAll(supported, [["infantry-regiment", "north", "andalucia"], ["infantry-regiment", "north", "aragon"]]);
    const flown = (board: GameState) => siteBattles(boardOf(board), territory("madrid"), []).battles.find((battle) => battle.role === "defence")!.flown;
    expect(flown(wider)).toBeLessThan(flown(supported));
  });

  it("is bought when it is worth more than the next choice, not ahead of everything", () => {
    // Madrid is all the Republic holds, so the North's Ground Support flies there if anywhere.
    const last = funded(heldWhole(scenario, Object.fromEntries(scenario.territories.map(({ id }) => [id, id === "madrid" ? "republic" : "north"])), front));
    const supported = raiseAll(last, [["fighter-squadron", "north", "castilla-y-leon"], ["bomber-squadron", "north", "castilla-y-leon"]]);
    const weakFoot: Scenario = only("militia-column", "anti-air-battery");
    const madrid = (board: GameState, on: Scenario) => idsOf(ordersOf(board, republic, on).filter((order) => order.territoryId === "madrid"));
    expect(madrid(supported, weakFoot)).toContain("anti-air-battery");
    expect(madrid(supported, weakFoot).filter((id) => id === "anti-air-battery")).toHaveLength(1);
    expect(madrid(last, weakFoot)).not.toContain("anti-air-battery");
    // With tanks, guns and foot to choose from, it is not the first order.
    expect(madrid(supported, scenario)[0]).not.toBe("anti-air-battery");
  });
});

describe("the last choices", () => {
  it("buys one recon flight when it has none and nothing else it can afford is worth anything", () => {
    const state = funded(peace());
    const watched = raise(state, "north", "infantry-regiment", "galicia");
    const quiet = only("recon-flight");
    expect(idsOf(ordersOf(watched, republic, quiet))).toEqual(["recon-flight"]);
    expect(ordersOf(watched, republic, quiet)).toEqual(ordersOf(watched, republic, quiet));
    // Nothing to look at, one already, or one on its way: none.
    expect(ordersOf(state, republic, quiet)).toEqual([]);
    expect(ordersOf(raise(watched, "republic", "recon-flight", "valencia", 2), republic, quiet)).toEqual([]);
    const training: GameState["training"] = [{ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 1, typeId: recon.id, unitId: unit("flight") }];
    expect(ordersOf({ ...watched, training }, republic, quiet)).toEqual([]);
    // The one aircraft a turn is better spent on a bomber that raids.
    expect(idsOf(ordersOf(watched, republic, only("recon-flight", "bomber-squadron")))).toEqual(["bomber-squadron"]);
    // Foot worth training fills the slots first.
    const orders = idsOf(ordersOf(watched, republic, only("recon-flight", "infantry-regiment")));
    expect(orders.length).toBeGreaterThan(0);
    expect(orders).not.toContain("recon-flight");
  });

  it("reads the rules of the types, not their ids", () => {
    const renamed = (type: UnitTypeDefinition): UnitTypeDefinition => ({ ...type, id: `new-${type.id}` as UnitTypeId });
    const old = scenario.unitTypes.map((type): UnitTypeDefinition => { const { recruit, ...rest } = type; return recruit === undefined ? type : rest; });
    const types = [...old, ...scenario.unitTypes.map(renamed)];
    const other: Scenario = { ...scenario, index: { ...scenario.index, unitTypes: new Map(types.map((type) => [type.id, type])) }, unitTypes: types };
    const state = raiseAll(funded(withUnits(scenario, [["rep-vitoria-8", "republic", "madrid"], ["north-zamora-29", "north", "castilla-y-leon"], ["north-america-23", "north", "castilla-y-leon"]])), [["bomber-squadron", "north", "castilla-y-leon"], ["fighter-squadron", "north", "castilla-y-leon"]]);
    const as = (orders: readonly RecruitOrder[]): readonly string[] => orders.map((order) => `${order.territoryId} ${order.unitTypeId.replace("new-", "")}`);
    const here = as(ordersOf(state));
    expect(here.length).toBeGreaterThan(3);
    expect(as(ordersOf(state, republic, other))).toEqual(here);
  });
});
