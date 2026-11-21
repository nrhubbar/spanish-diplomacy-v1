import { siteRefusal } from "../../engine/economy/catalogue";
import { subTerritoriesOf, territoriesHeldWhole } from "../../engine/economy/holdings";
import { amountOf } from "../../engine/economy/resources";
import { isContested } from "../../engine/partition/holders";
import { isFriendlyGround, landNeighbors, railReach } from "../../engine/movement/network";
import { afterWork, linkKey, linkModifiers, linksOf, stationCap, territoryOfSub } from "../../engine/network/links";
import { motorPath, startSubTerritories } from "../../engine/network/paths";
import { canFight } from "../../engine/units/fighting";
import { isTransport } from "../reach";
import {
  type BuildOrder,
  type FactionId,
  type GameState,
  type LinkDefinition,
  type LinkWork,
  linkWorks,
  type Resources,
  type Scenario,
  type TerritoryId
} from "../../engine/types";

/**
 * R7: the computer player's link works (new rail lines, rail upgrades, road upgrades). It builds
 * one only when the link opens routes its armies would use: the gain is the number of new ways,
 * from a territory where its armies stand, to reach a front territory (own ground bordering the
 * enemy) by rail, or a front or enemy territory by Motor. A work that opens nothing is never
 * queued, so it doesn't over-build ("the AI should be able to, not required to").
 * - Rail works (a new line or single to main) count new rail rides; a new line only where one
 *   end has a station already.
 * - A road upgrade counts new Motor routes, and only while the faction has trucks to drive them.
 * - One link work at a time: none while one of its own is queued.
 * The score is the gain (at most `countedRoutes`) per point of price, against the other builds' scores.
 */

/**
 * Design notes for the harness to tune (H7): a link work's score per route it opens, per point of
 * price, and the most routes that count, so a road upgrade that opens many Motor routes still
 * ranks with Fortifications (6) and the better development items, not above them all.
 */
const routeScore = 6;
const countedRoutes = 4;

export interface LinkCandidate {
  readonly order: BuildOrder;
  readonly score: number;
}

type Where = { readonly factionId: FactionId; readonly scenario: Scenario; readonly state: GameState };

/** The best link work worth queueing within `budget`, or undefined when none opens a route. */
export function linkWorkCandidate(context: Where, front: ReadonlySet<TerritoryId>, budget: Resources): LinkCandidate | undefined {
  const { factionId, scenario, state } = context;
  const projects = scenario.linkProjects;
  if (projects === undefined || queuedLinkWork(state, factionId)) return undefined;
  const origins = armyTerritories(scenario, state, factionId);
  const trucks = Object.values(state.units).some((unit) => unit.factionId === factionId && isTransport(scenario, state, unit.id));
  const seen = new Set<string>();
  let best: LinkCandidate | undefined;
  for (const territoryId of territoriesHeldWhole(scenario, state.subTerritories, factionId)) {
    for (const sub of subTerritoriesOf(scenario, territoryId)) {
      if (state.subTerritories[sub.id]?.queue.length !== 0) continue;
      for (const { link } of linksOf(scenario, sub.id)) {
        for (const work of linkWorks) {
          const key = `${linkKey(link.a, link.b)}|${work}`;
          const price = priceOf(projects[work].cost, budget);
          if (seen.has(key) || price === undefined || (work === "road-upgrade" && !trucks)) continue;
          const project = { a: link.a, b: link.b, kind: "link", work } as const;
          if (siteRefusal(scenario, state, factionId, sub.id, project) !== undefined) continue;
          if (work === "new-rail" && !hasStation(state, link)) continue;
          seen.add(key);
          const gain = linkWorkGain(scenario, state, factionId, link, work, origins, front);
          const score = (routeScore * Math.min(gain, countedRoutes)) / price;
          if (gain > 0 && (best === undefined || score > best.score)) best = { order: { factionId, kind: "build", project, subTerritoryId: sub.id }, score };
        }
      }
    }
  }
  return best;
}

/** The work's price summed over its resources, when the budget covers it. */
function priceOf(cost: Resources, budget: Resources): number | undefined {
  const entries = Object.entries(cost);
  if (entries.some(([id, amount]) => amountOf(budget, id as keyof Resources) < amount)) return undefined;
  return Math.max(1, entries.reduce((sum, [, amount]) => sum + amount, 0));
}

function queuedLinkWork(state: GameState, factionId: FactionId): boolean {
  return Object.values(state.subTerritories).some((site) => site.queue.some((item) => item.factionId === factionId && item.project.kind === "link"));
}

function hasStation(state: GameState, link: LinkDefinition): boolean {
  return [link.a, link.b].some((end) => Number(state.subTerritories[end]?.rail) > 0);
}

/** Territories the faction holds whole where its armies that can fight stand: where routes start. */
function armyTerritories(scenario: Scenario, state: GameState, factionId: FactionId): readonly TerritoryId[] {
  const whole = new Set(territoriesHeldWhole(scenario, state.subTerritories, factionId));
  const here = new Set(Object.values(state.units).filter((unit) => unit.factionId === factionId && canFight(scenario, state.raised, unit.id)).map((unit) => unit.territoryId));
  return scenario.territories.map((territory) => territory.id).filter((id) => whole.has(id) && here.has(id));
}

/**
 * R7: the board once the work is done, as the queue completes it (declog D12): the link's new
 * modifiers, and each end's station raised by what its cap gained.
 */
export function afterLinkWork(scenario: Scenario, state: GameState, link: LinkDefinition, work: LinkWork): GameState {
  const modifiers = afterWork(linkModifiers(link, state), work) ?? linkModifiers(link, state);
  const built: GameState = { ...state, builtLinks: { ...state.builtLinks, [linkKey(link.a, link.b)]: modifiers } };
  const subTerritories = { ...state.subTerritories };
  for (const end of [link.a, link.b]) {
    const site = subTerritories[end];
    const gain = stationCap(scenario, built, end) - stationCap(scenario, state, end);
    if (site !== undefined && gain > 0) subTerritories[end] = { ...site, rail: site.rail + gain };
  }
  return { ...built, subTerritories };
}

/** How many new routes the work opens from `origins`: rail rides to the front, or Motor routes to the front or the enemy. */
export function linkWorkGain(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  link: LinkDefinition,
  work: LinkWork,
  origins: readonly TerritoryId[],
  front: ReadonlySet<TerritoryId>
): number {
  const after = afterLinkWork(scenario, state, link, work);
  if (work !== "road-upgrade") {
    const rides = (board: GameState, from: TerritoryId): number => [...railReach(scenario, board, factionId, from).keys()].filter((to) => front.has(to)).length;
    return origins.reduce((sum, from) => sum + Math.max(0, rides(after, from) - rides(state, from)), 0);
  }
  // A Motor route crosses the link only from its own territories or their neighbours.
  const ends = [territoryOfSub(scenario, link.a), territoryOfSub(scenario, link.b)].filter((id): id is TerritoryId => id !== undefined);
  const near = new Set(ends.flatMap((id) => [id, ...landNeighbors(scenario, id)]));
  const held = new Set(territoriesHeldWhole(scenario, state.subTerritories, factionId));
  const valuable = (to: TerritoryId): boolean => front.has(to) || !held.has(to);
  let gain = 0;
  for (const from of origins.filter((id) => near.has(id))) {
    // The faction's whole ground there: origins are held whole, so this is the army's pocket.
    const start = startSubTerritories(scenario, state, factionId, from);
    for (const via of landNeighbors(scenario, from)) {
      if (!isFriendlyGround(scenario, state, factionId, via)) continue;
      for (const to of landNeighbors(scenario, via)) {
        if (to === from || !valuable(to) || isContested(scenario, state, to)) continue;
        if (motorPath(scenario, after, start, [via, to]).ok && !motorPath(scenario, state, start, [via, to]).ok) gain += 1;
      }
    }
  }
  return gain;
}
