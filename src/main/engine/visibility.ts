import type { FactionId, GameState, Order, Scenario, SubTerritoryId, SubTerritoryState, TerritoryId, TurnOutcome } from "./types";

/**
 * $6, U4: the game state as one faction may see it. Other factions' treasuries, build queue
 * items and units in training are hidden, except where the viewer's recon reveals them this
 * turn: a revealed territory shows its holders' balances and its queues and training. The
 * viewer's own reveals stay; other factions' reveals are dropped. Everything on the board
 * (units, control, buildings, development) stays public. Under `m2-strength` nothing is hidden.
 * With no viewer (a report several local players share) only public information is left.
 */
export function viewFor(scenario: Scenario, state: GameState, viewer: FactionId | undefined): GameState {
  const reveals = activeReveals(state, viewer);
  const revealed = new Set<TerritoryId>(reveals.map((reveal) => reveal.territoryId));
  const territoryOf = (subTerritoryId: SubTerritoryId): TerritoryId | undefined => scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  const visibleFactions = new Set<FactionId>([...(viewer === undefined ? [] : [viewer]), ...[...revealed].flatMap((territoryId) => holdersOf(scenario, state, territoryId))]);

  const subTerritories: Record<SubTerritoryId, SubTerritoryState> = {};
  for (const [id, site] of Object.entries(state.subTerritories) as [SubTerritoryId, SubTerritoryState][]) {
    const territoryId = territoryOf(id);
    const open = territoryId !== undefined && revealed.has(territoryId);
    subTerritories[id] = open ? site : { ...site, queue: site.queue.filter((item) => item.factionId === viewer) };
  }
  return {
    ...state,
    reveals,
    subTerritories,
    training: state.training.filter((item) => item.factionId === viewer || revealed.has(item.territoryId)),
    treasuries: Object.fromEntries(Object.entries(state.treasuries).filter(([factionId]) => visibleFactions.has(factionId as FactionId))),
    // B2: the Replenish carry is the viewer's own bookkeeping; nobody else's shows.
    ...(state.replenishCarry === undefined ? {} : { replenishCarry: Object.fromEntries(Object.entries(state.replenishCarry).filter(([factionId]) => factionId === viewer)) })
  };
}

function activeReveals(state: GameState, viewer: FactionId | undefined): GameState["reveals"] {
  return state.reveals.filter((reveal) => reveal.viewerFactionId === viewer && reveal.untilTurn >= state.turnNumber);
}

/**
 * Whose private data an outcome or order carries, and who else may open it:
 * - `territory`: the viewer's recon of that territory opens it (queues, training, purchases);
 * - `holders`: recon of any territory the owner holds opens it (balances and income);
 * - `owner`: nothing opens it (recon and anything whose place is not known, such as a
 *   Replenish for a unit that died this turn).
 */
type Privacy =
  | { readonly factionIds: readonly FactionId[]; readonly scope: "holders" | "owner" }
  | { readonly factionIds: readonly FactionId[]; readonly scope: "territory"; readonly territoryId: TerritoryId };

function located(factionIds: readonly FactionId[], territoryId: TerritoryId | undefined): Privacy {
  return territoryId === undefined ? { factionIds, scope: "owner" } : { factionIds, scope: "territory", territoryId };
}

function privacyOf(scenario: Scenario, state: GameState, outcome: TurnOutcome): Privacy | undefined {
  const at = (subTerritoryId: SubTerritoryId): TerritoryId | undefined => scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  switch (outcome.kind) {
    case "income":
      return { factionIds: [outcome.factionId], scope: "holders" };
    case "build-queued":
      return located([outcome.order.factionId], at(outcome.order.subTerritoryId));
    case "build-progressed":
    case "build-refunded":
      return located([outcome.factionId], at(outcome.subTerritoryId));
    case "build-forfeited":
      return located([outcome.previousHolder, outcome.newHolder], at(outcome.subTerritoryId));
    case "training-started":
      return located([outcome.order.factionId], outcome.order.territoryId);
    case "training-paused":
    case "training-refunded":
      return located([outcome.factionId], outcome.territoryId);
    case "replenish-applied":
    case "replenish-cancelled":
    case "recon":
    case "grounded":
    case "rejected-order":
      // The order's own rule (CT-53): a grounded or refused order is as private as the order.
      return orderPrivacy(scenario, state, outcome.order);
    case "interception":
      // A shot-down recon names the territory it flew over: only the fighters and the fliers see it.
      return outcome.reconFactionIds === undefined ? undefined : { factionIds: [outcome.factionId, ...outcome.reconFactionIds], scope: "owner" };
    // Public: on the board, or every side's to see (CT-46). Listed one by one, so a new kind
    // cannot be added without deciding who sees it.
    case "air-support":
    case "aircraft-lost":
    case "aircraft-rebased":
    case "battle":
    case "bounced-move":
    case "build-completed":
    case "disbanded-move":
    case "fatigue":
    case "frostbite":
    case "general-died":
    case "general-moved":
    case "general-sacked":
    case "invalid-order":
    case "move-held-back":
    case "move-intercepted":
    case "move-transit":
    case "no-move":
    case "path-surrender":
    case "raid":
    case "rail-damaged":
    case "rallied":
    case "recovered":
    case "reinforcement-arrived":
    case "replacement-arrived":
    case "replacement-due":
    case "successful-move":
    case "time-ran-out":
    case "training-completed":
    case "weather-rolled":
    case "withdrew":
      return undefined;
    default: {
      const unknown: never = outcome;
      throw new Error(`No privacy rule for outcome ${JSON.stringify(unknown)}.`);
    }
  }
}

/** Whether a viewer may see data with this privacy, given the territories its recon reveals now. */
function opens(scenario: Scenario, state: GameState, privacy: Privacy | undefined, viewer: FactionId | undefined, revealed: readonly TerritoryId[]): boolean {
  if (privacy === undefined || (viewer !== undefined && privacy.factionIds.includes(viewer))) return true;
  switch (privacy.scope) {
    case "owner":
      return false;
    case "territory":
      return revealed.includes(privacy.territoryId);
    case "holders":
      return revealed.some((territoryId) => holdersOf(scenario, state, territoryId).some((holder) => privacy.factionIds.includes(holder)));
  }
}

/**
 * $6, U4: the outcomes one faction may see. Outcomes carrying another faction's private data
 * (balances, income, queued builds, training, replenishment) are left out unless the viewer's
 * recon reveals that territory, or, for income, a territory that faction holds. Recon results,
 * grounded recon included, reach only their flier. With no viewer only public outcomes are
 * left. Every Milestone 2 outcome is public.
 */
export function outcomesFor(scenario: Scenario, state: GameState, outcomes: readonly TurnOutcome[], viewer: FactionId | undefined): readonly TurnOutcome[] {
  const revealed = activeReveals(state, viewer).map((reveal) => reveal.territoryId);
  return outcomes.filter((outcome) => opens(scenario, state, privacyOf(scenario, state, outcome), viewer, revealed));
}

/** Whose private plans an order carries: purchases, replenishment and recon. Moves and visible actions are public. */
function orderPrivacy(scenario: Scenario, state: GameState, order: Order): Privacy | undefined {
  if (isPublicOrder(order)) return undefined;
  const factionIds = [order.factionId];
  switch (order.kind) {
    case "recruit":
      return located(factionIds, order.territoryId);
    case "build":
      return located(factionIds, scenario.index.subTerritories.get(order.subTerritoryId)?.territoryId);
    case "replenish":
      // m6: a unit that died this turn has no place left, so its Replenish stays its owner's.
      return located(factionIds, state.units[order.unitId]?.territoryId);
    default:
      // Recon: its target is the flier's alone, whatever the viewer's own recon reveals.
      return { factionIds, scope: "owner" };
  }
}

/**
 * $6, T6: whether every other faction sees this order once the turn is revealed: moves and
 * visible actions (withdraw, sack, raid, interception and support), not purchases,
 * replenishment or recon. Hold counts read only public orders, so hidden ones never show.
 */
export function isPublicOrder(order: Order): boolean {
  switch (order.kind) {
    case "recruit":
    case "build":
    case "replenish":
      return false;
    case "air-mission":
      return order.mission.kind !== "recon";
    default:
      return true;
  }
}

/**
 * $6, U4: the submitted orders one faction may see once a turn is revealed (B13). Moves and
 * other visible actions stay; other factions' purchases and replenishment stay hidden unless
 * the viewer's recon reveals that territory, and their recon stays hidden.
 */
export function ordersFor(scenario: Scenario, state: GameState, orders: readonly Order[], viewer: FactionId | undefined): readonly Order[] {
  const revealed = activeReveals(state, viewer).map((reveal) => reveal.territoryId);
  return orders.filter((order) => opens(scenario, state, orderPrivacy(scenario, state, order), viewer, revealed));
}

/** U4: whether the viewer's recon reveals this territory now (a viewer's state from `viewFor` keeps only its own reveals). */
export function isRevealed(state: GameState, viewer: FactionId | undefined, territoryId: TerritoryId): boolean {
  return activeReveals(state, viewer).some((reveal) => reveal.territoryId === territoryId);
}

/** The factions holding any part of a territory: its controller, or its sub-territories' holders. */
function holdersOf(scenario: Scenario, state: GameState, territoryId: TerritoryId): readonly FactionId[] {
  const control = state.control[territoryId];
  const fromControl = control === undefined ? [] : control.kind === "controlled" ? [control.factionId] : control.factionIds;
  const fromSites = (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).flatMap((sub) => {
    const holder = state.subTerritories[sub.id]?.holder;
    return holder === undefined ? [] : [holder];
  });
  return [...fromControl, ...fromSites];
}
