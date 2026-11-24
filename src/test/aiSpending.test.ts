import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { buildReserve, developmentTarget, planBuilds } from "../main/ai/orders/build";
import { planDisbands } from "../main/ai/orders/disband";
import { planRecruits } from "../main/ai/orders/recruit";
import { planReplenishment } from "../main/ai/orders/replenish";
import { balanceLeft, starves } from "../main/ai/orders/spending";
import { columnsPerRoll, nextRollBonus, siteBattles, worthOf } from "../main/ai/unitWorth";
import { projectedHoldings, upkeepShortfall } from "../main/engine/economy/upkeep";
import { seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { type GameState, isMoveOrder, type Order, type RecruitOrder, type Resources, type Scenario, type UnitTypeDefinition } from "../main/engine/types";
import { heldWhole, oneShortOwners, type Placement } from "./aiBoards";
import { armyIn, battlesOf, faction, spain, territory, tiny, unit, withUnits, withoutUpkeep } from "./support";

const scenario = spain();
const start = initialGameState(scenario);
const [republic, north, south] = [faction("republic"), faction("north"), faction("south")];
const context = (state: GameState, factionId = republic, planned: readonly Order[] = [], on: Scenario = scenario) => ({ factionId, memory: {}, planned, random: seededRandom(1), scenario: on, state });
const funded = (state: GameState, factionId: typeof republic, funds: number, manpower: number): GameState => ({ ...state, treasuries: { ...state.treasuries, [factionId]: { funds, manpower } as Resources } });
const typeOf = (id: string): UnitTypeDefinition => scenario.unitTypes.find((type) => type.id === id)!;
const ids = (orders: readonly RecruitOrder[]): readonly string[] => orders.map((order) => order.unitTypeId);

describe("spending against a leader (D6)", () => {
  // The North holds Galicia beside the Republic's Asturias.
  const units: Placement = [["north-zamora-29", "north", "galicia"], ["rep-santander-column", "republic", "asturias"], ["north-aragon-17", "north", "aragon"]];
  const far = { ...oneShortOwners, catalunya: "north", extremadura: "north", murcia: "north", valencia: "south" };
  const board = (owners: Readonly<Record<string, string>>) => funded(heldWhole(scenario, owners, units), north, 24, 24);

  it("holds nothing back for builds at two steps or fewer, and buys one-turn units where they can meet it", () => {
    const calm = planRecruits(context(board(far), north));
    const left = balanceLeft(context(board(far), north, calm));
    expect(left["funds" as never]).toBeGreaterThanOrEqual(buildReserve(context(board(far), north), { funds: 24, manpower: 24 } as never)["funds" as never]!);
    const hurried = planRecruits(context(board({ ...oneShortOwners, extremadura: "south" }), north));
    expect(balanceLeft(context(board(far), north, hurried))["funds" as never]).toBeLessThan(left["funds" as never]!);
    expect(hurried.length).toBeGreaterThan(0);
    for (const order of hurried) expect(scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.trainingTurns).toBe(1);
  });

  it("buys by worth at a site the leader is nowhere near", () => {
    // Only the leader's neighbours hurry: the Balearics, beyond its units' reach, do not.
    const state = funded(heldWhole(scenario, { ...oneShortOwners, catalunya: "north", "islas-baleares": "north", valencia: "south", extremadura: "republic", murcia: "south", "la-rioja": "republic", navarra: "republic" }, [["north-aragon-17", "north", "islas-baleares"]]), north, 200, 200);
    expect(planRecruits(context(state, north)).length).toBeGreaterThan(0);
  });
});

describe("mixed armies (D6)", () => {
  it("reads a roll point's worth from the odds table: three to a column in Spain", () => {
    expect(columnsPerRoll(scenario.d20)).toBeGreaterThan(0.25);
    expect(columnsPerRoll(scenario.d20)).toBeLessThan(0.45);
    expect(columnsPerRoll(tiny().d20)).toBeGreaterThan(0);
    // A table whose columns are all alike is worth nothing to climb.
    expect(columnsPerRoll({ ...scenario.d20, table: scenario.d20.table.map(() => scenario.d20.table[0]!) })).toBe(0);
  });

  it("counts what one more gun, tank or squadron adds, until the effect's most", () => {
    expect([0, 1, 2, 3].map((count) => nextRollBonus(scenario, typeOf("artillery-group"), count))).toEqual([1, 1, 1, 0]);
    expect([0, 1, 2].map((count) => nextRollBonus(scenario, typeOf("tank-company"), count))).toEqual([1, 1, 0]);
    const cap = scenario.air?.supportMax ?? 0;
    const uncapped: Scenario = { ...scenario, air: { ...scenario.air!, supportMax: undefined } };
    expect(nextRollBonus(scenario, typeOf("bomber-squadron"), cap - 1)).toBe(3);
    expect(nextRollBonus(scenario, typeOf("bomber-squadron"), cap)).toBe(0);
    expect(nextRollBonus(uncapped, typeOf("bomber-squadron"), 9)).toBe(3);
    expect(nextRollBonus(scenario, typeOf("infantry-regiment"), 0)).toBe(0);
  });

  it("values guns where a strong stack must be broken, and not where nothing stands", () => {
    const own: Placement = [["rep-vitoria-8", "republic", "madrid"], ["rep-sevilla-34", "republic", "madrid"], ["rep-castilla-3", "republic", "madrid"], ["rep-otumba-9", "republic", "madrid"], ["rep-wad-ras-1", "republic", "madrid"]];
    const stack: Placement = [["north-san-marcial-22", "north", "castilla-y-leon"], ["north-san-quintin-25", "north", "castilla-y-leon"], ["north-zamora-29", "north", "castilla-y-leon"], ["north-america-23", "north", "castilla-y-leon"]];
    const perRoll = columnsPerRoll(scenario.d20);
    const balance = { funds: 60, manpower: 20 } as Resources;
    const at = (state: GameState, ordered: readonly RecruitOrder[] = []) => siteBattles(scenario, state, republic, territory("madrid"), ordered, perRoll);
    const strong = withUnits(scenario, [...own, ...stack]);
    const quiet = withUnits(scenario, own);
    const gun = typeOf("artillery-group");
    expect(at(quiet).rollPoint).toBe(0);
    expect(at(strong).rollPoint).toBeGreaterThan(0);
    expect(worthOf(scenario, gun, balance, at(strong))).toBeGreaterThan(worthOf(scenario, typeOf("infantry-regiment"), balance, at(strong)));
    expect(worthOf(scenario, gun, balance, at(quiet))).toBeLessThan(worthOf(scenario, typeOf("infantry-regiment"), balance, at(quiet)));
    // The fourth gun adds nothing to the roll; ordered and training ones count.
    const guns = ["a", "b", "c"].map((): RecruitOrder => ({ factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: gun.id }));
    expect(at(strong, guns).count(gun)).toBe(3);
    expect(worthOf(scenario, gun, balance, at(strong, guns))).toBeLessThan(worthOf(scenario, gun, balance, at(strong)));
    expect(at({ ...strong, training: [{ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: gun.id, unitId: unit("new-gun") }] }).count(gun)).toBe(1);
    expect(at(strong).count(typeOf("bomber-squadron"))).toBe(0);
    expect(worthOf(scenario, typeOf("general"), balance, at(strong))).toBe(0);
  });

  it("builds combined arms within the support ratio, and counts what is in training", () => {
    const rich = funded(start, republic, 200, 60);
    const orders = planRecruits(context(rich));
    const guns = orders.filter((order) => order.unitTypeId === ("artillery-group" as never));
    const fighters = Object.values(start.units).filter((entry) => entry.factionId === republic).length + orders.length;
    expect(guns.length).toBeGreaterThan(0);
    expect(guns.length * 4).toBeLessThanOrEqual(fighters);
    expect(new Set(ids(orders)).size).toBeGreaterThan(2);
    expect(orders).toEqual(planRecruits(context(rich)));
    const training = Array.from({ length: 12 }, (_, index) => ({ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: typeOf("artillery-group").id, unitId: unit(`gun-${String(index)}`) }));
    expect(ids(planRecruits(context({ ...rich, training })))).not.toContain("artillery-group");
  });
});

describe("upkeep and the orders that spend it (D6)", () => {
  it("never disbands a unit and recruits another that spends the same resource", () => {
    const broke = funded(heldWhole(scenario, Object.fromEntries(Object.keys(oneShortOwners).map((id) => [id, id === "madrid" ? "republic" : "north"])), [
      ["rep-catalan-columns", "republic", "madrid"], ["rep-durruti-column", "republic", "madrid"], ["rep-wad-ras-1", "republic", "madrid"], ["rep-otumba-9", "republic", "madrid"]
    ]), republic, 60, 0);
    const poor: GameState = { ...broke, subTerritories: Object.fromEntries(Object.entries(broke.subTerritories).map(([id, site]) => [id, { ...site, development: {} }])) };
    const disbands = planDisbands(context(poor));
    expect(disbands.length).toBeGreaterThan(0);
    // With Manpower in hand afterwards, a Recruit could be afforded; the Disband stops it.
    const later = funded(poor, republic, 60, 30);
    expect(planRecruits(context(later)).length).toBeGreaterThan(0);
    expect(planRecruits(context(later, republic, disbands))).toEqual([]);
    for (const state of [poor, later]) {
      const { orders } = generateComputerSubmission(scenario, state, republic, seededRandom(3));
      expect(orders.some((order) => order.kind === "disband") && orders.some((order) => order.kind === "recruit")).toBe(false);
    }
  });

  it("looks as many turns ahead as the profile says, and no further than the rules charge", () => {
    expect(upkeepShortfall(scenario, start, south, [], 2)).toEqual({});
    expect(upkeepShortfall(scenario, start, south, [], 3)["manpower" as never]).toBeGreaterThan(0);
    expect(projectedHoldings(scenario, start, south, [])).toEqual(projectedHoldings(scenario, start, south, [], 1));
    const recruit: Order = { factionId: south, kind: "recruit", territoryId: territory("ceuta"), unitTypeId: typeOf("security-forces").id };
    expect(starves(context(start, south), [], recruit)).toBe(true);
    expect(starves(context(start, republic), [], { ...recruit, factionId: republic })).toBe(false);
    const free = withoutUpkeep(scenario);
    expect(starves(context(start, south, [], free), [], recruit)).toBe(false);
  });

  it("does not Replenish on what its army needs to eat", () => {
    const worn = armyIn(start, "south-regulares");
    const state: GameState = { ...start, units: { ...start.units, [worn.id]: { ...worn, strength: Math.round(worn.strength / 4) } } };
    const short = funded(state, south, 15, 3);
    expect(planReplenishment(context(short, south))).toEqual([]);
    expect(planReplenishment(context(funded(state, south, 15, 20), south)).map((order) => order.unitId)).toEqual([worn.id]);
  });
});

describe("the South's opening (D6)", () => {
  it("attacks in Andalucia with its units there and from Ceuta and Melilla, and spends no Manpower", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const submission = generateComputerSubmission(scenario, start, south, seededRandom(seed));
      const sailing = submission.orders.filter(isMoveOrder);
      const inAfrica = Object.values(start.units).filter((entry) => entry.factionId === south && ["ceuta", "melilla"].includes(entry.territoryId));
      expect(sailing.map((order) => order.unitId).sort()).toEqual(inAfrica.map((entry) => entry.id).sort());
      expect(sailing.every((order) => order.to === territory("andalucia"))).toBe(true);
      expect(balanceLeft(context(start, south, submission.orders))["manpower" as never]).toBe(5);
      const result = resolveTurn(scenario, start, [submission, ...[republic, north].map((factionId) => ({ factionId, orders: [] }))], seed);
      const fought = battlesOf(result).filter((battle) => JSON.stringify(battle.site).includes("andalucia"));
      expect(fought.map((battle) => battle.attackerFactionId)).toEqual([south]);
    }
  });
});

describe("development's share of the Build orders (D6)", () => {
  it("queues the development target first, ahead of every unlock and on the ordinary budget", () => {
    for (const factionId of [republic, north, south]) {
      const target = developmentTarget(context(start, factionId))!;
      for (const state of [start, funded(start, factionId, 200, 50)]) {
        const recruits = planRecruits(context(state, factionId));
        expect(planBuilds(context(state, factionId, recruits))[0]).toEqual(target.order);
      }
    }
  });
});
