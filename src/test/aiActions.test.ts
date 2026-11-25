import { requireAiProfile } from "../main/engine/lookup";
import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { planAirMissions } from "../main/ai/orders/air-mission";
import { afterLinkWork, linkWorkCandidate, linkWorkGain } from "../main/ai/orders/linkWorks";
import { legalMoves, withRoutes } from "../main/ai/orders/move";
import type { PlanningContext } from "../main/ai/orders/planner";
import { planRecruits } from "../main/ai/orders/recruit";
import { assess } from "../main/ai/assessment";
import { movePlanningView } from "../main/ai/planningView";
import { motorPays, unitRoutes } from "../main/ai/reach";
import { marginalGain, recruitBoard, siteBattles } from "../main/ai/unitWorth";
import { moveRoutes } from "../main/engine/movement/routes";
import { linkBetween, linkKey, linkModifiers, linksOf, railOn, territoryOfSub } from "../main/engine/network/links";
import { seededRandom } from "../main/engine/random";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import { type FactionId, type GameState, isMoveOrder, type LinkModifier, type LinkWork, type MoveOrder, type Order, type Resources, type Scenario, type TurnOutcome, type UnitId } from "../main/engine/types";
import { isTruckType } from "../main/engine/units/fighting";
import { holdWhole } from "./air/holdWhole";
import { faction, move, spainWithAir, territory, unit, withUnits } from "./support";
import { pinned } from "./pinned";

// R12: the computer player's new choices, case by case: March for a foot unit where trucks
// can't follow, trucks only where Motor pays, Ground Support weighed by the air battle, Patrol
// over threatened ground, and link works only where they open a route.

const scenario = pinned(spainWithAir());
const start = initialGameState(scenario);
const republic = faction("republic");

function context(state: GameState, factionId: FactionId = republic, planned: readonly Order[] = [], target: Scenario = scenario): PlanningContext {
  return { factionId, memory: {}, planned, random: seededRandom(1), scenario: target, state };
}

function republicBut(state: GameState, others: Readonly<Record<string, string>> = {}): GameState {
  let board = state;
  for (const entry of scenario.territories) board = holdWhole(scenario, board, entry.id, faction(others[entry.id] ?? "republic"));
  return board;
}

/** A raised unit of the type, for the faction, in the territory. */
function raise(state: GameState, factionId: string, type: string, territoryId: string, serial = 1): GameState {
  const id = raisedUnitId(faction(factionId), type as never, serial);
  return {
    ...state,
    raised: { ...state.raised, [id]: { factionId: faction(factionId), fullStrength: 300, id, name: type, type: type as never } },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}
const truckId = raisedUnitId(republic, "truck-column" as never, 1);

/** Every link between the two territories rebuilt with `modifiers`. */
function relink(state: GameState, a: string, b: string, modifiers: readonly LinkModifier[]): GameState {
  const pair = new Set([a, b]);
  const between = scenario.links.filter((link) => pair.has(territoryOfSub(scenario, link.a) ?? "") && pair.has(territoryOfSub(scenario, link.b) ?? "") && territoryOfSub(scenario, link.a) !== territoryOfSub(scenario, link.b));
  return { ...state, builtLinks: { ...state.builtLinks, ...Object.fromEntries(between.map((link) => [linkKey(link.a, link.b), modifiers])) } };
}

describe("March, Motor and the foot rule (R5)", () => {
  // Madrid and Castilla-La Mancha joined only by links with no road: foot units cross, trucks don't.
  // Without rail rules, so no ride goes round.
  const noRail: Scenario = { ...scenario, linkModifiers: Object.fromEntries(Object.entries(scenario.linkModifiers).filter(([kind]) => kind !== "rail")) };
  const roadless = relink(raise(republicBut(withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-covadonga-4", "republic", "madrid"]])), "republic", "truck-column", "madrid"), "madrid", "castilla-la-mancha", []);
  const regiment = roadless.units[unit("rep-wad-ras-1")];

  it("keeps a foot unit's March where its trucks can't follow", () => {
    if (regiment === undefined) throw new Error("missing regiment");
    expect(moveRoutes(noRail, roadless, republic, territory("madrid"), [regiment.id, truckId]).has(territory("castilla-la-mancha"))).toBe(false);
    expect(unitRoutes(noRail, roadless, regiment).get(territory("castilla-la-mancha"))?.mode).toBe("march");
    expect(legalMoves(noRail, roadless, regiment).some((order) => order.to === territory("castilla-la-mancha"))).toBe(true);
  });

  it("sends trucks with no single step, not even four with a lone militia column", () => {
    const planned = [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")];
    expect(withRoutes(noRail, roadless, republic, planned)).toEqual(planned);
    // With a road, the step still needs no trucks.
    const road = relink(roadless, "madrid", "castilla-la-mancha", [{ kind: "road", level: "track" }]);
    expect(withRoutes(noRail, road, republic, planned)).toEqual(planned);
    const four = [1, 2, 3, 4].reduce((state, serial) => raise(state, "republic", "truck-column", "madrid", serial), withUnits(scenario, [["rep-madrid-sierra-column", "republic", "madrid"], ["north-zamora-29", "north", "castilla-y-leon"]]));
    const lone = [move("republic", "rep-madrid-sierra-column", "madrid", "castilla-y-leon")];
    expect(withRoutes(scenario, four, republic, lone)).toEqual(lone);
    expect(generateComputerSubmission(scenario, four, republic, seededRandom(1)).orders.filter((order) => isMoveOrder(order) && order.unitId.includes("truck"))).toEqual([]);
  });

  it("sends only as many trucks as the army's foot needs, to the largest army first", () => {
    const foot = ["rep-wad-ras-1", "rep-covadonga-4", "rep-madrid-sierra-column"];
    const held = [1, 2, 3].reduce((state, serial) => raise(state, "republic", "truck-column", "madrid", serial), republicBut(withUnits(scenario, foot.map((id) => [id, "republic", "madrid"] as const))));
    const march = (id: string, to: string): MoveOrder => ({ ...move("republic", id, "madrid", to), legs: [{ kind: "land", to: territory("castilla-la-mancha") }, { kind: "land", to: territory(to) }] });
    const trucksTo = (orders: readonly MoveOrder[], to: string) => withRoutes(noRail, held, republic, orders).filter((order) => order.to === to && order.unitId.includes("truck")).length;
    expect([1, 2, 3].map((count) => trucksTo(foot.slice(0, count).map((id) => march(id, "valencia")), "valencia"))).toEqual([1, 1, 2]);
    const split = [march("rep-wad-ras-1", "extremadura"), march("rep-covadonga-4", "valencia"), march("rep-madrid-sierra-column", "valencia")];
    expect([trucksTo(split, "valencia"), trucksTo(split, "extremadura")]).toEqual([1, 1]);
    // One truck left: the largest army gets it, the other is cut to its first step.
    const two = withRoutes(noRail, { ...held, units: Object.fromEntries(Object.entries(held.units).filter(([id]) => !id.endsWith("_2") && !id.endsWith("_3"))) }, republic, split);
    expect(two.filter((order) => order.to === "valencia")).toHaveLength(3);
    expect(two.find((order) => order.unitId === unit("rep-wad-ras-1"))?.to).toBe("castilla-la-mancha");
  });

  it("checks the planned moves as the game routes them, dropping or cutting those it can't", () => {
    const held = republicBut(withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-covadonga-4", "republic", "madrid"]]));
    const land = (to: string) => ({ kind: "land" as const, to: territory(to) });
    // No route at all to the islands: dropped. A unit the board doesn't have keeps its order as planned.
    const islands = move("republic", "rep-wad-ras-1", "madrid", "islas-baleares");
    const ghost = move("republic", "rep-nobody", "madrid", "castilla-la-mancha");
    expect(withRoutes(noRail, held, republic, [islands, ghost])).toEqual([ghost]);
    // A two-territory march without trucks is cut to its first step.
    const far = { ...move("republic", "rep-wad-ras-1", "madrid", "valencia"), legs: [land("castilla-la-mancha"), land("valencia")] };
    expect(withRoutes(noRail, held, republic, [far])).toEqual([{ ...far, legs: [land("castilla-la-mancha")], to: territory("castilla-la-mancha") }]);
    // One round by Castilla-La Mancha to a neighbour becomes the plain step there.
    const round = { ...move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon"), legs: [land("castilla-la-mancha"), land("castilla-y-leon")] };
    expect(withRoutes(noRail, held, republic, [round])).toEqual([move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")]);
  });

  it("says where trucks pay: a Motor road two territories on", () => {
    const held = republicBut(start);
    expect(motorPays(scenario, held, republic, territory("madrid"))).toBe(true);
    // Track roads only: no Motor anywhere.
    const tracks: GameState = { ...held, builtLinks: Object.fromEntries(scenario.links.map((link) => [linkKey(link.a, link.b), [{ kind: "road", level: "track" }] as const])) };
    expect(motorPays(scenario, tracks, republic, territory("madrid"))).toBe(false);
    expect(motorPays({ ...scenario, links: [] }, tracks, republic, territory("madrid"))).toBe(true);
  });

  // Only trucks can be recruited, and the North stands in Valencia, two territories from Madrid by road.
  const trucksOnly: Scenario = { ...scenario, unitTypes: scenario.unitTypes.filter(isTruckType) };
  const foot = "infantry-regiment";
  const trainees = (...types: readonly string[]): GameState["training"] => types.map((typeId, index) => ({ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: typeId as never, unitId: unit(`trainee-${String(index)}`) }));
  const board = (training: GameState["training"], standing: readonly (readonly [string, string])[] = [], enemyIn = "valencia"): GameState => {
    const held = republicBut(withUnits(scenario, [["north-argel-27", "north", enemyIn]]), { [enemyIn]: "north" });
    const stood = standing.reduce((state, [type, at], index) => raise(state, "republic", type, at, index + 1), held);
    return { ...stood, training, treasuries: { ...stood.treasuries, [republic]: { funds: 60, manpower: 50 } as Resources } };
  };
  const trucksIn = (state: GameState, memory: PlanningContext["memory"] = {}, target: Scenario = trucksOnly, planned: readonly Order[] = []) =>
    planRecruits({ ...context(state, republic, planned, target), memory }).filter((order) => order.unitTypeId === "truck-column");
  const tracked = (state: GameState): GameState => ({ ...state, builtLinks: Object.fromEntries(scenario.links.map((link) => [linkKey(link.a, link.b), [{ kind: "road", level: "track" }] as const])) });

  it("recruits a truck for foot that a Motor road takes to a battle sooner, one a turn", () => {
    const ready = board(trainees(foot, foot));
    const standing = board([], [[foot, "madrid"], [foot, "madrid"]]);
    expect(trucksIn(standing).map((order) => order.territoryId)).toEqual(["madrid"]);
    expect(trucksIn(ready).map((order) => order.territoryId)).toEqual(["madrid"]);
    expect(trucksIn(board(trainees(foot, foot, foot, foot)))).toHaveLength(1);
    // No Motor road, no trucks; without links every two steps are Motor.
    expect(trucksIn(tracked(ready))).toEqual([]);
    expect(trucksIn(tracked(ready), {}, { ...trucksOnly, links: [] })).toHaveLength(1);
    // With nobody to fight, or the battle next door, the foot gets there as soon on its own.
    const quiet = Object.fromEntries(Object.entries(ready.units).filter(([, entry]) => entry.factionId === republic));
    expect(trucksIn({ ...ready, units: quiet })).toEqual([]);
    expect(trucksIn(board(trainees(foot, foot), [], "castilla-la-mancha"))).toEqual([]);
    // Foot this turn's orders take away has no use for a truck that trains meanwhile; foot they bring has.
    const marchers = [1, 2].map((serial) => raisedUnitId(republic, foot as never, serial));
    const going = (from: string, to: string) => marchers.map((id) => move("republic", id, from, to));
    expect(trucksIn(standing, {}, trucksOnly, going("madrid", "castilla-y-leon")).map((order) => order.territoryId)).not.toContain("madrid");
    const coming = board([], [[foot, "castilla-la-mancha"], [foot, "castilla-la-mancha"]]);
    expect(trucksIn(coming)).toEqual([]);
    expect(trucksIn(coming, {}, trucksOnly, going("castilla-la-mancha", "madrid")).map((order) => order.territoryId)).toEqual(["madrid"]);
  });

  it("values a truck over the horizon it serves, and only by foot it carries", () => {
    const worth = (state: GameState, on: Scenario = scenario) => {
      const read = recruitBoard(on, state, assess(on, movePlanningView(on, state, republic), republic));
      return marginalGain(read, on.unitTypes.find(isTruckType)!, siteBattles(read, territory("madrid"), []));
    };
    const standing = board([], [[foot, "madrid"], [foot, "madrid"]]);
    const horizon = (turns: number): Scenario => ({ ...scenario, ai: { profiles: Object.fromEntries(Object.entries(scenario.ai.profiles).map(([id, profile]) => [id, { ...profile, recruits: { ...profile.recruits, upkeepHorizon: turns } }])) } });
    // It trains in a turn, so it serves one turn less than the horizon; foot still training uses it later.
    expect(worth(standing)).toBeGreaterThan(0);
    expect(worth(standing, horizon(11)) / worth(standing, horizon(6))).toBeCloseTo(2);
    expect(worth(standing, horizon(1))).toBe(0);
    expect(worth(board(trainees(foot, foot))) / worth(standing)).toBeCloseTo(4 / 5);
    expect(worth(board([], [[foot, "madrid"]]))).toBe(0);
  });

  it("recruits a truck only for foot enough to fill it that nothing there carries", () => {
    const counts = [trainees(foot), trainees(foot, "cavalry-regiment"), trainees(foot, foot, "truck-column"), trainees(foot, foot, "tank-company"), trainees(foot, foot, foot, foot, "truck-column")];
    expect(counts.map((training) => trucksIn(board(training)).length)).toEqual([0, 0, 0, 0, 1]);
  });

  it("recruits no truck while one is idle", () => {
    const ready = trainees(foot, foot);
    // A truck with no foot beside it, and one whose foot no Motor road leaves.
    const loaded = (at: string) => board(ready, [["truck-column", at], [foot, at], [foot, at]]);
    expect(trucksIn(board(ready, [["truck-column", "aragon"]]))).toEqual([]);
    expect(motorPays(scenario, loaded("murcia"), republic, territory("murcia"))).toBe(false);
    expect(trucksIn(loaded("murcia"))).toEqual([]);
    const full = loaded("aragon");
    expect(trucksIn(full)).toHaveLength(1);
    // Last turn it carried foot two territories on, or it did not.
    const [truck, rider] = [raisedUnitId(republic, "truck-column" as never, 1), raisedUnitId(republic, foot as never, 2)];
    const trip = (unitId: UnitId, from = "extremadura", to = "aragon"): TurnOutcome => ({ kind: "successful-move", order: { factionId: republic, from: territory(from), kind: "move", to: territory(to), unitId } });
    const after = (...previousOutcomes: readonly TurnOutcome[]) => trucksIn(full, { previousOutcomes });
    expect(after(trip(truck), trip(rider))).toHaveLength(1);
    expect(after()).toEqual([]);
    expect(after(trip(truck))).toEqual([]);
    expect(after(trip(truck), trip(rider, "murcia"))).toEqual([]);
    expect(after(trip(truck, "catalunya"), trip(rider, "catalunya"))).toEqual([]);
    // A truck that joins an attack carries its foot there too; another faction's trips carry nothing.
    const attack = (attackerFactionId: FactionId, kind = "assault") => ({ attacker: { armies: [truck, rider].map((unitId) => ({ from: territory("extremadura"), unitId })) }, attackerFactionId, kind: "battle", site: { kind, territoryId: territory("aragon") } }) as unknown as TurnOutcome;
    expect([after(attack(republic)), after(attack(faction("north"))), after(attack(republic, "standing"))].map((orders) => orders.length)).toEqual([1, 0, 0]);
    expect(after(...[truck, rider].map((unitId): TurnOutcome => ({ kind: "reinforcement-arrived", order: { factionId: faction("north"), from: territory("extremadura"), kind: "move", to: territory("aragon"), unitId } })))).toEqual([]);
    // One that finished training last turn had no trip to make.
    expect(after({ factionId: republic, kind: "training-completed", territoryId: territory("aragon"), typeId: "truck-column" as never, unitId: truck })).toHaveLength(1);
  });
});

describe("Ground Support and Patrol (R10, R11)", () => {
  const attack = [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon"), move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")];
  const supporting = (orders: readonly Order[]) => orders.flatMap((order) => (order.kind === "air-mission" && order.mission.kind === "support" ? [order.unitId] : []));

  it("flies fighters and bombers together on Ground Support, up to the scenario's cap", () => {
    expect(supporting(planAirMissions(context(start, republic, attack))).sort()).toEqual([unit("rep-breguet-bombers"), unit("rep-ni52-fighters")]);
    const air = scenario.air;
    if (air === undefined) throw new Error("Spain has air rules");
    const one: Scenario = { ...scenario, air: { ...air, supportMax: 1 } };
    expect(supporting(planAirMissions(context(start, republic, attack, one)))).toHaveLength(1);
    const uncapped: Scenario = { ...scenario, air: { ...air, supportMax: undefined } };
    expect(supporting(planAirMissions(context(start, republic, attack, uncapped)))).toHaveLength(2);
  });

  it("gives no support to a move into empty ground", () => {
    const empty: GameState = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([, entry]) => entry.territoryId !== "castilla-y-leon")) };
    expect(supporting(planAirMissions(context(empty, republic, attack)))).toEqual([]);
  });

  const guarded = raise(start, "north", "anti-air-battery", "castilla-y-leon");
  /** The scenario with the Republic's `air.supportChance`, and the cap on Ground Support. */
  const daring = (supportChance: number, supportMax = scenario.air?.supportMax): Scenario => {
    const { ai, air } = scenario;
    if (air === undefined) throw new Error("Spain has air rules");
    return { ...scenario, ai: { ...ai, profiles: { ...ai.profiles, [republic]: { ...requireAiProfile(scenario, republic), air: { supportChance } } } }, air: { ...air, supportMax } };
  };

  it("flies over the defenders' anti-air only while its support applies with the profile's chance", () => {
    const orders = (supportChance: number, supportMax?: number) => planAirMissions(context(guarded, republic, attack, daring(supportChance, supportMax)));
    // Against AA of 3 the attacker wins the air with a bomber (+1) on 6 faces of 20, a fighter (+2) on 7, and the two on 8.
    expect(requireAiProfile(scenario, republic).air.supportChance).toBe(0.35);
    expect(supporting(orders(0.35, 1))).toEqual([unit("rep-ni52-fighters")]);
    expect(supporting(orders(0.36, 1))).toEqual([]);
    expect(supporting(orders(0.41))).toEqual([]);
    expect(orders(0.41).find((order) => order.unitId === "rep-ni52-fighters")?.mission.kind).toBe("patrol");
  });

  it("sends the aircraft that only pay together", () => {
    // Neither alone reaches 8 faces of 20; the pair does. The bomber comes first in id order, and alone it would not fly.
    for (const chance of [0.35, 0.4]) expect(supporting(planAirMissions(context(guarded, republic, attack, daring(chance)))).sort()).toEqual([unit("rep-breguet-bombers"), unit("rep-ni52-fighters")]);
  });

  it("sends the combination that adds most on average, and the rest on other missions", () => {
    // Two fighters win the air on 9 faces of 20, a fighter and a bomber on 8; each way adds 6 then.
    const two = raise(guarded, "republic", "fighter-squadron", "madrid");
    const orders = planAirMissions(context(two, republic, attack, daring(0.35)));
    expect(supporting(orders).sort()).toEqual(["r_republic_fighter-squadron_1", "rep-ni52-fighters"].map(unit));
    expect(orders.find((order) => order.unitId === "rep-breguet-bombers")?.mission.kind).toBe("raid");
  });

  it("sends no aircraft that adds nothing: it could only be lost", () => {
    const unitTypes = new Map([...scenario.index.unitTypes].map(([id, type]) => [id, id === "bomber-squadron" ? { ...type, effects: [] } : type]));
    const bare: Scenario = { ...scenario, index: { ...scenario.index, unitTypes } };
    expect(supporting(planAirMissions(context(start, republic, attack, bare)))).toEqual([unit("rep-ni52-fighters")]);
  });

  it("backs the biggest attack first, and the next with what is left", () => {
    const both = [...attack, move("republic", "rep-madrid-security", "madrid", "andalucia")];
    const targets = planAirMissions(context(start, republic, both, daring(0.35, 1))).flatMap(({ mission, unitId }) => (mission.kind === "support" ? [[unitId, mission.territoryId]] : []));
    expect(targets).toEqual([["rep-breguet-bombers", "castilla-y-leon"], ["rep-ni52-fighters", "andalucia"]]);
  });

  it("patrols threatened ground, and its base when nothing is", () => {
    const patrol = (state: GameState) => {
      const mission = planAirMissions(context(state)).find((order) => order.unitId === "rep-ni52-fighters")?.mission;
      return mission?.kind === "patrol" ? mission.territoryId : undefined;
    };
    // No enemy aircraft, and a Republican army in Castilla-La Mancha with the North next door in Extremadura.
    const front = republicBut(withUnits(scenario, [["rep-ni52-fighters", "republic", "madrid"], ["rep-wad-ras-1", "republic", "castilla-la-mancha"], ["north-argel-27", "north", "extremadura"]]), { extremadura: "north" });
    expect(patrol(front)).toBe(territory("castilla-la-mancha"));
    const quiet = republicBut(withUnits(scenario, [["rep-ni52-fighters", "republic", "madrid"], ["rep-wad-ras-1", "republic", "castilla-la-mancha"]]));
    expect(patrol(quiet)).toBe(territory("madrid"));
  });
});

describe("link works (R7)", () => {
  const regiments = scenario.units.filter((entry) => entry.factionId === republic && scenario.index.unitTypes.get(entry.type)?.kind === "ground");
  const spread = republicBut(withUnits(scenario, scenario.territories.map((entry, index) => [regiments[index]?.id ?? "", "republic", entry.id] as const)));
  const everywhere = new Set(scenario.territories.map((entry) => entry.id));
  const money = { funds: 100 } as Resources;
  const only = (work: LinkWork): Scenario => {
    const projects = scenario.linkProjects;
    if (projects === undefined) throw new Error("Spain has link projects");
    return { ...scenario, linkProjects: Object.fromEntries(Object.entries(projects).map(([id, cost]) => [id, id === work ? cost : { ...cost, cost: { funds: 9999 } }])) as NonNullable<Scenario["linkProjects"]> };
  };
  const candidate = (state: GameState, target: Scenario, budget: Resources = money) => linkWorkCandidate({ factionId: republic, scenario: target, state }, everywhere, budget);

  it("queues none without link projects, while one of its own is queued, or beyond the budget", () => {
    expect(candidate(spread, scenario)).toBeDefined();
    const unbuildable = Object.fromEntries(Object.entries(scenario).filter(([key]) => key !== "linkProjects")) as unknown as Scenario;
    expect(candidate(spread, unbuildable)).toBeUndefined();
    expect(candidate(spread, scenario, { funds: 1 } as Resources)).toBeUndefined();
    const picked = candidate(spread, scenario);
    const site = picked === undefined ? undefined : spread.subTerritories[picked.order.subTerritoryId];
    if (picked === undefined || site === undefined) throw new Error("no link work");
    const queued: GameState = { ...spread, subTerritories: { ...spread.subTerritories, [picked.order.subTerritoryId]: { ...site, queue: [{ factionId: republic, paid: {}, progress: 0, project: picked.order.project }] } } };
    expect(candidate(queued, scenario)).toBeUndefined();
  });

  it("upgrades roads only for a faction with trucks", () => {
    expect(candidate(spread, only("road-upgrade"))).toBeUndefined();
    expect(candidate(raise(spread, "republic", "truck-column", "madrid"), only("road-upgrade"))?.order.project).toMatchObject({ kind: "link", work: "road-upgrade" });
  });

  it("counts nothing gained where no army would use the route", () => {
    const link = scenario.links.find((entry) => railOn(start, entry) === "single");
    if (link === undefined) throw new Error("no single line");
    expect(linkWorkGain(scenario, spread, republic, link, "rail-upgrade", [], everywhere)).toBe(0);
    expect(linkWorkGain(scenario, spread, republic, link, "rail-upgrade", [territory("madrid")], new Set())).toBe(0);
  });

  it("models a finished work as the queue completes it", () => {
    // A link with no rail between two sub-territories no railway reaches: a new line opens both stations.
    const unrailed = (sub: string) => linksOf(scenario, sub as never).every(({ link: other }) => railOn(start, other) === undefined);
    const link = scenario.links.find((entry) => unrailed(entry.a) && unrailed(entry.b));
    if (link === undefined) throw new Error("no link without rail");
    const closed: GameState = { ...start, subTerritories: { ...start.subTerritories, [link.a]: { ...start.subTerritories[link.a]!, rail: 0 }, [link.b]: { ...start.subTerritories[link.b]!, rail: 0 } } };
    const railed = afterLinkWork(scenario, closed, link, "new-rail");
    expect(railOn(railed, link)).toBe("single");
    expect(railed.subTerritories[link.a]?.rail).toBe(1);
    // A work that doesn't fit leaves the link as it is.
    const twice = afterLinkWork(scenario, railed, link, "new-rail");
    expect(linkModifiers(link, twice)).toEqual(linkModifiers(link, railed));
    expect(linkBetween(scenario, link.a, link.b)).toBe(link);
  });
});

