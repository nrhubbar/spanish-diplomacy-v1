import type {
  BuildProject,
  FactionId,
  EconomyTurnOutcome,
  LinkModifier,
  LinkProject,
  RailDamagedOutcome,
  Scenario,
  SubTerritoryId,
  SubTerritoryState,
  SystemOutcome
} from "../types";
import { draftState, type Phase, type SystemState } from "../phases/draft";
import { afterWork, linkBetween, linkKey, linkModifiers, stationCap } from "../network/links";
import { applyBuildOrder, levelCap, projectCost } from "./catalogue";
import { holdersIn, isContested } from "./holdings";
import { incomeFor } from "./income";
import { credit } from "./resources";

/**
 * The economy module's parts of the turn ($1-$8):
 * - step 1: pay for Build orders and queue them;
 * - step 10: hand queues over on capture, damage rail where a territory became contested, and
 *   advance the queues;
 * - step 11: income from whole territories.
 */

type Sites = SystemState["subTerritories"];

/**
 * Step 1 ($5): every Build order that passed validation against the start-of-turn state is paid
 * and queued, in submission order, against a running ledger: an order the balance can no longer
 * cover, or a second order for the same building, fails as a private `build-refunded` with an
 * empty refund (nothing was paid), so other factions never learn where or how short it was ($6).
 * Builds pay before Recruit orders, since the economy part runs first (area order).
 */
export const payForBuilds: Phase = (draft) => {
  const { scenario, submissions } = draft.input;
  if (!submissions.some((submission) => submission.orders.some((order) => order.kind === "build"))) return draft;
  const alreadyRejected = new Set(draft.orders.rejected.map((outcome) => outcome.order));
  let ledger: SystemState = draft.systems;
  const events: EconomyTurnOutcome[] = [];
  for (const submission of submissions) {
    for (const order of submission.orders) {
      if (order.kind !== "build" || alreadyRejected.has(order)) continue;
      const applied = applyBuildOrder(scenario, ledger, order);
      if (applied.ok) {
        ledger = applied.state;
        events.push({ kind: "build-queued", order, paid: applied.paid, position: applied.position });
      } else {
        events.push({ factionId: order.factionId, kind: "build-refunded", project: order.project, reason: applied.reason, refund: {}, subTerritoryId: order.subTerritoryId });
      }
    }
  }
  return {
    ...draft,
    events: [...draft.events, ...events],
    systems: ledger
  };
};

/**
 * $5: sub-territories that changed hands this turn. The item in progress (the queue's head, once
 * it has a turn of progress) passes to the new holder with its progress, and its payment is
 * lost. Every other item is refunded to the faction that queued it. Buildings stay (captured
 * intact).
 */
export function handOverQueues(
  scenario: Scenario,
  before: Sites,
  systems: SystemState
): { readonly events: readonly EconomyTurnOutcome[]; readonly systems: SystemState } {
  let { treasuries } = systems;
  const subTerritories: Record<SubTerritoryId, SubTerritoryState> = { ...systems.subTerritories };
  const events: EconomyTurnOutcome[] = [];
  for (const sub of scenario.subTerritories) {
    const was = before[sub.id];
    const site = subTerritories[sub.id];
    if (was === undefined || site === undefined || was.holder === site.holder || site.queue.length === 0) continue;
    const [head, ...rest] = site.queue;
    const inherited = head !== undefined && head.progress > 0 ? head : undefined;
    for (const item of inherited === undefined ? site.queue : rest) {
      treasuries = credit(treasuries, item.factionId, item.paid);
      events.push({ factionId: item.factionId, kind: "build-refunded", project: item.project, reason: "captured", refund: item.paid, subTerritoryId: sub.id });
    }
    if (inherited !== undefined) {
      events.push({ kind: "build-forfeited", lost: inherited.paid, newHolder: site.holder, previousHolder: inherited.factionId, project: inherited.project, subTerritoryId: sub.id });
    }
    subTerritories[sub.id] = { ...site, queue: inherited === undefined ? [] : [{ ...inherited, factionId: site.holder, paid: {} }] };
  }
  return { events, systems: { ...systems, subTerritories, treasuries } };
}

/**
 * $8: a territory held whole at the start of the turn and contested now loses rail in the
 * sub-territories its attackers hold (every holder but the one that held it whole), by the
 * scenario's `railDamageOnContest` levels, never below 0. Repairing is an ordinary rail order.
 */
export function damageRail(
  scenario: Scenario,
  before: Sites,
  systems: SystemState
): { readonly events: readonly RailDamagedOutcome[]; readonly systems: SystemState } {
  const damage = scenario.improvements?.railDamageOnContest ?? 0;
  if (damage <= 0) return { events: [], systems };
  const subTerritories: Record<SubTerritoryId, SubTerritoryState> = { ...systems.subTerritories };
  const events: RailDamagedOutcome[] = [];
  for (const territory of scenario.territories) {
    const previous = holdersIn(scenario, before, territory.id);
    if (previous.length !== 1 || !isContested(scenario, subTerritories, territory.id)) continue;
    for (const sub of scenario.index.subTerritoriesByTerritory.get(territory.id) ?? []) {
      const site = subTerritories[sub.id];
      if (site === undefined || site.holder === previous[0] || site.rail === 0) continue;
      const after = Math.max(0, site.rail - damage);
      subTerritories[sub.id] = { ...site, rail: after };
      events.push({ after, before: site.rail, kind: "rail-damaged", subTerritoryId: sub.id });
    }
  }
  return { events, systems: { ...systems, subTerritories } };
}

/** A finished project applied to its sub-territory; link works are applied by `completeLink`. */
function complete(scenario: Scenario, systems: SystemState, subTerritoryId: SubTerritoryId, site: SubTerritoryState, project: BuildProject): SubTerritoryState {
  const max = levelCap(scenario, systems, subTerritoryId, project);
  switch (project.kind) {
    case "building":
      return site.buildings.includes(project.buildingId) ? site : { ...site, buildings: [...site.buildings, project.buildingId] };
    case "development":
      return { ...site, development: { ...site.development, [project.developmentId]: Math.min(max, (site.development[project.developmentId] ?? 0) + 1) } };
    case "improvement":
      return { ...site, [project.improvement]: Math.min(max, site[project.improvement] + 1) };
    case "link":
      return site;
  }
}

/**
 * R7: a finished link work changes the link's modifiers (`builtLinks`). A station at either end
 * gains what its cap gained, so a new line opens a station and an upgrade adds a departure.
 * A work that no longer fits the link (another finished first) changes nothing.
 */
function completeLink(scenario: Scenario, systems: SystemState, subTerritories: Record<SubTerritoryId, SubTerritoryState>, project: LinkProject): SystemState["builtLinks"] {
  const link = linkBetween(scenario, project.a, project.b);
  const modifiers = link === undefined ? undefined : afterWork(linkModifiers(link, systems), project.work);
  if (modifiers === undefined) return systems.builtLinks;
  const builtLinks: Record<string, readonly LinkModifier[]> = { ...systems.builtLinks, [linkKey(project.a, project.b)]: modifiers };
  for (const end of [project.a, project.b]) {
    const site = subTerritories[end];
    const gain = stationCap(scenario, { builtLinks }, end) - stationCap(scenario, systems, end);
    if (site !== undefined && gain > 0) subTerritories[end] = { ...site, rail: site.rail + gain };
  }
  return builtLinks;
}

/** R7, declog D16: a link work waits while its far end is not the builder's, or its territory is contested. */
function farEndReady(scenario: Scenario, subTerritories: SystemState["subTerritories"], at: SubTerritoryId, project: LinkProject, factionId: FactionId): boolean {
  const far = project.a === at ? project.b : project.a;
  const territoryId = scenario.index.subTerritories.get(far)?.territoryId;
  return subTerritories[far]?.holder === factionId && territoryId !== undefined && !isContested(scenario, subTerritories, territoryId);
}

/**
 * $5: each queue's head gains a turn of progress, unless its territory is contested (paused); a
 * link work also waits on its far end (`farEndReady`).
 * An item queued this turn makes its first turn of progress at once, so a 2-turn building
 * ordered on turn t stands at the end of turn t + 1. A finished item applies and leaves the
 * queue; the next one starts next turn.
 */
export function advanceQueues(scenario: Scenario, systems: SystemState): { readonly events: readonly EconomyTurnOutcome[]; readonly systems: SystemState } {
  const subTerritories: Record<SubTerritoryId, SubTerritoryState> = { ...systems.subTerritories };
  let { builtLinks } = systems;
  const events: EconomyTurnOutcome[] = [];
  for (const sub of scenario.subTerritories) {
    const site = subTerritories[sub.id];
    const head = site?.queue[0];
    if (site === undefined || head === undefined || isContested(scenario, subTerritories, sub.territoryId)) continue;
    if (head.project.kind === "link" && !farEndReady(scenario, subTerritories, sub.id, head.project, head.factionId)) continue;
    const turns = projectCost(scenario, head.project)?.turns ?? 1;
    const progress = head.progress + 1;
    if (progress >= turns) {
      const now: SystemState = builtLinks === undefined ? systems : { ...systems, builtLinks };
      subTerritories[sub.id] = { ...complete(scenario, now, sub.id, site, head.project), queue: site.queue.slice(1) };
      if (head.project.kind === "link") builtLinks = completeLink(scenario, now, subTerritories, head.project);
      events.push({ factionId: head.factionId, kind: "build-completed", project: head.project, subTerritoryId: sub.id });
    } else {
      subTerritories[sub.id] = { ...site, queue: [{ ...head, progress }, ...site.queue.slice(1)] };
      events.push({ factionId: head.factionId, kind: "build-progressed", progress, project: head.project, subTerritoryId: sub.id, turns });
    }
  }
  return { events, systems: { ...systems, ...(builtLinks === undefined ? {} : { builtLinks }), subTerritories } };
}

/** Step 10 ($5, $8): hand-overs and rail damage from this turn's flips, then the queues advance. */
export const advanceBuildQueues: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const handed = handOverQueues(scenario, start.subTerritories, draft.systems);
  const damaged = damageRail(scenario, start.subTerritories, handed.systems);
  const advanced = advanceQueues(scenario, damaged.systems);
  const events: SystemOutcome[] = [...handed.events, ...damaged.events, ...advanced.events];
  if (events.length === 0) return draft;
  return { ...draft, events: [...draft.events, ...events], systems: advanced.systems };
};

/** Step 11 ($2, U3): each faction with a treasury is paid its income, after raid cuts. */
export const collectIncome: Phase = (draft) => {
  const { scenario } = draft.input;
  const state = draftState(draft);
  let { treasuries } = draft.systems;
  const events: EconomyTurnOutcome[] = [];
  if (Object.keys(treasuries).length === 0) return draft;
  for (const faction of scenario.factions) {
    if (treasuries[faction.id] === undefined) continue;
    const income = incomeFor(scenario, state, faction.id);
    treasuries = credit(treasuries, faction.id, income.paid);
    events.push({ cut: income.cut, cutSubTerritoryIds: income.cutSubTerritoryIds, factionId: faction.id, kind: "income", paid: income.paid });
  }
  return { ...draft, events: [...draft.events, ...events], systems: { ...draft.systems, treasuries } };
};

