import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { buildReserve, developmentTarget, planBuilds } from "../main/ai/orders/build";
import { planDisbands } from "../main/ai/orders/disband";
import { planRecruits } from "../main/ai/orders/recruit";
import { planReplenishment } from "../main/ai/orders/replenish";
import { balanceLeft, starves } from "../main/ai/orders/spending";
import { raidGain } from "../main/ai/airWorth";
import { assess } from "../main/ai/assessment";
import { movePlanningView } from "../main/ai/planningView";
import { marginalGain, nextRollBonus, priceOf, recruitBoard, recruitSupply, siteBattles, smoothOdds, worthOf } from "../main/ai/unitWorth";
import { battleOdds } from "../main/engine/d20/odds";
import { upkeepProblem } from "../main/engine/economy/upkeep";
import { requireAiProfile } from "../main/engine/lookup";
import { projectedHoldings, upkeepShortfall } from "../main/engine/economy/upkeep";
import { seededRandom } from "../main/engine/random";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { type GameState, isMoveOrder, type Order, type RecruitOrder, type Resources, type Scenario, type UnitTypeDefinition } from "../main/engine/types";
import { fortified, revFourNumbers } from "./pinned";
import { demoralize, heldWhole, oneShortOwners, type Placement } from "./aiBoards";
import { armyIn, battlesOf, faction, spain, territory, unit, withUnits, withoutUpkeep } from "./support";

// The rankings below were written against the Rev 4 prices and yields, so they do not move with the shipped ones.
const scenario = revFourNumbers(spain());
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

  it("holds nothing back for builds at two steps or fewer", () => {
    const calm = planRecruits(context(board(far), north));
    const left = balanceLeft(context(board(far), north, calm));
    expect(left["funds" as never]).toBeGreaterThanOrEqual(buildReserve(context(board(far), north), { funds: 24, manpower: 24 } as never)["funds" as never]!);
    const hurried = planRecruits(context(board({ ...oneShortOwners, extremadura: "south" }), north));
    expect(balanceLeft(context(board(far), north, hurried))["funds" as never]).toBeLessThan(left["funds" as never]!);
    expect(hurried.length).toBeGreaterThan(0);
  });

  it("buys units that train in one turn first only where the leader would likely take the site", () => {
    const owners = { ...oneShortOwners, extremadura: "south" };
    const attackers: Placement = ["rep-vitoria-8", "rep-sevilla-34", "rep-castilla-3", "rep-otumba-9", "rep-wad-ras-1"].map((id) => [id, "republic", "asturias"] as const);
    const trained = (placement: Placement) => planRecruits(context(funded(heldWhole(scenario, owners, placement), north, 200, 60), north))
      .filter((order) => order.territoryId === "galicia")
      .map((order) => scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.trainingTurns);
    // Five regiments against one: a quick defender first. One militia column against it: whatever is worth most.
    expect(trained([...units, ...attackers])[0]).toBe(1);
    expect(trained(units)[0]).toBeGreaterThan(1);
  });

  it("buys by worth at a site the leader is nowhere near", () => {
    // Only the leader's neighbours hurry: the Balearics, beyond its units' reach, do not.
    const state = funded(heldWhole(scenario, { ...oneShortOwners, catalunya: "north", "islas-baleares": "north", valencia: "south", extremadura: "republic", murcia: "south", "la-rioja": "republic", navarra: "republic" }, [["north-aragon-17", "north", "islas-baleares"]]), north, 200, 200);
    expect(planRecruits(context(state, north)).length).toBeGreaterThan(0);
  });
});

describe("mixed armies (D6)", () => {
  it("reads the odds table, smoothed between its steps", () => {
    const at = (attack: number, defence: number, roll = 0) => battleOdds(scenario.d20, attack, defence, [{ kind: "odds-overflow", roll }]).takeChance;
    for (const [attack, defence] of [[1, 1], [2, 1], [6, 1], [1, 3]] as const) expect(smoothOdds(scenario.d20, attack / defence, 0).takeChance).toBeCloseTo(at(attack, defence));
    const between = smoothOdds(scenario.d20, 4 / 3, 2);
    expect(between.takeChance).toBeCloseTo(at(1, 1, 2) + (at(2, 1, 2) - at(1, 1, 2)) / 3);
    expect(between.gainChance).toBeGreaterThan(between.takeChance);
    expect(between.expected.defenderLoss).toBeGreaterThan(smoothOdds(scenario.d20, 1, 2).expected.defenderLoss);
    // Beyond the table's ends nothing more changes.
    expect(smoothOdds(scenario.d20, 100, 0).takeChance).toBe(smoothOdds(scenario.d20, 6, 0).takeChance);
    expect(smoothOdds(scenario.d20, 0.001, 0).expected).toEqual(smoothOdds(scenario.d20, 1 / 16, 0).expected);
  });

  it("counts what one more gun or tank adds, until the effect's most", () => {
    expect([0, 1, 2, 3].map((count) => nextRollBonus(typeOf("artillery-group"), count))).toEqual([1, 1, 1, 0]);
    expect([0, 1, 2].map((count) => nextRollBonus(typeOf("tank-company"), count))).toEqual([1, 1, 0]);
    expect(nextRollBonus(typeOf("infantry-regiment"), 0)).toBe(0);
    // Guns help an attack, not a defence. Ground Support is the battle's (airWorth.test.ts).
    expect(["artillery-group", "bomber-squadron"].map((id) => nextRollBonus(typeOf(id), 0, "defence"))).toEqual([0, 0]);
    expect(nextRollBonus(typeOf("bomber-squadron"), 0)).toBe(0);
  });

  const own: Placement = [["rep-vitoria-8", "republic", "madrid"], ["rep-sevilla-34", "republic", "madrid"], ["rep-castilla-3", "republic", "madrid"]];
  const stack: Placement = [["north-san-marcial-22", "north", "castilla-y-leon"], ["north-san-quintin-25", "north", "castilla-y-leon"]];
  const boardOf = (state: GameState, factionId = republic) => recruitBoard(scenario, state, assess(scenario, movePlanningView(scenario, state, factionId), factionId));
  const site = (placement: Placement, ordered: readonly RecruitOrder[] = [], at = "madrid") => {
    const board = boardOf(withUnits(scenario, placement));
    const near = siteBattles(board, territory(at), ordered);
    return {
      board,
      gain: (id: string) => marginalGain(board, typeOf(id), near),
      near,
      worth: (id: string, supply: Resources = { funds: 127, manpower: 95 } as Resources) => worthOf(board, typeOf(id), supply, near)
    };
  };
  const ordered = (id: string, count: number): readonly RecruitOrder[] => Array.from({ length: count }, () => ({ factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: typeOf(id).id }));

  it("values each kind of unit by what one more changes in an even battle", () => {
    const { gain, near, worth } = site([...own, ...stack]);
    expect(near.battles.map(({ distance, enemy, own: value, role }) => ({ distance, enemy, role, value }))).toEqual([
      { distance: 1, enemy: 12, role: "attack", value: 12 },
      { distance: 0, enemy: 8, role: "defence", value: 18 }
    ]);
    // Two guns to three regiments: a gun is worth more to the attack than a regiment's own attack, and any is worth more than a security force.
    expect(gain("artillery-group")).toBeGreaterThan(gain("infantry-regiment"));
    for (const id of ["infantry-regiment", "artillery-group", "tank-company", "colonial-veterans"]) expect(worth(id), id).toBeGreaterThan(2 * worth("security-forces"));
    expect(worth("security-forces")).toBeGreaterThan(worth("militia-column"));
    expect(worth("cavalry-regiment")).toBeGreaterThan(worth("security-forces"));
    expect(Math.max(worth("bomber-squadron"), worth("fighter-squadron"))).toBeGreaterThan(worth("artillery-group"));
    expect(gain("infantry-regiment")).toBeGreaterThan(gain("cavalry-regiment"));
    // Anti-air only ever adds its own defence, and trucks, recon and generals nothing to a battle.
    expect(gain("anti-air-battery")).toBeLessThan(gain("security-forces"));
    expect(["truck-column", "recon-flight", "general"].map((id) => worth(id))).toEqual([0, 0, 0]);
  });

  it("counts a bonus until its most, over units ordered and in training too", () => {
    expect(site([...own, ...stack], ordered("artillery-group", 3)).gain("artillery-group")).toBeLessThan(site([...own, ...stack], ordered("artillery-group", 2)).gain("artillery-group") / 2);
    // Two squadrons of any kind fill a battle's Ground Support.
    const flown = site([...own, ...stack], [...ordered("bomber-squadron", 1), ...ordered("fighter-squadron", 1)]);
    expect(flown.gain("fighter-squadron")).toBe(0);
    // A bomber more would still raid.
    expect(flown.gain("bomber-squadron")).toBe(raidGain(flown.board, typeOf("bomber-squadron"), flown.near));
    const state: GameState = { ...withUnits(scenario, [...own, ...stack]), training: [{ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: typeOf("artillery-group").id, unitId: unit("new-gun") }] };
    expect(siteBattles(boardOf(state), territory("madrid"), []).count(typeOf("artillery-group"))).toBe(1);
  });

  it("counts defence only where enemies stand next door, attack only where it can strike", () => {
    // An undefended site beside a stack: any defender first, and one that trains in a turn gains most, for more upkeep.
    const empty = site(stack);
    expect(empty.gain("security-forces")).toBeGreaterThan(empty.gain("infantry-regiment"));
    expect(empty.worth("infantry-regiment")).toBeGreaterThan(empty.worth("security-forces"));
    // With Manpower to burn, its upkeep weighs little, and the quick defender is the best buy.
    expect(empty.worth("security-forces", { funds: 20, manpower: 2000 } as Resources)).toBeGreaterThan(empty.worth("infantry-regiment", { funds: 20, manpower: 2000 } as Resources));
    // A demoralized enemy stands there but attacks nobody this turn.
    const shaken = boardOf(demoralize(withUnits(scenario, stack), stack.map(([id]) => id)));
    expect(siteBattles(shaken, territory("madrid"), []).battles.filter((battle) => battle.role === "defence").every((battle) => battle.enemy === 0)).toBe(true);
    expect(siteBattles(shaken, territory("madrid"), []).battles.some((battle) => battle.role === "attack" && battle.enemy > 0)).toBe(true);
    // Only what stands there by the next turn defends a site about to fall.
    const slow = siteBattles(boardOf(withUnits(scenario, stack)), territory("madrid"), [...ordered("infantry-regiment", 1), ...ordered("security-forces", 1)]);
    expect([slow.defence, slow.ready]).toEqual([12, 6]);
    // A gun alone attacks nothing: with no unit to lead it, only its defence counts.
    const rear = site([["north-zamora-29", "north", "galicia"], ["rep-vitoria-8", "republic", "murcia"]], [], "valencia");
    expect(rear.near.battles.every((battle) => battle.role === "attack")).toBe(true);
    expect(rear.gain("infantry-regiment")).toBeGreaterThan(0);
    const unled = site([["north-zamora-29", "north", "galicia"]], [], "valencia");
    expect(unled.gain("artillery-group")).toBe(0);
    expect(unled.gain("infantry-regiment")).toBeGreaterThan(0);
    // Beyond its range an aircraft supports nothing; the cavalry's pace counts over a distance.
    expect(site([["north-zamora-29", "north", "galicia"], ["rep-vitoria-8", "republic", "islas-baleares"]], [], "islas-baleares").gain("fighter-squadron")).toBe(0);
    expect(rear.gain("cavalry-regiment") / 3).toBeGreaterThan(rear.gain("infantry-regiment") / 4);
    // With nobody to fight, nothing is worth training.
    expect(site(own).worth("infantry-regiment")).toBe(0);
  });

  it("prices upkeep over the horizon, and a scarce resource dearly", () => {
    const supply = { funds: 100, manpower: 100 } as Resources;
    expect(priceOf(typeOf("security-forces"), supply, 6)).toBeCloseTo(0.04 + 0.07);
    expect(priceOf(typeOf("infantry-regiment"), supply, 6)).toBeCloseTo(0.05 + 0.025);
    expect(priceOf(typeOf("infantry-regiment"), {}, 6)).toBeCloseTo(7.5);
    // The opening: the North's Manpower still outruns its upkeep, near as plentiful as its Funds; the South's runs out and is worth its weight.
    const opening = (factionId: typeof north) => recruitSupply(scenario, start, boardOf(start, factionId).assessment, []);
    expect(opening(south)["manpower" as never]).toBe(1);
    expect(opening(north)["manpower" as never]).toBeCloseTo(48.4);
    expect(opening(north)["funds" as never]).toBeCloseTo(51);
  });

  it("buys guns at a Barracks and Factory site that faces a city stack, and foot before security on the opening board", () => {
    const city: Placement = [...own, ...["rep-otumba-9", "rep-wad-ras-1"].map((id) => [id, "republic", "madrid"] as const), ...["north-san-marcial-22", "north-san-quintin-25", "north-zamora-29", "north-america-23"].map((id) => [id, "north", "castilla-y-leon"] as const)];
    const state = funded(withUnits(scenario, city), republic, 60, 60);
    const madrid = planRecruits(context(state)).filter((order) => order.territoryId === "madrid");
    expect(ids(madrid)).toContain("artillery-group");
    for (const factionId of [republic, north]) {
      const opening = ids(planRecruits(context(start, factionId)));
      expect(opening).toContain("infantry-regiment");
      expect(opening).not.toContain("security-forces");
    }
  });

  it("prices what is left as a turn's orders pile up", () => {
    // A fortified Madrid, whose battles make a tank and a gun close to each other in worth.
    const rich = funded(fortified(start, "madrid", "barcelona"), republic, 200, 60);
    const board = boardOf(rich);
    const orders = planRecruits(context(rich));
    const last = orders.map((order) => `${order.territoryId} ${order.unitTypeId}`).lastIndexOf("madrid artillery-group");
    const before = orders.slice(0, last);
    const near = siteBattles(board, territory("madrid"), before);
    const left = (taken: readonly RecruitOrder[]): Resources => recruitSupply(scenario, rich, board.assessment, taken);
    const worth = (id: string, taken: readonly RecruitOrder[]) => worthOf(board, typeOf(id), left(taken), near);
    for (const id of ["funds", "manpower"]) expect(left(before)[id as never]).toBeLessThan(left([])[id as never] ?? 0);
    // The tanks and foot taken before it make a tank dearer than a gun, which the stock the turn began with would not.
    expect(worth("tank-company", [])).toBeGreaterThan(worth("artillery-group", []));
    expect(worth("tank-company", before)).toBeLessThan(worth("artillery-group", before));
    // A tank could have been taken instead: one trains in Madrid already, and the stock covers another.
    expect(ids(before.filter((order) => order.territoryId === "madrid"))).toContain("tank-company");
    expect(upkeepProblem(scenario, rich, republic, [...before, ...ordered("tank-company", 1)])).toBeUndefined();
  });

  it("builds combined arms within the support ratio, and counts what is in training", () => {
    const rich = funded(start, republic, 200, 60);
    const orders = planRecruits(context(rich));
    const guns = orders.filter((order) => order.unitTypeId === ("artillery-group" as never));
    const fighters = Object.values(start.units).filter((entry) => entry.factionId === republic).length + orders.length;
    expect(guns.length).toBeGreaterThan(0);
    expect(guns.length * requireAiProfile(scenario, republic).recruits.fightersPerSupport).toBeLessThanOrEqual(fighters);
    expect(new Set(ids(orders)).size).toBeGreaterThan(2);
    expect(orders).toEqual(planRecruits(context(rich)));
    const training = Array.from({ length: 16 }, (_, index) => ({ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: typeOf("artillery-group").id, unitId: unit(`gun-${String(index)}`) }));
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
