import { describe, expect, it } from "vitest";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { planAirMissions } from "../main/ai/orders/air-mission";
import { planBuilds } from "../main/ai/orders/build";
import { linkWorkCandidate } from "../main/ai/orders/linkWorks";
import type { PlanningContext } from "../main/ai/orders/planner";
import { planReplenishment } from "../main/ai/orders/replenish";
import { planSackings } from "../main/ai/orders/sack";
import { planWithdrawals } from "../main/ai/orders/withdraw";
import { generalUnitDefinition } from "../main/engine/generals/identity";
import { armyKey, describeRoute, legsOf } from "../main/engine/movement/routes";
import { type MoveMode, moveModes, reachFor } from "../main/engine/network/reach";
import { seededRandom } from "../main/engine/random";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import {
  type AirMission,
  type BuildOrder,
  type BuildProject,
  type FactionId,
  type GameState,
  isMoveOrder,
  type LinkWork,
  linkWorks,
  type MoveOrder,
  type Order,
  type Resources,
  type Scenario,
  type SubTerritoryId,
  type UnitId
} from "../main/engine/types";
import { holdWhole } from "./air/holdWhole";
import { faction, move, spainWithAir, territory, unit, withUnits } from "./support";

// R12: the coverage guard. Every order kind, air mission, move mode and build project the engine
// knows has a constructed board on which the computer player produces it. The records are keyed
// by the engine's own types, so a new kind fails the typecheck until it has a case here, and the
// runtime lists (`moveModes`, `linkWorks`) are compared with the cases too.

const scenario = spainWithAir();
const start = initialGameState(scenario);
const republic = faction("republic");

function context(state: GameState, factionId: FactionId, planned: readonly Order[] = [], target: Scenario = scenario): PlanningContext {
  return { factionId, memory: {}, planned, random: seededRandom(1), scenario: target, state };
}

const submission = (state: GameState, factionId: FactionId, target: Scenario = scenario): readonly Order[] =>
  generateComputerSubmission(target, state, factionId, seededRandom(1)).orders;

/** Every territory held whole: by the faction named in `others`, else the Republic. */
function republicBut(state: GameState, others: Readonly<Record<string, string>> = {}): GameState {
  let board = state;
  for (const entry of scenario.territories) board = holdWhole(scenario, board, entry.id, faction(others[entry.id] ?? "republic"));
  return board;
}

/** A Republican truck column (a raised unit) in the territory. */
function withTruck(state: GameState, territoryId: string): GameState {
  const id = raisedUnitId(republic, "truck-column" as never, 1);
  return {
    ...state,
    raised: { ...state.raised, [id]: { factionId: republic, fullStrength: 300, id, name: "Trucks", type: "truck-column" as never } },
    units: { ...state.units, [id]: { factionId: republic, fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}

function withStrength(state: GameState, id: string, strength: number): GameState {
  const army = state.units[unit(id)];
  if (army === undefined) throw new Error(`missing ${id}`);
  return { ...state, units: { ...state.units, [army.id]: { ...army, strength } } };
}

const rich = (state: GameState): GameState => ({ ...state, treasuries: { ...state.treasuries, [republic]: { funds: 200, manpower: 50 } as Resources } });

/** Spain where only `work` is affordable among the link works, so the planner's pick is that work. */
function onlyWork(work: LinkWork): Scenario {
  const projects = scenario.linkProjects;
  if (projects === undefined) throw new Error("Spain has link projects");
  const priced = Object.fromEntries(Object.entries(projects).map(([id, cost]) => [id, id === work ? cost : { ...cost, cost: { funds: 9999 } }]));
  return { ...scenario, linkProjects: priced as NonNullable<Scenario["linkProjects"]> };
}

/** The move's mode, read for its whole army (trucks change it), and checked against `reachFor`. */
function modeOf(state: GameState, orders: readonly Order[], order: MoveOrder): MoveMode | undefined {
  const army = orders.filter(isMoveOrder).filter((other) => armyKey(scenario, other) === armyKey(scenario, order)).map((other) => other.unitId);
  const check = describeRoute(scenario, state, order.factionId, order.from, legsOf(scenario, order), true, undefined, army);
  const reach = reachFor(scenario, state, order.factionId, army).get(order.to);
  expect(reach?.ok === true ? reach.mode : undefined).toBe(check.ok ? check.route.mode : "refused");
  return check.ok ? check.route.mode : undefined;
}

/**
 * One Republican regiment in every territory the Republic holds, so every route a link work could
 * open has an army to use it; `others` hold the rest (empty), and trucks stand in Madrid.
 */
function spread(others: Readonly<Record<string, string>> = {}): GameState {
  const regiments = scenario.units.filter((entry) => entry.factionId === republic && scenario.index.unitTypes.get(entry.type)?.kind === "ground");
  const held = scenario.territories.filter((entry) => others[entry.id] === undefined);
  return withTruck(republicBut(withUnits(scenario, held.map((entry, index) => [regiments[index]?.id ?? "", "republic", entry.id] as const)), others), "madrid");
}

const orderCases: Record<Order["kind"], () => readonly Order[]> = {
  "air-mission": () => planAirMissions(context(start, republic)),
  build: () => planBuilds(context(start, republic)),
  move: () => submission(start, republic),
  recruit: () => submission(start, republic),
  replenish: () => {
    const worn = Object.values(start.units).find((entry) => entry.factionId === republic && entry.territoryId === "catalunya");
    if (worn === undefined) throw new Error("no unit in Catalunya");
    return planReplenishment(context(withStrength(start, worn.id, Math.round(worn.strength / 3)), republic));
  },
  sack: () => {
    const pozas = generalUnitDefinition(scenario, "general-sebastian-pozas" as UnitId);
    if (pozas === undefined) throw new Error("no Pozas");
    const units = Object.fromEntries(Object.entries(start.units).filter(([id]) => id !== "rep-general-miaja"));
    const cautious: GameState = {
      ...start,
      raised: { [pozas.id]: pozas },
      units: { ...units, [pozas.id]: { factionId: republic, fatigue: 0, id: pozas.id, morale: { demoralized: false, quietTurns: 0 }, strength: 100, territoryId: territory("madrid") } }
    };
    return planSackings(context(cautious, republic));
  },
  withdraw: () => {
    // Hopeless odds on ground that is neither the North's seat nor an objective.
    const state = withUnits(scenario, [
      ["north-argel-27", "north", "extremadura"],
      ["rep-vitoria-8", "republic", "extremadura"], ["rep-sevilla-34", "republic", "extremadura"], ["rep-castilla-3", "republic", "extremadura"]
    ]);
    return planWithdrawals(context(state, faction("north")));
  }
};

const attack = [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon"), move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")];
const missionCases: Record<AirMission["kind"], () => readonly Order[]> = {
  patrol: () => planAirMissions(context(start, republic)),
  raid: () => planAirMissions(context(start, republic)),
  recon: () => planAirMissions(context(start, republic)),
  support: () => planAirMissions(context(start, republic, attack))
};

const modeCases: Record<MoveMode, () => { readonly orders: readonly Order[]; readonly state: GameState }> = {
  march: () => ({ orders: submission(start, republic), state: start }),
  motor: () => {
    // Trucks in Madrid, and a weak North garrison in Valencia, two territories away by main road.
    const board = withStrength(withTruck(republicBut(withUnits(scenario, [
      ["rep-wad-ras-1", "republic", "madrid"], ["rep-covadonga-4", "republic", "madrid"], ["north-argel-27", "north", "valencia"]
    ]), { valencia: "north" }), "madrid"), "north-argel-27", 5);
    return { orders: submission(board, republic), state: board };
  },
  rail: () => ({ orders: submission(start, republic), state: start }),
  sea: () => ({ orders: submission(start, faction("south")), state: start })
};

/**
 * The board with every capital holding every building it may have, development at its top
 * everywhere and money to spare: only improvements and link works are left to build.
 */
function builtUp(base: GameState): GameState {
  const capitals = new Set(scenario.territories.map((entry) => entry.capitalSubTerritoryId));
  const everything = scenario.buildings.map((building) => building.id);
  const topped = Object.fromEntries(scenario.development.map((track) => [track.id, track.maxLevel]));
  const subTerritories = Object.fromEntries(Object.entries(base.subTerritories).map(([id, site]) => {
    const sub = scenario.index.subTerritories.get(id as SubTerritoryId);
    return [id, capitals.has(id as SubTerritoryId) && sub !== undefined
      ? { ...site, buildings: everything.filter((building) => sub.buildable.includes(building as never)), development: topped }
      : { ...site, development: topped }];
  }));
  return rich({ ...base, subTerritories });
}

/** Spain with a build budget that lets the Republic spend everything, on many sites at once. */
const lavish: Scenario = (() => {
  const profile = scenario.ai.profiles[republic];
  if (profile?.builds === undefined) throw new Error("no build profile");
  const builds = { ...profile.builds, developmentProjects: 0, itemsPerEmptyQueue: 3, maxOrdersPerTurn: 60, spendShare: 1 };
  return { ...scenario, ai: { ...scenario.ai, profiles: { ...scenario.ai.profiles, [republic]: { ...profile, builds } } } };
})();

const projectCases: Record<BuildProject["kind"], () => readonly BuildOrder[]> = {
  building: () => planBuilds(context(rich(start), republic)),
  development: () => submission(start, republic).filter((order): order is BuildOrder => order.kind === "build"),
  improvement: () => planBuilds(context(builtUp(republicBut(start)), republic, [], lavish)),
  // The North holds the north-west: rail upgrades bring the Republic's armies to that front.
  link: () => planBuilds(context(builtUp(spread({ "castilla-y-leon": "north", galicia: "north" })), republic, [], { ...onlyWork("rail-upgrade"), ai: lavish.ai }))
};

const improvementCases: Record<Extract<BuildProject, { kind: "improvement" }>["improvement"], () => readonly BuildOrder[]> = {
  port: () => planBuilds(context(builtUp(republicBut(start)), republic, [], lavish)),
  rail: () => {
    const hub = scenario.index.territories.get(territory("madrid"))?.capitalSubTerritoryId;
    const site = hub === undefined ? undefined : start.subTerritories[hub];
    if (hub === undefined || site === undefined) throw new Error("no Madrid capital");
    return planBuilds(context({ ...start, subTerritories: { ...start.subTerritories, [hub]: { ...site, rail: 0 } } }, republic));
  }
};

describe("the computer player can give every order (R12 coverage guard)", () => {
  it.each(Object.entries(orderCases))("gives a %s order", (kind, produce) => {
    expect(produce().some((order) => order.kind === kind)).toBe(true);
  });

  it.each(Object.entries(missionCases))("flies %s", (kind, produce) => {
    expect(produce().some((order) => order.kind === "air-mission" && order.mission.kind === kind)).toBe(true);
  });

  it("has a case for every move mode, and moves by each", () => {
    expect(Object.keys(modeCases).sort()).toEqual([...moveModes].sort());
    for (const [mode, produce] of Object.entries(modeCases)) {
      const { orders, state } = produce();
      expect(orders.filter(isMoveOrder).map((order) => modeOf(state, orders, order)), mode).toContain(mode);
    }
  });

  it.each(Object.entries(projectCases))("builds a %s project", (kind, produce) => {
    expect(produce().some((order) => order.project.kind === kind)).toBe(true);
  });

  it.each(Object.entries(improvementCases))("improves %s", (improvement, produce) => {
    expect(produce().some((order) => order.project.kind === "improvement" && order.project.improvement === improvement)).toBe(true);
  });

  it("has a case for every link work, and queues each where it opens a route", () => {
    const board = spread();
    const everywhere = new Set(scenario.territories.map((entry) => entry.id));
    const works = linkWorks.map((work) => linkWorkCandidate({ factionId: republic, scenario: onlyWork(work), state: board }, everywhere, { funds: 100 } as Resources)?.order.project);
    expect(works.map((project) => (project?.kind === "link" ? project.work : undefined))).toEqual([...linkWorks]);
  });
});
