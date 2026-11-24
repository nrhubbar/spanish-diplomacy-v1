import { describe, expect, it } from "vitest";
import { planAirMissions } from "../main/ai/orders/air-mission";
import { afterLinkWork, linkWorkCandidate, linkWorkGain } from "../main/ai/orders/linkWorks";
import { legalMoves, withRoutes } from "../main/ai/orders/move";
import type { PlanningContext } from "../main/ai/orders/planner";
import { planRecruits } from "../main/ai/orders/recruit";
import { motorPays, unitRoutes } from "../main/ai/reach";
import { moveRoutes } from "../main/engine/movement/routes";
import { linkBetween, linkKey, linkModifiers, linksOf, railOn, territoryOfSub } from "../main/engine/network/links";
import { seededRandom } from "../main/engine/random";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type { FactionId, GameState, LinkModifier, LinkWork, Order, Resources, Scenario } from "../main/engine/types";
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

  it("sends trucks only with an army whose route they may take", () => {
    const planned = [move("republic", "rep-wad-ras-1", "madrid", "castilla-la-mancha")];
    const routed = withRoutes(noRail, roadless, republic, planned);
    expect(routed.map((order) => order.unitId)).toEqual([unit("rep-wad-ras-1")]);
    // With a road, the trucks go along.
    const road = relink(roadless, "madrid", "castilla-la-mancha", [{ kind: "road", level: "track" }]);
    expect(withRoutes(noRail, road, republic, planned).map((order) => order.unitId)).toContain(truckId);
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

  it("recruits trucks only where Motor pays", () => {
    const rich = (state: GameState): GameState => ({ ...state, treasuries: { ...state.treasuries, [republic]: { funds: 200, manpower: 50 } as Resources } });
    const held = rich(republicBut(withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["rep-covadonga-4", "republic", "madrid"], ["north-argel-27", "north", "valencia"]]), { valencia: "north" }));
    const trucks = (state: GameState) => planRecruits(context(state)).filter((order) => order.unitTypeId === "truck-column");
    expect(trucks(held).length).toBeGreaterThan(0);
    const tracks: GameState = { ...held, builtLinks: Object.fromEntries(scenario.links.map((link) => [linkKey(link.a, link.b), [{ kind: "road", level: "track" }] as const])) };
    expect(trucks(tracks)).toEqual([]);
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

  it("keeps its aircraft off a battle whose air it would likely lose to the defenders' anti-air", () => {
    const guarded = raise(start, "north", "anti-air-battery", "castilla-y-leon");
    const orders = planAirMissions(context(guarded, republic, attack));
    expect(supporting(orders)).toEqual([]);
    expect(orders.find((order) => order.unitId === "rep-ni52-fighters")?.mission.kind).toBe("patrol");
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

