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
    treasuries: Object.fromEntries(Object.entries(state.treasuries).filter(([factionId]) => visibleFactions.has(factionId as FactionId)))
  };
}

function activeReveals(state: GameState, viewer: FactionId | undefined): GameState["reveals"] {
  return state.reveals.filter((reveal) => reveal.viewerFactionId === viewer && reveal.untilTurn >= state.turnNumber);
}

/** Whose private data an outcome carries, and where; undefined for a public outcome. */
interface Privacy {
  readonly factionIds: readonly FactionId[];
  readonly territoryId?: TerritoryId;
}

function privacyOf(scenario: Scenario, state: GameState, outcome: TurnOutcome): Privacy | undefined {
  const at = (subTerritoryId: SubTerritoryId): TerritoryId | undefined => scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  const place = (territoryId: TerritoryId | undefined): Pick<Privacy, "territoryId"> => (territoryId === undefined ? {} : { territoryId });
  switch (outcome.kind) {
    case "income":
      return { factionIds: [outcome.factionId] };
    case "build-queued":
      return { factionIds: [outcome.order.factionId], ...place(at(outcome.order.subTerritoryId)) };
    case "build-progressed":
    case "build-refunded":
      return { factionIds: [outcome.factionId], ...place(at(outcome.subTerritoryId)) };
    case "build-forfeited":
      return { factionIds: [outcome.previousHolder, outcome.newHolder], ...place(at(outcome.subTerritoryId)) };
    case "training-started":
      return { factionIds: [outcome.order.factionId], territoryId: outcome.order.territoryId };
    case "training-paused":
    case "training-refunded":
      return { factionIds: [outcome.factionId], territoryId: outcome.territoryId };
    case "replenish-applied":
    case "replenish-cancelled":
      return { factionIds: [outcome.order.factionId], ...place(state.units[outcome.order.unitId]?.territoryId) };
    case "recon":
      return { factionIds: [outcome.order.factionId] };
    default:
      return undefined;
  }
}

/**
 * $6, U4: the outcomes one faction may see. Outcomes carrying another faction's private data
 * (balances, income, queued builds, training, replenishment, recon results) are left out unless
 * the viewer's recon reveals that territory, or, for faction-wide data, a territory that faction
 * holds. With no viewer only public outcomes are left. Every Milestone 2 outcome is public.
 */
export function outcomesFor(scenario: Scenario, state: GameState, outcomes: readonly TurnOutcome[], viewer: FactionId | undefined): readonly TurnOutcome[] {
  const revealed = activeReveals(state, viewer).map((reveal) => reveal.territoryId);
  return outcomes.filter((outcome) => {
    const privacy = privacyOf(scenario, state, outcome);
    if (privacy === undefined || (viewer !== undefined && privacy.factionIds.includes(viewer))) return true;
    return privacy.territoryId === undefined
      ? revealed.some((territoryId) => holdersOf(scenario, state, territoryId).some((holder) => privacy.factionIds.includes(holder)))
      : revealed.includes(privacy.territoryId);
  });
}

/** Whose private plans an order carries: purchases, replenishment and recon. Moves and visible actions are public. */
function orderPrivacy(scenario: Scenario, state: GameState, order: Order): Privacy | undefined {
  const factionIds = [order.factionId];
  switch (order.kind) {
    case "recruit":
      return { factionIds, territoryId: order.territoryId };
    case "build": {
      const territoryId = scenario.index.subTerritories.get(order.subTerritoryId)?.territoryId;
      return { factionIds, ...(territoryId === undefined ? {} : { territoryId }) };
    }
    case "replenish": {
      const territoryId = state.units[order.unitId]?.territoryId;
      return { factionIds, ...(territoryId === undefined ? {} : { territoryId }) };
    }
    case "air-mission":
      return order.mission.kind === "recon" ? { factionIds } : undefined;
    default:
      return undefined;
  }
}

/**
 * $6, U4: the submitted orders one faction may see once a turn is revealed (B13). Moves and
 * other visible actions stay; other factions' purchases, replenishment and recon stay hidden
 * unless the viewer's recon reveals that territory.
 */
export function ordersFor(scenario: Scenario, state: GameState, orders: readonly Order[], viewer: FactionId | undefined): readonly Order[] {
  const revealed = activeReveals(state, viewer).map((reveal) => reveal.territoryId);
  return orders.filter((order) => {
    const privacy = orderPrivacy(scenario, state, order);
    return privacy === undefined || order.factionId === viewer || (privacy.territoryId !== undefined && revealed.includes(privacy.territoryId));
  });
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
