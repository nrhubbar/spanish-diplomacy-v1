import {
  boardIncome,
  boardUpkeep,
  type FactionId,
  type GameState,
  heldPoints,
  linkKeys,
  type Order,
  projectKey,
  type Resources,
  type Scenario,
  siteKeys,
  type TurnOutcome,
  type TurnResolutionResult,
  unitTypeIdOf
} from "./engine";

/**
 * What every side had, turn by turn (`--record inventory`). Stocks are read from the board at the
 * end of each turn, so no piece is in two of them. Orders are a flow: an order given and accepted
 * this turn is already in training or in a queue at the end of it (or, with one turn of training,
 * on the map), so orders are never added to stocks.
 */

/** The columns of each table, in scenario order; the same for every turn and side of a game. */
export interface InventoryColumns {
  /** Single numbers: territories held whole, contested territories the side has a part of, sub-territories held, replacement generals on their way. */
  readonly counts: readonly string[];
  /** Everything a Build order can queue: the sites, then the link works. */
  readonly projects: readonly string[];
  readonly resources: readonly string[];
  /** What stands in a sub-territory: buildings (how many), then development tracks and improvements (levels added up). */
  readonly sites: readonly string[];
  readonly unitTypes: readonly string[];
}

/** Which columns each measure's rows have. Keys are in the order they are written. */
export const measureColumns = {
  /** Build orders given this turn, refused ones included. */
  buildsOrdered: "projects",
  /** Build orders given this turn that were not paid for and queued. */
  buildsRefused: "projects",
  /** Queued items with a turn of progress or more, paused ones included. */
  buildsUnderWay: "projects",
  /** Queued items, paid for, with no turn of progress yet. */
  buildsWaiting: "projects",
  counts: "counts",
  /** Points held at the end of the turn, to thousandths: the treasury less the carry. */
  held: "resources",
  /** Income paid this turn, after raid cuts. Turn 0: what the opening board pays. */
  income: "resources",
  /** Training paused because its territory is contested. */
  paused: "unitTypes",
  /** Recruit orders given this turn, refused ones included. */
  recruitsOrdered: "unitTypes",
  /** Recruit orders given this turn that were not paid for and started. */
  recruitsRefused: "unitTypes",
  /** Buildings and levels in the sub-territories the side holds. */
  standing: "sites",
  /** Units in training, paused ones not included. */
  training: "unitTypes",
  /** Upkeep the side could not pay this turn. */
  unpaid: "resources",
  /** Units on the map, of every kind. */
  units: "unitTypes",
  /** Upkeep due this turn. Turn 0: what the opening board costs. */
  upkeep: "resources"
} as const satisfies Record<string, keyof InventoryColumns>;

export type Measure = keyof typeof measureColumns;
export const measures = Object.keys(measureColumns) as readonly Measure[];

/** A record with an entry for each measure, in the order they are written. */
export function byMeasure<Value>(read: (measure: Measure) => Value): Record<Measure, Value> {
  return Object.fromEntries(measures.map((measure) => [measure, read(measure)])) as Partial<Record<Measure, Value>> as Record<Measure, Value>;
}

/** The measures that happen during a turn; the others are read at its end. */
export const flows: readonly Measure[] = ["buildsOrdered", "buildsRefused", "income", "recruitsOrdered", "recruitsRefused", "unpaid", "upkeep"];
export const stocks: readonly Measure[] = measures.filter((measure) => !flows.includes(measure));

/** One side at one turn: for each measure, a number for each of its columns. */
export type SideTurn = Readonly<Record<Measure, readonly number[]>>;
/** One side over a game: for each measure, a row per turn, turn 0 (the opening board) first. */
export type SideInventory = Readonly<Record<Measure, readonly (readonly number[])[]>>;

export interface Inventory {
  readonly columns: InventoryColumns;
  readonly sides: Readonly<Record<string, SideInventory>>;
}

const countColumns = ["territories", "contested", "sub-territories", "generals-due"] as const;

export function inventoryColumns(scenario: Scenario): InventoryColumns {
  const sites = siteKeys(scenario);
  return {
    counts: countColumns,
    projects: [...sites, ...linkKeys()],
    resources: scenario.resources.map((resource) => resource.id),
    sites,
    unitTypes: scenario.unitTypes.map((type) => type.id)
  };
}

/** Adds entries up by column. An entry with no column is an error, so nothing is dropped unseen. */
export function tally(columns: readonly string[], entries: Iterable<readonly [string, number]>): readonly number[] {
  const index = new Map(columns.map((column, at) => [column, at]));
  const row = columns.map(() => 0);
  for (const [key, amount] of entries) {
    const at = index.get(key);
    if (at === undefined) throw new Error(`"${key}" is not a column of the record: ${columns.join(", ")}.`);
    row[at] = (row[at] ?? 0) + amount;
  }
  return row;
}

/** Amounts of points to thousandths, so a row never shows a sum's rounding noise (or -0). */
function amounts(columns: readonly string[], resources: Resources): readonly number[] {
  return tally(columns, Object.entries(resources)).map((value) => Math.round(value * 1000) / 1000 + 0);
}

const one = (key: string): readonly [string, number] => [key, 1];

type Stocks = Pick<SideTurn, "buildsUnderWay" | "buildsWaiting" | "counts" | "held" | "paused" | "standing" | "training" | "units">;

/** What a side has on a board: on the map, in training, in its build queues and in its stores. */
export function stocksOf(scenario: Scenario, columns: InventoryColumns, state: GameState, factionId: FactionId): Stocks {
  const sites = Object.values(state.subTerritories);
  const held = sites.filter((site) => site.holder === factionId);
  const queued = sites.flatMap((site) => site.queue).filter((item) => item.factionId === factionId);
  const training = state.training.filter((item) => item.factionId === factionId);
  const control = scenario.territories.flatMap((territory) => state.control[territory.id] ?? []);
  return {
    buildsUnderWay: tally(columns.projects, queued.filter((item) => item.progress > 0).map((item) => one(projectKey(item.project)))),
    buildsWaiting: tally(columns.projects, queued.filter((item) => item.progress === 0).map((item) => one(projectKey(item.project)))),
    counts: tally(columns.counts, [
      ["territories", control.filter((entry) => entry.kind === "controlled" && entry.factionId === factionId).length],
      ["contested", control.filter((entry) => entry.kind === "contested" && entry.factionIds.includes(factionId)).length],
      ["sub-territories", held.length],
      ["generals-due", state.generals[factionId]?.pending.length ?? 0]
    ]),
    held: amounts(columns.resources, heldPoints(state, factionId)),
    paused: tally(columns.unitTypes, training.filter((item) => item.paused).map((item) => one(item.typeId))),
    standing: tally(columns.sites, held.flatMap((site) => [
      ...site.buildings.map((id) => one(`building:${id}`)),
      ...Object.entries(site.development).map(([id, level]): [string, number] => [`development:${id}`, level]),
      ["improvement:port", site.port] as const,
      ["improvement:rail", site.rail] as const
    ])),
    training: tally(columns.unitTypes, training.filter((item) => !item.paused).map((item) => one(item.typeId))),
    units: tally(columns.unitTypes, Object.values(state.units).filter((unit) => unit.factionId === factionId).map((unit) => one(unitTypeIdOf(scenario, state, unit.id))))
  };
}

type OrderCounts = Pick<SideTurn, "buildsOrdered" | "buildsRefused" | "recruitsOrdered" | "recruitsRefused">;

/** A side's Build and Recruit orders this turn, and those that were not accepted. */
export function ordersOf(columns: InventoryColumns, orders: readonly Order[], outcomes: readonly TurnOutcome[], factionId: FactionId): OrderCounts {
  const recruits = (given: readonly Order[]) => tally(columns.unitTypes, given.flatMap((order) => (order.kind === "recruit" && order.factionId === factionId ? [one(order.unitTypeId)] : [])));
  const builds = (given: readonly Order[]) => tally(columns.projects, given.flatMap((order) => (order.kind === "build" && order.factionId === factionId ? [one(projectKey(order.project))] : [])));
  const accepted = outcomes.flatMap((outcome) => (outcome.kind === "training-started" || outcome.kind === "build-queued" ? [outcome.order] : []));
  const without = (given: readonly number[], taken: readonly number[]) => given.map((value, at) => value - (taken[at] ?? 0));
  const buildsOrdered = builds(orders);
  const recruitsOrdered = recruits(orders);
  return {
    buildsOrdered,
    buildsRefused: without(buildsOrdered, builds(accepted)),
    recruitsOrdered,
    recruitsRefused: without(recruitsOrdered, recruits(accepted))
  };
}

type Account = Pick<SideTurn, "income" | "unpaid" | "upkeep">;

/**
 * What the engine paid and charged a side this turn. Read from the turn's outcomes and not from
 * the board at its end: by then the turn's raid cuts are over, and the engine's bill is next turn's.
 */
export function accountOf(columns: InventoryColumns, outcomes: readonly TurnOutcome[], factionId: FactionId): Account {
  const row = (amount: Resources | undefined) => amounts(columns.resources, amount ?? {});
  const income = outcomes.find((outcome) => outcome.kind === "income" && outcome.factionId === factionId);
  const upkeep = outcomes.find((outcome) => outcome.kind === "upkeep" && outcome.factionId === factionId);
  return {
    income: row(income?.kind === "income" ? income.paid : undefined),
    unpaid: row(upkeep?.kind === "upkeep" ? upkeep.short : undefined),
    upkeep: row(upkeep?.kind === "upkeep" ? upkeep.due : undefined)
  };
}

/** A side on the opening board, turn 0: nothing ordered yet, and what the board pays and costs. */
export function openingOf(scenario: Scenario, columns: InventoryColumns, state: GameState, factionId: FactionId): SideTurn {
  return {
    ...stocksOf(scenario, columns, state, factionId),
    ...ordersOf(columns, [], [], factionId),
    income: amounts(columns.resources, boardIncome(scenario, state, factionId).paid),
    unpaid: amounts(columns.resources, {}),
    upkeep: amounts(columns.resources, boardUpkeep(scenario, state, factionId))
  };
}

/** A side at the end of a resolved turn. */
export function turnOf(scenario: Scenario, columns: InventoryColumns, result: TurnResolutionResult, factionId: FactionId): SideTurn {
  return {
    ...stocksOf(scenario, columns, result.finalState, factionId),
    ...ordersOf(columns, result.submittedOrders, result.outcomes, factionId),
    ...accountOf(columns, result.outcomes, factionId)
  };
}

/** Records one game: the opening board, then each resolved turn. */
export function createInventory(scenario: Scenario): { readonly open: (state: GameState) => void; readonly read: () => Inventory; readonly turn: (result: TurnResolutionResult) => void } {
  const columns = inventoryColumns(scenario);
  const factionIds = scenario.factions.map((faction) => faction.id);
  const rows = new Map(factionIds.map((id) => [id, [] as SideTurn[]]));
  const add = (read: (factionId: FactionId) => SideTurn) => {
    for (const [factionId, turns] of rows) turns.push(read(factionId));
  };
  return {
    open: (state) => { add((factionId) => openingOf(scenario, columns, state, factionId)); },
    read: () => ({
      columns,
      sides: Object.fromEntries([...rows].map(([factionId, turns]) => [
        factionId,
        byMeasure((measure) => turns.map((turn) => turn[measure]))
      ]))
    }),
    turn: (result) => { add((factionId) => turnOf(scenario, columns, result, factionId)); }
  };
}
