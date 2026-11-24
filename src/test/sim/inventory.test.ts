import { describe, expect, it } from "vitest";
import { boardIncome, boardUpkeep, linkKeys, playComputerGame, type PlayedTurn, projectKey, siteKeys, unitTypeIdOf } from "../../sim/engine";
import { playGame } from "../../sim/game";
import { accountOf, createInventory, flows, type Inventory, inventoryColumns, type Measure, measureColumns, measures, openingOf, ordersOf, stocks, stocksOf, tally, turnOf } from "../../sim/inventory";
import { capitalBuildings, capitalOf } from "../../main/engine/recruitment/rules";
import { initialGameState, resolveTurn } from "../../main/engine/resolution";
import { inPoints } from "../../main/engine/carry";
import { upkeepBill, upkeepLines } from "../../main/engine/economy/upkeep";
import type { BuildProject, GameState, Order, QueueItem, Scenario, SubTerritoryId, TrainingItem, TurnOutcome, UnitId } from "../../main/engine/types";
import { faction, spainWithAir, territory, tiny } from "../support";

/** What each game records, against the board it describes and the engine's own functions. */

const scenario = spainWithAir();
const columns = inventoryColumns(scenario);
const republic = faction("republic");
const north = faction("north");
const opening = initialGameState(scenario);

/** One number of a side's record. */
function cell(row: Readonly<Partial<Record<Measure, readonly number[]>>>, measure: Measure, column: string): number | undefined {
  return row[measure]?.[columns[measureColumns[measure]].indexOf(column)];
}
const sum = (row: readonly number[] | undefined): number => (row ?? []).reduce((total, value) => total + value, 0);

const training = (patch: Partial<TrainingItem>): TrainingItem => ({ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: "infantry-regiment" as never, unitId: "t_1" as UnitId, ...patch });
const barracks: BuildProject = { buildingId: "barracks" as never, kind: "building" };
const item = (project: BuildProject, progress: number): QueueItem => ({ factionId: republic, paid: {}, progress, project });
const madrid = capitalOf(scenario, territory("madrid"))!;
const withQueue = (queue: readonly QueueItem[]): GameState => ({ ...opening, subTerritories: { ...opening.subTerritories, [madrid]: { ...opening.subTerritories[madrid]!, queue } } });
const stocksIn = (state: GameState, side = republic) => stocksOf(scenario, columns, state, side);

describe("columns", () => {
  it("lists the scenario's own resources, unit types and projects, in its order", () => {
    expect(columns.resources).toEqual(["funds", "manpower"]);
    expect(columns.unitTypes).toEqual(scenario.unitTypes.map((type) => type.id));
    expect(columns.unitTypes).toContain("general");
    expect(columns.sites).toEqual([
      ...scenario.buildings.map((building) => `building:${building.id}`), ...scenario.development.map((track) => `development:${track.id}`), "improvement:port", "improvement:rail"
    ]);
    expect(columns.projects).toEqual([...siteKeys(scenario), ...linkKeys()]);
    expect(linkKeys()).toEqual(["link:new-rail", "link:rail-upgrade", "link:road-upgrade"]);
  });

  it("names a project by what it makes", () => {
    const at = { a: madrid, b: "x" as SubTerritoryId };
    expect([barracks, { developmentId: "farms" as never, kind: "development" as const }, { improvement: "port" as const, kind: "improvement" as const }, { ...at, kind: "link" as const, work: "new-rail" as const }].map(projectKey))
      .toEqual(["building:barracks", "development:farms", "improvement:port", "link:new-rail"]);
  });

  it("splits every measure into what a turn ends with and what happens in it", () => {
    expect([...flows, ...stocks].sort()).toEqual([...measures].sort());
  });

  it("adds up by column, and refuses a key it has no column for", () => {
    expect(tally(["a", "b"], [["b", 2], ["b", 1]])).toEqual([0, 3]);
    expect(() => tally(["a"], [["z", 1]])).toThrow(/"z" is not a column/);
  });
});

describe("a hand-made board", () => {
  it("counts a unit in training once, and a paused one once and apart", () => {
    const row = stocksIn({ ...opening, training: [training({}), training({ paused: true, typeId: "militia-column" as never }), training({ factionId: north })] });
    expect(cell(row, "training", "infantry-regiment")).toBe(1);
    expect(cell(row, "paused", "militia-column")).toBe(1);
    expect([sum(row.training), sum(row.paused)]).toEqual([1, 1]);
    expect(row.units).toEqual(stocksIn(opening).units);
  });

  it("counts a build under way once, and those waiting behind it once each, for the side that queued them", () => {
    const port: BuildProject = { improvement: "port", kind: "improvement" };
    const line: BuildProject = { a: madrid, b: "x" as SubTerritoryId, kind: "link", work: "new-rail" };
    const row = stocksIn(withQueue([item(barracks, 1), item(port, 0), item(line, 0), { ...item(port, 0), factionId: north }]));
    expect(cell(row, "buildsUnderWay", "building:barracks")).toBe(1);
    expect([cell(row, "buildsWaiting", "improvement:port"), cell(row, "buildsWaiting", "link:new-rail")]).toEqual([1, 1]);
    expect([sum(row.buildsUnderWay), sum(row.buildsWaiting)]).toEqual([1, 2]);
    expect(row.standing).toEqual(stocksIn(opening).standing);
  });

  it("counts a paid build that has not started as waiting, though it heads its queue", () => {
    const row = stocksIn(withQueue([item(barracks, 0)]));
    expect([sum(row.buildsUnderWay), sum(row.buildsWaiting)]).toEqual([0, 1]);
  });

  it("counts an order given this turn once, for the side that gave it, and once more as refused when it was not accepted", () => {
    const recruit: Order = { factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: "militia-column" as never };
    const build: Order = { factionId: republic, kind: "build", project: barracks, subTerritoryId: madrid };
    const rest: Order = { factionId: republic, kind: "replenish", unitId: "u" as UnitId };
    const theirs: Order = { ...recruit, factionId: north };
    const accepted: TurnOutcome[] = [{ kind: "training-started", order: recruit, paid: {}, turnsLeft: 1, unitId: "t" as UnitId }, { kind: "build-queued", order: build, paid: {}, position: 0 }];
    const row = ordersOf(columns, [recruit, build, rest, theirs], accepted, republic);
    expect([cell(row, "recruitsOrdered", "militia-column"), cell(row, "buildsOrdered", "building:barracks")]).toEqual([1, 1]);
    expect([sum(row.recruitsOrdered), sum(row.buildsOrdered), sum(row.recruitsRefused), sum(row.buildsRefused)]).toEqual([1, 1, 0, 0]);
    const refused = ordersOf(columns, [recruit, build, theirs], [], republic);
    expect([sum(refused.recruitsOrdered), sum(refused.recruitsRefused), sum(refused.buildsOrdered), sum(refused.buildsRefused)]).toEqual([1, 1, 1, 1]);
    expect(sum(ordersOf(columns, [recruit, theirs], accepted, north).recruitsRefused)).toBe(1);
  });

  it("counts every unit on the map, aircraft and generals included, for its own side", () => {
    for (const { id } of scenario.factions) {
      const own = Object.values(opening.units).filter((unit) => unit.factionId === id);
      const row = stocksIn(opening, id);
      expect(sum(row.units)).toBe(own.length);
      for (const type of scenario.unitTypes) {
        expect(cell(row, "units", type.id)).toBe(own.filter((unit) => scenario.index.units.get(unit.id)?.type === type.id).length);
      }
    }
    expect(scenario.factions.reduce((total, side) => total + (cell(stocksIn(opening, side.id), "units", "general") ?? 0), 0)).toBeGreaterThan(0);
    const raised = { factionId: republic, fullStrength: 1, id: "r_1" as UnitId, name: "R", type: "bomber-squadron" as never };
    const [unit] = Object.values(opening.units);
    const more: GameState = { ...opening, raised: { [raised.id]: raised }, units: { ...opening.units, [raised.id]: { ...unit!, factionId: republic, id: raised.id } } };
    expect(cell(stocksIn(more), "units", "bomber-squadron")).toBe((cell(stocksIn(opening), "units", "bomber-squadron") ?? 0) + 1);
    expect(() => unitTypeIdOf(scenario, opening, "nobody" as UnitId)).toThrow(/has no type/);
  });

  it("counts what stands for the side that holds it, and levels level by level", () => {
    const before = stocksIn(opening);
    const theirs = stocksIn(opening, north);
    const site = { ...opening.subTerritories[madrid]!, buildings: [], development: { ["farms" as never]: 3 }, holder: north, port: 2, rail: 1 };
    const state: GameState = { ...opening, subTerritories: { ...opening.subTerritories, [madrid]: site } };
    const was = opening.subTerritories[madrid]!;
    const after = stocksIn(state, north);
    expect(cell(after, "standing", "development:farms")).toBe((cell(theirs, "standing", "development:farms") ?? 0) + 3);
    expect(cell(after, "standing", "improvement:port")).toBe((cell(theirs, "standing", "improvement:port") ?? 0) + 2);
    expect(cell(after, "standing", "improvement:rail")).toBe((cell(theirs, "standing", "improvement:rail") ?? 0) + 1);
    expect(cell(stocksIn(state), "standing", "building:barracks")).toBe((cell(before, "standing", "building:barracks") ?? 0) - was.buildings.filter((id) => id === "barracks").length);
    expect(cell(stocksIn(state), "counts", "sub-territories")).toBe((cell(before, "counts", "sub-territories") ?? 0) - 1);
  });

  it("counts the land: territories held whole, contested ones, and generals on their way", () => {
    const state: GameState = {
      ...opening,
      control: { ...opening.control, [territory("madrid")]: { factionIds: [republic, north], kind: "contested" } },
      generals: { ...opening.generals, [republic]: { nextIndex: 1, pending: [{ arrivesOnTurn: 3, factionId: republic, generalId: "g" as never }] } }
    };
    expect(cell(stocksIn(state), "counts", "territories")).toBe((cell(stocksIn(opening), "counts", "territories") ?? 0) - 1);
    expect(cell(stocksIn(state), "counts", "contested")).toBe((cell(stocksIn(opening), "counts", "contested") ?? 0) + 1);
    expect(cell(stocksIn(state), "counts", "generals-due")).toBe(1);
    expect(cell(stocksIn({ ...state, generals: {} }), "counts", "generals-due")).toBe(0);
    const whole = scenario.territories.filter((entry) => entry.initialControl.kind === "controlled" && entry.initialControl.factionId === republic).length;
    expect(cell(stocksIn(opening), "counts", "territories")).toBe(whole);
  });

  it("holds the treasury less the carry", () => {
    const state: GameState = { ...opening, carry: { [republic]: { ["manpower" as never]: 250 } }, treasuries: { ...opening.treasuries, [republic]: { ["funds" as never]: 7, ["manpower" as never]: 4 } } };
    expect(stocksIn(state).held).toEqual([7, 3.75]);
  });

  it("reads income, upkeep and what went unpaid from the turn's outcomes, nothing for a side with none", () => {
    const outcomes = [
      { cut: {}, cutSubTerritoryIds: [], factionId: republic, kind: "income", paid: { funds: 5.1 + 0.2, manpower: 1 } },
      { due: { manpower: 2.5 }, factionId: republic, kind: "upkeep", left: [], short: { manpower: 0.5 } }
    ] as unknown as TurnOutcome[];
    expect(accountOf(columns, outcomes, republic)).toEqual({ income: [5.3, 1], unpaid: [0, 0.5], upkeep: [0, 2.5] });
    expect(accountOf(columns, outcomes, north)).toEqual({ income: [0, 0], unpaid: [0, 0], upkeep: [0, 0] });
  });
});

describe("a resolved turn", () => {
  it("shows an accepted recruit in training and not on the map, and one that trains in a turn on the map", () => {
    const rich: GameState = { ...opening, treasuries: { ...opening.treasuries, [republic]: { ["funds" as never]: 80, ["manpower" as never]: 80 } } };
    const order = (unitTypeId: string): Order => ({ factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: unitTypeId as never });
    const result = resolveTurn(scenario, rich, [{ factionId: republic, orders: [order("infantry-regiment"), order("militia-column")] }], 7);
    const started = result.outcomes.filter((outcome) => outcome.kind === "training-started");
    expect(started.map((outcome) => outcome.order.unitTypeId).sort()).toEqual(["infantry-regiment", "militia-column"]);
    const row = turnOf(scenario, columns, result, republic);
    const at0 = openingOf(scenario, columns, rich, republic);
    expect([cell(row, "recruitsOrdered", "infantry-regiment"), cell(row, "training", "infantry-regiment")]).toEqual([1, 1]);
    expect([cell(row, "recruitsOrdered", "militia-column"), cell(row, "training", "militia-column")]).toEqual([1, 0]);
    expect(sum(row.units)).toBe(Object.values(result.finalState.units).filter((unit) => unit.factionId === republic).length);
    expect(cell(row, "units", "militia-column")).toBe((cell(at0, "units", "militia-column") ?? 0) + 1);
    expect([sum(row.training), sum(row.paused), sum(row.recruitsRefused)]).toEqual([1, 0, 0]);
  });

  it("records income after the turn's raid cuts, which are gone from the board at its end", () => {
    const paying = boardIncome(scenario, opening, republic).gross;
    const raided = scenario.subTerritories.filter((sub) => opening.subTerritories[sub.id]?.holder === republic);
    const state: GameState = { ...opening, raidCuts: raided.map((sub) => ({ factionId: republic, subTerritoryId: sub.id, turnNumber: opening.turnNumber })) };
    const result = resolveTurn(scenario, state, scenario.factions.map((side) => ({ factionId: side.id, orders: [] })), 7);
    const row = turnOf(scenario, columns, result, republic);
    expect(sum(row.income)).toBeLessThan(Object.values(paying).reduce((total, value) => total + value, 0));
    expect(row.income).toEqual(openingOf(scenario, columns, state, republic).income);
    expect(result.finalState.raidCuts).toEqual([]);
  });
});

/** A short game played by the computer, each turn as the harness sees it. */
function shortGame(at: Scenario, seed: number, turnLimit: number): { readonly inventory: Inventory; readonly turns: readonly PlayedTurn[] } {
  const turns: PlayedTurn[] = [];
  const recorder = createInventory(at);
  playComputerGame(at, seed, turnLimit, (turn) => {
    if (turn.turn === 1) recorder.open(turn.before);
    recorder.turn(turn.result);
    turns.push(turn);
  });
  return { inventory: recorder.read(), turns };
}

describe("a short computer game, against the engine's own functions", () => {
  const { inventory, turns } = shortGame(scenario, 3, 8);
  const at = (side: string, measure: Measure, turn: number, column: string) => inventory.sides[side]?.[measure][turn]?.[columns[measureColumns[measure]].indexOf(column)];

  it("has a row for the opening board and one for each turn, as wide as its columns", () => {
    expect(Object.keys(inventory.sides)).toEqual(scenario.factions.map((side) => side.id));
    for (const side of Object.values(inventory.sides)) {
      expect(Object.keys(side)).toEqual(measures);
      for (const measure of measures) {
        expect(side[measure]).toHaveLength(turns.length + 1);
        for (const row of side[measure]) expect(row).toHaveLength(columns[measureColumns[measure]].length);
      }
    }
  });

  it("records the income the engine paid, which the board pays but for raid cuts, and the upkeep its units cost", () => {
    let compared = 0;
    for (const { result, turn } of turns) {
      for (const { id } of scenario.factions) {
        const paid = result.outcomes.find((outcome) => outcome.kind === "income" && outcome.factionId === id);
        const cut = paid?.kind === "income" ? paid.cut : {};
        const income = boardIncome(scenario, result.finalState, id);
        const bill = boardUpkeep(scenario, result.finalState, id);
        for (const resource of scenario.resources) {
          expect((at(id, "income", turn, resource.id) ?? 0) + (cut[resource.id] ?? 0)).toBeCloseTo(income.gross[resource.id] ?? 0, 6);
          expect(at(id, "upkeep", turn, resource.id)).toBeCloseTo(bill[resource.id] ?? 0, 6);
          compared += 1;
        }
      }
    }
    expect(compared).toBe(turns.length * scenario.factions.length * scenario.resources.length);
    // The engine's forecast on the same board also counts the training that ends next turn.
    const finishing: GameState = { ...opening, training: [training({ turnsLeft: 1 })] };
    const forecast = inPoints(upkeepBill(upkeepLines(scenario, finishing, republic, [])));
    expect(forecast["manpower" as never] ?? 0).toBeGreaterThan(boardUpkeep(scenario, finishing, republic)["manpower" as never] ?? 0);
  });

  it("opens with what the opening board pays and costs, and with no orders", () => {
    for (const { id } of scenario.factions) {
      for (const resource of scenario.resources) {
        expect(at(id, "income", 0, resource.id)).toBeCloseTo(boardIncome(scenario, opening, id).paid[resource.id] ?? 0, 6);
        expect(at(id, "held", 0, resource.id)).toBe(opening.treasuries[id]?.[resource.id]);
      }
      expect(sum(inventory.sides[id]?.recruitsOrdered[0])).toBe(0);
      expect(sum(inventory.sides[id]?.units[0])).toBe(Object.values(opening.units).filter((unit) => unit.factionId === id).length);
    }
  });

  it("balances: what a side holds is what it held, plus income, less upkeep paid and what it bought", () => {
    let exact = 0;
    for (const { result, turn } of turns) {
      for (const { id } of scenario.factions) {
        for (const resource of scenario.resources) {
          const spent = result.outcomes.reduce((total, outcome) => {
            switch (outcome.kind) {
              case "build-queued":
              case "training-started": return total + (outcome.order.factionId === id ? outcome.paid[resource.id] ?? 0 : 0);
              case "build-refunded":
              case "training-refunded": return total - (outcome.factionId === id ? outcome.refund[resource.id] ?? 0 : 0);
              default: return total;
            }
          }, 0);
          const change = (at(id, "income", turn, resource.id) ?? 0) - (at(id, "upkeep", turn, resource.id) ?? 0) + (at(id, "unpaid", turn, resource.id) ?? 0) - spent;
          const replenished = result.submittedOrders.some((order) => order.kind === "replenish" && order.factionId === id);
          const held = (at(id, "held", turn, resource.id) ?? 0) - (at(id, "held", turn - 1, resource.id) ?? 0);
          // Replenish orders pay through the carry; a turn without them balances to the thousandth.
          if (replenished) {
            expect(held).toBeLessThanOrEqual(change + 1e-6);
          } else {
            expect(held).toBeCloseTo(change, 6);
            exact += 1;
          }
        }
      }
    }
    expect(exact).toBeGreaterThan(0);
  });

  it("has every unit, every building and every queued item of the board, once", () => {
    for (const { result: { finalState }, turn } of turns) {
      const over = (measure: Measure) => scenario.factions.reduce((total, { id }) => total + sum(inventory.sides[id]?.[measure][turn]), 0);
      const sites = Object.values(finalState.subTerritories);
      expect(over("units")).toBe(Object.keys(finalState.units).length);
      expect(over("training") + over("paused")).toBe(finalState.training.length);
      expect(over("buildsUnderWay") + over("buildsWaiting")).toBe(sites.flatMap((site) => site.queue).length);
      expect(over("standing")).toBe(sites.reduce((total, site) => total + site.buildings.length + site.port + site.rail + Object.values(site.development).reduce((levels, level) => levels + level, 0), 0));
      // Every capital's buildings, by the engine's own reading, are among its holder's.
      for (const { id } of scenario.factions) {
        const capitals = scenario.territories.filter((entry) => finalState.subTerritories[capitalOf(scenario, entry.id)!]?.holder === id);
        for (const building of scenario.buildings) {
          const inCapitals = capitals.filter((entry) => capitalBuildings(scenario, finalState, entry.id).includes(building.id)).length;
          const elsewhere = scenario.subTerritories.filter((sub) => !scenario.territories.some((entry) => capitalOf(scenario, entry.id) === sub.id)
            && finalState.subTerritories[sub.id]?.holder === id && finalState.subTerritories[sub.id]?.buildings.includes(building.id)).length;
          expect(at(id, "standing", turn, `building:${building.id}`)).toBe(inCapitals + elsewhere);
        }
      }
    }
  });

  it("gives the same bytes for the same seed, and leaves the rest of the line as it is", () => {
    const line = (record: boolean) => playGame({ scenario, turnLimit: 4, variant: "baseline", ...(record ? { record: "inventory" as const } : {}) }, 5);
    const first = line(true);
    expect(JSON.stringify(line(true))).toBe(JSON.stringify(first));
    expect(Object.keys(first)).toEqual([...Object.keys(first)].sort((a, b) => (a === "objectiveChecks" || b === "objectiveChecks" ? 0 : a < b ? -1 : 1)));
    expect(first.inventory?.sides[republic]?.units).toHaveLength(first.turns + 1);
    expect(JSON.stringify(line(false))).toBe(JSON.stringify({ ...first, inventory: undefined }));
  });
});

describe("a scenario without an economy", () => {
  it("records its units and land, and empty rows for the rest", () => {
    const { inventory } = shortGame(tiny(), 1, 2);
    expect(inventory.columns.resources).toEqual([]);
    const red = inventory.sides["red"]!;
    expect(red.held[0]).toEqual([]);
    expect(sum(red.units[0])).toBe(tiny().units.filter((unit) => unit.factionId === "red").length);
    expect(red.counts[0]?.[0]).toBeGreaterThan(0);
  });
});
