import type { FactionId, GameState, Scenario, SubTerritoryId, SubTerritoryState, TerritoryId } from "./types";

/**
 * $6, U4: the game state as one faction may see it. Other factions' treasuries, build queue
 * items and units in training are hidden, except where the viewer's recon reveals them this
 * turn: a revealed territory shows its holders' balances and its queues and training. The
 * viewer's own reveals stay; other factions' reveals are dropped. Everything on the board
 * (units, control, buildings, development) stays public. Under `m2-strength` nothing is hidden.
 */
export function viewFor(scenario: Scenario, state: GameState, viewer: FactionId): GameState {
  const reveals = state.reveals.filter((reveal) => reveal.viewerFactionId === viewer && reveal.untilTurn >= state.turnNumber);
  const revealed = new Set<TerritoryId>(reveals.map((reveal) => reveal.territoryId));
  const territoryOf = (subTerritoryId: SubTerritoryId): TerritoryId | undefined => scenario.index.subTerritories.get(subTerritoryId)?.territoryId;
  const visibleFactions = new Set<FactionId>([viewer, ...[...revealed].flatMap((territoryId) => holdersOf(scenario, state, territoryId))]);

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
