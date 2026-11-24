import { carryOf, carryScale } from "../engine/carry";
import { plannedSpend } from "../engine/economy/catalogue";
import { holdersIn, subTerritoriesOf } from "../engine/economy/holdings";
import { incomeFor, subTerritoryYield } from "../engine/economy/income";
import { amountOf, sumResources, treasuryOf } from "../engine/economy/resources";
import { type UpkeepLine, upkeepLines } from "../engine/economy/upkeep";
import { priceReplenishments, replenishQuote } from "../engine/recruitment/rules";
import { toThousandth } from "../engine/resources";
import { resourceAmount } from "./economy";
import { glyphs } from "./glyphs";
import type { BuildOrder, DisbandOrder, FactionId, GameState, RecruitOrder, ReplenishOrder, ResourceId, Resources, Scenario, TerritoryId, UnitState } from "../engine/types";

/**
 * U11 (note 16): the balance view behind the Funds and Manpower chips, one flat list of rows.
 *
 * The accounting (pinned by tests): a chip reads `Funds <now> <next turn>`.
 * - **now** is the balance less this turn's Build and Recruit orders, which are paid when
 *   queued.
 * - **next turn** is this list's total: each territory's yield (a contested one shows its loss
 *   on its own row and pays nothing), less raid cuts, less this turn's Replenish orders, less
 *   upkeep (D1, one line per unit type), and the fractions of a point the carry keeps.
 * Every order is still paid once: `now + next turn` is what the faction has after the turn, to
 * the thousandth (`projectedHoldings`).
 */

/** D1: what one unit type's upkeep takes: "Militia column, 7 at 1.5k". */
export interface LedgerLine {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

export interface LedgerRow {
  readonly key: string;
  readonly kind: "expense" | "raid" | "territory";
  readonly label: string;
  /** The row's breakdown, opened from the row. */
  readonly lines?: readonly LedgerLine[];
  /** A contested territory's yield it does not receive, as a positive amount. */
  readonly loss: number;
  readonly note?: string;
  /** What the row adds to next turn, after any loss. */
  readonly value: number;
  /** A territory's yield before any loss. */
  readonly yield: number;
}

export interface Ledger {
  /** The chip's first figure: the balance less this turn's Build and Recruit orders. */
  readonly now: number;
  readonly resourceId: ResourceId;
  readonly rows: readonly LedgerRow[];
  /** What this turn's Build and Recruit orders spend. */
  readonly spent: number;
  readonly held: number;
  /** The chip's second figure: the sum of the rows. */
  readonly total: number;
}

export interface LedgerOrders {
  readonly builds?: readonly BuildOrder[];
  readonly disbands?: readonly DisbandOrder[];
  readonly recruits?: readonly RecruitOrder[];
  readonly replenishments?: readonly ReplenishOrder[];
}

interface TerritoryYield {
  readonly contested: boolean;
  readonly held: number;
  readonly of: number;
  readonly territoryId: TerritoryId;
  readonly name: string;
  readonly yield: Resources;
}

/** Each territory where the viewer holds a sub-territory: the yield of what it holds there. */
function territoryYields(scenario: Scenario, state: GameState, viewer: FactionId): readonly TerritoryYield[] {
  return scenario.territories.flatMap((territory): TerritoryYield[] => {
    const subs = subTerritoriesOf(scenario, territory.id);
    const mine = subs.flatMap((sub) => {
      const site = state.subTerritories[sub.id];
      return site?.holder === viewer ? [site] : [];
    });
    if (mine.length === 0) return [];
    return [{
      contested: holdersIn(scenario, state.subTerritories, territory.id).length > 1,
      held: mine.length,
      name: territory.name,
      of: subs.length,
      territoryId: territory.id,
      yield: sumResources(...mine.map((site) => subTerritoryYield(scenario, site)))
    }];
  });
}

/** U11: one ledger per resource, in the scenario's order. */
export function ledgersFor(scenario: Scenario, state: GameState, viewer: FactionId, orders: LedgerOrders): readonly Ledger[] {
  const income = incomeFor(scenario, state, viewer);
  const territories = territoryYields(scenario, state, viewer);
  const balance = treasuryOf(state, viewer);
  const upfront = plannedSpend(scenario, [...orders.builds ?? [], ...orders.recruits ?? []]);
  const queued = Object.values(state.subTerritories).flatMap((site) => site.queue).filter((item) => item.factionId === viewer).length + (orders.builds ?? []).length;
  const replenishing = (orders.replenishments ?? []).flatMap((order): UnitState[] => {
    const unit = state.units[order.unitId];
    return unit === undefined ? [] : [unit];
  });
  // B2: Replenish takes whole points and leaves the fraction it owes in the carry.
  const replenishPaid = priceReplenishments(scenario, state, viewer, replenishing).total;
  const replenishOwed = sumResources(...replenishing.flatMap((unit) => replenishQuote(scenario, state, unit)?.owed ?? []));
  const paying = upkeepLines(scenario, state, viewer, [...orders.disbands ?? [], ...orders.recruits ?? []]);
  return scenario.resources.map((resource): Ledger => {
    const id = resource.id;
    const places = territories
      .map((place) => ({ ...place, amount: amountOf(place.yield, id) }))
      .filter((place) => place.amount !== 0 || place.contested)
      .map((place): LedgerRow => ({
        key: place.territoryId,
        kind: "territory",
        label: place.name,
        loss: place.contested ? place.amount : 0,
        ...(place.contested ? { note: `${String(place.held)}/${String(place.of)} held` } : {}),
        value: place.contested ? 0 : place.amount,
        yield: place.amount
      }))
      .sort((a, b) => b.value - a.value || b.loss - a.loss);
    const cut = amountOf(income.cut, id);
    const replenish = amountOf(replenishPaid, id);
    const carried = toThousandth(replenish - (amountOf(replenishOwed, id) + amountOf(carryOf(state, viewer), id)) / carryScale);
    const rows: readonly LedgerRow[] = [
      ...places,
      ...(cut === 0 ? [] : [expense("raids", "Raids", "cut for a turn", -cut, "raid")]),
      ...(carried === 0 ? [] : [expense("carried", "Carried over", "fractions of a point", carried)]),
      expense("builds", "Builds under way", queued === 0 ? "none" : "paid when queued", 0),
      expense("replenish", "Replenish", replenishing.length === 0 ? "none planned" : `${String(replenishing.length)} ${replenishing.length === 1 ? "unit" : "units"}, planned this turn`, -replenish),
      upkeepRow(scenario, id, paying)
    ];
    const held = amountOf(balance, id);
    const spent = amountOf(upfront, id);
    return { held, now: held - spent, resourceId: id, rows, spent, total: toThousandth(rows.reduce((sum, row) => sum + row.value, 0)) };
  });
}

/** D1: the Upkeep row of one resource: how many units pay it, the sum, and a line per type, the dearest first. */
function upkeepRow(scenario: Scenario, id: ResourceId, paying: readonly UpkeepLine[]): LedgerRow {
  const own = paying.filter(({ type }) => type.upkeep[id] !== undefined);
  const count = own.reduce((sum, line) => sum + line.count, 0);
  const lines = own.map((line): LedgerLine => ({
    key: line.type.id,
    label: `${line.type.name}, ${String(line.count)} at ${resourceAmount(scenario, id, amountOf(line.type.upkeep, id))}`,
    value: -toThousandth(line.count * amountOf(line.type.upkeep, id))
  })).sort((a, b) => a.value - b.value);
  const note = scenario.upkeep === undefined ? "none in this scenario" : count === 0 ? "none" : `${String(count)} ${count === 1 ? "unit" : "units"}`;
  return { ...expense("upkeep", "Upkeep", note, toThousandth(lines.reduce((sum, line) => sum + line.value, 0))), ...(lines.length === 0 ? {} : { lines }) };
}

function expense(key: string, label: string, note: string, value: number, kind: LedgerRow["kind"] = "expense"): LedgerRow {
  return { key, kind, label, loss: 0, note, value, yield: 0 };
}

/** Where each resource comes from, from the scenario's development tracks: "Funds come from Mines and Industry." */
export function yieldSources(scenario: Scenario): readonly string[] {
  return scenario.resources.flatMap((resource) => {
    const tracks = scenario.development.filter((track) => track.resource === resource.id).map((track) => track.name);
    return tracks.length === 0 ? [] : [`${resource.name} comes from ${tracks.join(" and ")}.`];
  });
}

export interface ProductionRow {
  readonly capital: boolean;
  /** Development levels: "Farms 1 \u00b7 Industry 3", or "No development". */
  readonly levels: string;
  readonly name: string;
  /** U3: a raid cut this sub-territory's yield this turn. */
  readonly raided: boolean;
  /** Another faction holds it; its yield goes there, or nowhere while contested. */
  readonly holder: FactionId;
  readonly subTerritoryId: string;
  readonly yield: Resources;
}

export interface Production {
  readonly contested: boolean;
  /** The sum of the sub-territories' yields: what the holder is paid when it holds the territory whole. */
  readonly total: Resources;
  readonly rows: readonly ProductionRow[];
}

/** U9: the Production tab: what each sub-territory of a territory yields, and the territory's total. */
export function productionOf(scenario: Scenario, state: GameState, territoryId: TerritoryId): Production {
  const rows = subTerritoriesOf(scenario, territoryId).flatMap((sub): ProductionRow[] => {
    const site = state.subTerritories[sub.id];
    if (site === undefined) return [];
    const levels = scenario.development.flatMap((track) => {
      const level = site.development[track.id] ?? 0;
      return level > 0 ? [`${track.name} ${String(level)}`] : [];
    });
    return [{
      capital: scenario.index.territories.get(territoryId)?.capitalSubTerritoryId === sub.id,
      holder: site.holder,
      levels: levels.length === 0 ? "No development" : levels.join(` ${glyphs.dot} `),
      name: sub.name,
      raided: state.raidCuts.some((cut) => cut.subTerritoryId === sub.id && cut.turnNumber === state.turnNumber),
      subTerritoryId: sub.id,
      yield: subTerritoryYield(scenario, site)
    }];
  });
  return { contested: holdersIn(scenario, state.subTerritories, territoryId).length > 1, rows, total: sumResources(...rows.map((row) => row.yield)) };
}
