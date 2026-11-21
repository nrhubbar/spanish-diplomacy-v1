import { describe, expect, it } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { BuildingId, BuildOrder, BuildProject, DevelopmentId, FactionId, GameState, QueueItem, RecruitOrder, Scenario, SubTerritoryId, SubTerritoryState, TerritoryId, UnitTypeId } from "../../main/engine/types";
import { ledgersFor, productionOf, yieldSources } from "../../main/presentation/ledger";
import { andList, buildEntries, countOf, buildingGroups, buildingSummary, plannedAt, recruitmentGroups, recruitmentSummary, trainingEntries } from "../../main/presentation/queues";
import { canReplenishSelection, chooseReplenish, type PlanningSession, replenishPlan, replenishSelectionDetail, replenishSkipReason, skippedText } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { armyIn, faction, spain, spainId, territory } from "../support";

const scenario = spain();
const start = initialGameState(scenario);
const republic = faction("republic");
const north = faction("north");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const typeId = (id: string): UnitTypeId => id as UnitTypeId;
const building = (id: string): BuildProject => ({ buildingId: id as BuildingId, kind: "building" });
const farms: BuildProject = { developmentId: "farms" as DevelopmentId, kind: "development" };
const item = (project: BuildProject, progress = 0, factionId: FactionId = republic): QueueItem => ({ factionId, paid: { funds: 4 } as never, project, progress });
const build = (id: string, project: BuildProject): BuildOrder => ({ factionId: republic, kind: "build", project, subTerritoryId: sub(id) });
const recruit = (where: string, type: string): RecruitOrder => ({ factionId: republic, kind: "recruit", territoryId: territory(where), unitTypeId: typeId(type) });

function withSite(state: GameState, id: string, change: Partial<SubTerritoryState>): GameState {
  return { ...state, subTerritories: { ...state.subTerritories, [sub(id)]: { ...state.subTerritories[sub(id)]!, ...change } } };
}

const training = (where: string, type: string, turnsLeft: number, extra: { readonly factionId?: FactionId; readonly paused?: boolean; readonly unitId?: string } = {}) => ({
  factionId: extra.factionId ?? republic,
  paid: {},
  paused: extra.paused ?? false,
  territoryId: territory(where),
  turnsLeft,
  typeId: typeId(type),
  unitId: (extra.unitId ?? `t-${where}-${type}-${String(turnsLeft)}`) as never
});

describe("build queue rows (U9)", () => {
  it("reads the head's turns left, what waits behind it, and this turn's orders with their Cancel", () => {
    const site = { ...start.subTerritories[sub("madrid")]!, queue: [item(farms, 1), item(farms), item(building("fortifications")), item(building("depot"))] };
    const planned = [{ index: 3, order: build("madrid", building("fortifications")) }, { index: 5, order: build("madrid", building("depot")) }];
    const rows = buildEntries(scenario, site, planned, false);
    expect(rows.map((row) => [row.stage, row.name, row.status])).toEqual([
      ["active", "Farms 1 \u2192 2", "2 turns left"],
      ["waiting", "Farms 2 \u2192 3", "then 3 turns"],
      ["waiting", "Fortifications", "ordered this turn \u00b7 2 turns"],
      ["waiting", "Depot", "ordered this turn \u00b7 2 turns"]
    ]);
    expect(rows[0]).toMatchObject({ done: 1, total: 3 });
    expect(rows[2]?.cancel).toEqual({ index: 3, kind: "build" });
    expect(rows[0]?.cancel).toBeUndefined();
  });

  it("says a paused head resumes, starts a head ordered this turn, and leaves out others' items", () => {
    const paused = { ...start.subTerritories[sub("madrid")]!, queue: [item(building("fortifications"), 1)] };
    expect(buildEntries(scenario, paused, [], true)[0]?.status).toBe("1 turn left when it resumes");
    const fresh = { ...paused, queue: [item(building("fortifications"))] };
    expect(buildEntries(scenario, fresh, [{ index: 0, order: build("madrid", building("fortifications")) }], false)[0]?.status).toBe("starts this turn \u00b7 2 turns");
    const theirs = { ...paused, queue: [item(building("fortifications"), 0, north)] };
    expect(buildEntries(scenario, theirs, [], false, republic)).toEqual([]);
    expect(buildEntries(scenario, theirs, [], false)).toHaveLength(1);
    const unknown = { ...paused, queue: [item(building("mystery"))] };
    expect(buildEntries(scenario, unknown, [], false)[0]?.total).toBe(1);
  });

  it("picks one sub-territory's planned orders with their index in the plan", () => {
    const orders = [build("madrid", farms), build("henares", farms), build("madrid", building("depot"))];
    expect(plannedAt(orders, sub("madrid")).map((entry) => entry.index)).toEqual([0, 2]);
  });
});

describe("training rows (U9)", () => {
  it("makes each unit in training active with its own bar, then this turn's orders, which can be cancelled one at a time", () => {
    const state = { training: [training("catalunya", "infantry-regiment", 1), training("catalunya", "militia-column", 1, { paused: true }), training("catalunya", "militia-column", 1, { factionId: north })] };
    const orders = [recruit("catalunya", "militia-column"), recruit("catalunya", "militia-column"), recruit("valencia", "militia-column")];
    const rows = trainingEntries(scenario, state, territory("catalunya"), orders, republic, false);
    expect(rows.map((row) => [row.stage, row.status, row.owner])).toEqual([
      ["active", "1 turn left", undefined],
      ["active", "1 turn left when it resumes", undefined],
      ["active", "1 turn left", "Northern Insurgent Command"],
      ["waiting", "starts this turn \u00b7 1 turn", undefined],
      ["waiting", "starts this turn \u00b7 1 turn", undefined]
    ]);
    expect(rows[0]).toMatchObject({ done: 1, name: "Infantry regiment", total: 2 });
    expect(rows[3]?.cancel).toEqual({ kind: "recruit", quantity: 1, territoryId: territory("catalunya"), unitTypeId: typeId("militia-column") });
    expect(trainingEntries(scenario, state, territory("catalunya"), [], republic, true)).toHaveLength(2);
  });

  it("names an unknown type by its id", () => {
    const rows = trainingEntries(scenario, { training: [training("madrid", "zeppelin", 3)] }, territory("madrid"), [recruit("madrid", "zeppelin")], republic, true);
    expect(rows.map((row) => [row.name, row.total, row.done])).toEqual([["zeppelin", 3, 0], ["zeppelin", 1, 0]]);
  });

  it("groups Global Recruitment by territory and counts what the top bar counts", () => {
    const state = { training: [training("valencia", "infantry-regiment", 2, { paused: true }), training("catalunya", "infantry-regiment", 1), training("madrid", "militia-column", 1, { factionId: north })] };
    const orders = [recruit("madrid", "infantry-regiment")];
    const groups = recruitmentGroups(scenario, state, republic, orders);
    expect(groups.map((group) => [group.name, group.paused, group.entries.length])).toEqual([["Madrid", false, 1], ["Catalu\u00f1a", false, 1], ["Valencia", true, 1]].sort((a, b) => scenario.territories.findIndex((entry) => entry.name === a[0]) - scenario.territories.findIndex((entry) => entry.name === b[0])));
    const summary = recruitmentSummary(scenario, state, republic, orders);
    expect([summary.training, summary.readyNext, summary.ordered]).toEqual([2, 1, 1]);
    expect(summary.committed).toEqual(scenario.index.unitTypes.get(typeId("infantry-regiment"))?.recruit?.cost);
    expect(recruitmentSummary(scenario, state, republic, [recruit("madrid", "zeppelin")]).committed).toEqual({});
    expect(recruitmentGroups(scenario, { training: [] }, republic, [])).toEqual([]);
  });
});

describe("Global Building's groups (U9)", () => {
  it("groups by territory, then sub-territory, marks contested ones paused, and summarises", () => {
    let state = withSite(start, "madrid", { queue: [item(building("fortifications"), 1), item(farms)] });
    state = withSite(state, "granada", { holder: republic, queue: [item(building("fortifications"), 0)] });
    state = withSite(state, "barcelona", { queue: [item(farms, 0), item(building("depot"), 0, north)] });
    const groups = buildingGroups(scenario, state, republic, []);
    const byName = new Map(groups.map((group) => [group.name, group]));
    expect(byName.get("Madrid")?.sites.map((site) => [site.name, site.capital, site.entries.length])).toEqual([["Madrid", true, 2]]);
    expect(byName.get("Andaluc\u00eda")?.paused).toBe(true);
    expect(byName.get("Catalu\u00f1a")?.sites[0]?.entries).toHaveLength(1);
    const summary = buildingSummary(scenario, groups);
    expect(summary).toEqual({ finishing: ["Madrid"], paused: 1, queued: 1, underWay: 2 });
    expect(buildingGroups(scenario, start, republic, [])).toEqual([]);
  });

  it("counts with the right noun", () => {
    expect([countOf(1, "site", "sites"), countOf(2, "site", "sites"), countOf(0, "site", "sites")]).toEqual(["1 site", "2 sites", "0 sites"]);
  });

  it("lists names as English does", () => {
    expect([andList([]), andList(["Madrid"]), andList(["Madrid", "Murcia"]), andList(["Madrid", "Murcia", "Valencia"])]).toEqual(["", "Madrid", "Madrid and Murcia", "Madrid, Murcia and Valencia"]);
  });
});

describe("the balance view's rows (U11)", () => {
  it("lists each territory with its yield, a contested loss on its row, then the expenses, and totals to next turn", () => {
    const [funds, manpower] = ledgersFor(scenario, start, republic, { builds: [build("madrid", building("fortifications"))], recruits: [recruit("madrid", "militia-column")], replenish: { funds: 2 } as never, replenishCount: 2 });
    expect(funds).toBeDefined();
    const values = funds!.rows.map((row) => row.value);
    expect(funds!.total).toBe(values.reduce((sum, value) => sum + value, 0));
    const territories = funds!.rows.filter((row) => row.kind === "territory");
    expect(territories.map((row) => row.value)).toEqual([...territories.map((row) => row.value)].sort((a, b) => b - a));
    const contested = territories.filter((row) => row.loss > 0);
    expect(contested.length).toBeGreaterThan(0);
    expect(contested.every((row) => row.value === 0 && row.yield === row.loss && /^\d+\/\d+ held$/u.test(row.note ?? ""))).toBe(true);
    expect(funds!.rows.slice(-3).map((row) => [row.label, row.note, row.value])).toEqual([
      ["Builds under way", "paid when queued", 0],
      ["Replenish", "2 units, planned this turn", -2],
      ["Upkeep", "none in this scenario", 0]
    ]);
    expect(funds!.now).toBe(funds!.held - funds!.spent);
    expect(funds!.spent).toBeGreaterThan(0);
    expect(manpower!.rows.find((row) => row.key === "replenish")?.value).toBe(-0);
  });

  it("leaves out territories that yield none of a resource unless contested, and has no raid row without a raid", () => {
    const [funds] = ledgersFor(scenario, start, republic, { replenish: {}, replenishCount: 0 });
    expect(funds!.rows.every((row) => row.kind !== "territory" || row.yield !== 0 || row.loss > 0 || row.note !== undefined)).toBe(true);
    expect(funds!.rows.some((row) => row.kind === "raid")).toBe(false);
    expect(funds!.spent).toBe(0);
  });
});

describe("the Production tab's rows (U9)", () => {
  it("lists each sub-territory's levels and yield, the territory's total, raids and other holders", () => {
    const raided: GameState = { ...start, raidCuts: [{ factionId: republic, subTerritoryId: sub("madrid"), turnNumber: start.turnNumber }, { factionId: republic, subTerritoryId: sub("henares"), turnNumber: start.turnNumber - 1 }] };
    const madrid = productionOf(scenario, withSite(raided, "guadarrama", { development: {} }), territory("madrid"));
    expect(madrid.contested).toBe(false);
    expect(madrid.rows.map((row) => [row.name, row.capital, row.raided])).toEqual([["Madrid", true, true], ["Sierra de Guadarrama", false, false], ["Henares", false, false]]);
    expect(madrid.rows.find((row) => row.name === "Sierra de Guadarrama")?.levels).toBe("No development");
    expect(madrid.rows[0]?.levels).toMatch(/^\w+ \d( \u00b7 \w+ \d)*$/u);
    expect(madrid.total).toEqual(madrid.rows.reduce<Record<string, number>>((sum, row) => {
      for (const [id, value] of Object.entries(row.yield)) sum[id] = (sum[id] ?? 0) + value;
      return sum;
    }, {}));
    const andalucia = productionOf(scenario, start, territory("andalucia"));
    expect(andalucia.contested).toBe(true);
    expect(new Set(andalucia.rows.map((row) => row.holder)).size).toBeGreaterThan(1);
    const missing = { ...start, subTerritories: { ...start.subTerritories } };
    delete (missing.subTerritories as Record<string, unknown>)["henares"];
    expect(productionOf(scenario, missing, territory("madrid")).rows.some((row) => row.name === "Henares")).toBe(false);
  });

  it("says where each resource comes from, from the scenario's tracks", () => {
    expect(yieldSources(scenario).length).toBeGreaterThan(0);
    expect(yieldSources(scenario)[0]).toMatch(/^\w+ comes from [\w ]+\.$/u);
    const bare: Scenario = { ...scenario, development: [] };
    expect(yieldSources(bare)).toEqual([]);
  });
});

describe("Replenish for the whole selection (U12)", () => {
  const base = start;
  const wadRas = armyIn(base, "rep-wad-ras-1");
  const covadonga = armyIn(base, "rep-covadonga-4");
  const worn: GameState = { ...base, units: { ...base.units, [wadRas.id]: { ...wadRas, strength: Math.round(wadRas.strength / 2) } } };
  // A scenario where infantry regiments take no Replenish order.
  const noInfantry: Scenario = { ...scenario, index: { ...scenario.index, unitTypes: new Map([...scenario.index.unitTypes].map(([id, entry]) => [id, id === "infantry-regiment" ? { ...entry, orders: entry.orders.filter((kind) => kind !== "replenish") } : entry])) } };
  const selecting = (state: GameState, ids: readonly string[], extra: Partial<PlanningSession["draft"]> = {}): PlanningSession => ({
    draft: { ...emptyDraft, orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: ids as never, ...extra },
    factionId: republic,
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  });

  it("says in a few words why a unit is skipped", () => {
    expect(replenishSkipReason(scenario, worn, worn.units[wadRas.id]!)).toBeUndefined();
    expect(replenishSkipReason(scenario, base, wadRas)).toBe("at full strength");
    expect(replenishSkipReason(noInfantry, worn, worn.units[wadRas.id]!)).toBe("Infantry regiment units cannot replenish");
    const contested = Object.keys(base.control).find((id) => scenario.index.subTerritoriesByTerritory.get(id as TerritoryId)?.some((entry) => base.subTerritories[entry.id]?.holder === republic) === true
      && scenario.index.subTerritoriesByTerritory.get(id as TerritoryId)?.some((entry) => base.subTerritories[entry.id]?.holder !== republic) === true)!;
    expect(replenishSkipReason(scenario, base, { ...wadRas, strength: 1, territoryId: contested as TerritoryId })).toBe("in contested ground");
    const enemy = Object.entries(base.control).find(([id, control]) => control.kind === "controlled" && control.factionId === north && scenario.index.subTerritoriesByTerritory.get(id as TerritoryId)?.every((entry) => base.subTerritories[entry.id]?.holder === north) === true)![0];
    expect(replenishSkipReason(scenario, base, { ...wadRas, strength: 1, territoryId: enemy as TerritoryId })).toBe("outside your territory");
    const plain = { ...scenario };
    delete (plain as { recruitment?: unknown }).recruitment;
    expect(replenishSkipReason(plain, base, wadRas)).toBe("Replenishing is not part of this scenario.");
  });

  it("refills the units that can, and names the rest with their reasons", () => {
    const session = selecting(worn, [wadRas.id, covadonga.id]);
    expect(canReplenishSelection(scenario, session)).toBe(true);
    const plan = replenishPlan(scenario, session);
    expect(plan.ready.map((unit) => unit.id)).toEqual([wadRas.id]);
    expect(plan.selected).toBe(2);
    expect(plan.skipped.map((skip) => [skip.unitId, skip.reason])).toEqual([[covadonga.id, "at full strength"]]);
    expect(replenishSelectionDetail(scenario, session)).toMatch(/^Refills 1 of the 2 selected units: \+\d+ men, arriving at the end of the turn .*\. Skips .+ \(at full strength\)\.$/u);
    const planned = chooseReplenish(scenario, session);
    expect(planned.draft.replenishments?.map((order) => order.unitId)).toEqual([wadRas.id]);
    expect(planned.draft.feedback).toMatch(/^1 unit will replenish\. Skips .+ \(at full strength\)\.$/u);
    expect(planned.draft.selectedUnitIds).toEqual([]);
  });

  it("reads the selection line plainly when every unit is refilled, or none can be", () => {
    const all = selecting(worn, [wadRas.id]);
    expect(replenishSelectionDetail(scenario, all)).toMatch(/^\+\d+ men, arriving at the end of the turn/u);
    const none = selecting(base, [wadRas.id, covadonga.id]);
    expect(replenishSelectionDetail(scenario, none)).toMatch(/^No selected unit can replenish\. Skips .+ and .+ \(at full strength\)\.$/u);
    expect(chooseReplenish(scenario, none).draft.feedback).toBe("This unit is at full strength and in good order.");
  });

  it("skips units the balance cannot pay for, and refuses when it covers none", () => {
    const broke: GameState = { ...worn, treasuries: { ...worn.treasuries, [republic]: {} } };
    const session = selecting(broke, [wadRas.id]);
    const plan = replenishPlan(scenario, session);
    expect(plan.ready).toEqual([]);
    expect(plan.skipped[0]?.reason).toMatch(/^not enough (Funds|Manpower|Funds and Manpower)$/u);
    expect(chooseReplenish(scenario, session).draft.feedback).toBe("Not enough Funds or Manpower left to replenish.");
    const free: GameState = { ...worn, treasuries: {} };
    expect(replenishPlan(scenario, selecting(free, [wadRas.id])).ready).toHaveLength(1);
  });

  it("prices the selection after the draft's other Replenish orders", () => {
    const both: GameState = { ...worn, units: { ...worn.units, [covadonga.id]: { ...covadonga, strength: Math.round(covadonga.strength / 2) } } };
    const session = selecting(both, [wadRas.id], { replenishments: [{ factionId: republic, kind: "replenish", unitId: covadonga.id }, { factionId: republic, kind: "replenish", unitId: "gone" as never }] });
    const plan = replenishPlan(scenario, session);
    expect(plan.ready).toHaveLength(1);
    expect(Object.values(plan.cost).some((value) => value > 0)).toBe(true);
  });

  it("matches prices by unit when a kept order's unit has no price", () => {
    // A unit on the board with no definition gets no quote, so the pricing leaves it out.
    const ghost = { ...covadonga, id: "ghost-unit" as never };
    const session = selecting({ ...worn, units: { ...worn.units, [ghost.id]: ghost } }, [wadRas.id], { replenishments: [{ factionId: republic, kind: "replenish", unitId: ghost.id }] });
    expect(replenishPlan(scenario, session).ready.map((unit) => unit.id)).toEqual([wadRas.id]);
  });

  it("names the short resource against what the units paid first leave", () => {
    const both: GameState = { ...worn, units: { ...worn.units, [covadonga.id]: { ...covadonga, strength: Math.round(covadonga.strength / 2) } } };
    const one = replenishPlan(scenario, selecting(both, [wadRas.id])).cost;
    const tight: GameState = { ...both, treasuries: { ...both.treasuries, [republic]: { ...both.treasuries[republic], funds: (one as Record<string, number>)["funds"] ?? 0 } } };
    const plan = replenishPlan(scenario, selecting(tight, [wadRas.id, covadonga.id]));
    expect(plan.ready.map((unit) => unit.id)).toEqual([wadRas.id]);
    expect(plan.skipped.map((skip) => [skip.unitId, skip.reason])).toEqual([[covadonga.id, "not enough Funds"]]);
  });

  it("groups skipped units by reason", () => {
    expect(skippedText([])).toBe("");
    expect(skippedText([{ name: "A", reason: "x", unitId: "a" as never }, { name: "B", reason: "y", unitId: "b" as never }, { name: "C", reason: "x", unitId: "c" as never }])).toBe("Skips A and C (x) and B (y).");
  });
});
