import { isAirbaseFor, territoriesWithin, unitDefinitionIn, unitKindIn, unitTypeIn } from "../air/pieces";
import { airScratch } from "../air/scratch";
import { compareIds, removeArmies, replaceArmies } from "../board";
import { pick } from "../dice";
import type { Phase, TurnDraft } from "../phases/draft";
import type {
  FactionId,
  GameState,
  GeneralId,
  SackOrder,
  Scenario,
  SystemOutcome,
  TerritoryId,
  UnitId,
  UnitState
} from "../types";
import { bestGeneral, canRally } from "./command";
import { generalUnitDefinition, generalUnitId } from "./identity";
import { callReplacement, fieldedGenerals } from "./roster";

/**
 * U5: Sack is a free order. The general leaves at once (he does not fight this turn) and the next
 * general on the roster is called (D7). Runs inside step 1's air part.
 */
export function sackGenerals(draft: TurnDraft, orders: readonly SackOrder[]): TurnDraft {
  const { scenario, start } = draft.input;
  let generals = draft.systems.generals;
  const events: SystemOutcome[] = [];
  const sacked: UnitId[] = [];
  for (const order of orders) {
    const unit = draft.armies[order.unitId];
    const generalId = unit === undefined ? undefined : unitDefinitionIn(scenario, start.raised, unit.id)?.generalId;
    if (unit === undefined || generalId === undefined) continue;
    sacked.push(unit.id);
    events.push({ generalId, kind: "general-sacked", order });
    const unavailable = fieldedGenerals(scenario, start.raised, Object.values(start.units));
    const called = callReplacement(scenario, generals, unit.factionId, unavailable, start.turnNumber);
    generals = called.generals;
    if (called.outcome !== undefined) events.push(called.outcome);
  }
  if (sacked.length === 0) return draft;
  return {
    ...draft,
    armies: removeArmies(draft.armies, sacked),
    events: [...draft.events, ...events],
    systems: { ...draft.systems, generals }
  };
}

/** The territory a faction holds whole (or at least controls) nearest its seat: the seat itself, else the first in scenario order. */
function fallbackTerritory(scenario: Scenario, control: GameState["control"], factionId: FactionId): TerritoryId | undefined {
  const holds = (id: TerritoryId): boolean => {
    const entry = control[id];
    return entry?.kind === "controlled" && entry.factionId === factionId;
  };
  const seat = scenario.index.factions.get(factionId)?.seatTerritoryId;
  if (seat !== undefined && holds(seat)) return seat;
  return scenario.territories.find((territory) => holds(territory.id))?.id;
}

/**
 * Step 9, after the dice module's morale part (AG-3, AG-8 to AG-10):
 * 1. Aircraft come back to their bases. One whose base is lost rebases to the nearest airbase of
 *    its faction within range, or is lost.
 * 2. Generals come back: a moving general arrives where his army arrived, else stays. When his
 *    army was destroyed or routed, or he stood alone in ground the enemy took, he rolls on the
 *    `general-death` stream; a survivor follows the retreat, or goes to the seat territory.
 * 3. The best general with each army rallies its demoralized units (C5, D5, D7).
 * 4. Replacement generals due this turn appear in the seat territory (D7).
 * Support missions are reported with the battle they joined.
 */
export const commandChanges: Phase = (draft) => {
  const { scenario, start, streams } = draft.input;
  const scratch = airScratch(draft);
  const turn = start.turnNumber;
  const control = draft.control.control;
  const events: SystemOutcome[] = [];
  let armies = draft.armies;
  let generals = draft.systems.generals;
  let raised = draft.systems.raised;

  for (const order of scratch.support) {
    const territoryId = order.mission.kind === "support" ? order.mission.territoryId : undefined;
    if (territoryId === undefined) continue;
    const battle = [...draft.front.battles, ...draft.standing].find((pending) =>
      pending.site.territoryId === territoryId
      && (pending.battle.engagement.attackerFactionId === order.factionId
        || pending.battle.engagement.defenders.some((combatant) => combatant.unit.factionId === order.factionId)));
    events.push({ kind: "air-support", order, territoryId, ...(battle === undefined ? {} : { battleIndex: battle.battle.index }) });
  }

  const aside = Object.values(scratch.aside).sort((a, b) => compareIds(a.id, b.id));
  const restored: UnitState[] = [];
  for (const unit of aside) {
    if (unitKindIn(scenario, start.raised, unit.id) !== "air") continue;
    const state = { control, subTerritories: draft.systems.subTerritories };
    if (isAirbaseFor(scenario, state, unit.territoryId, unit.factionId)) {
      restored.push(unit);
      continue;
    }
    const range = unitTypeIn(scenario, start.raised, unit.id)?.air?.range ?? 0;
    const reach = [...territoriesWithin(scenario, unit.territoryId, range)]
      .filter(([id]) => isAirbaseFor(scenario, state, id, unit.factionId))
      .sort((a, b) => a[1] - b[1] || territoryOrder(scenario, a[0]) - territoryOrder(scenario, b[0]));
    const base = reach[0]?.[0];
    if (base === undefined) {
      events.push({ factionId: unit.factionId, from: unit.territoryId, kind: "aircraft-lost", unitId: unit.id });
    } else {
      restored.push({ ...unit, territoryId: base });
      events.push({ factionId: unit.factionId, from: unit.territoryId, kind: "aircraft-rebased", to: base, unitId: unit.id });
    }
  }

  const retreatedTo = new Map<UnitId, TerritoryId>();
  const surrendered = new Set<UnitId>();
  for (const entry of draft.settled) {
    if (entry.kind === "retreated") retreatedTo.set(entry.leaving.unitId, entry.to);
    if (entry.kind === "surrendered") surrendered.add(entry.leaving.unitId);
  }
  const deathRoll = scenario.air?.generalDeathRoll ?? 0;
  let deathIndex = 0;
  const died: UnitId[] = [];
  for (const unit of aside) {
    if (unitKindIn(scenario, start.raised, unit.id) !== "general") continue;
    const generalId = unitDefinitionIn(scenario, start.raised, unit.id)?.generalId;
    if (generalId === undefined) continue;
    const members = scratch.armies[unit.id] ?? [];
    const target = scratch.generalMoves[unit.id];
    const ownGroundIn = (id: TerritoryId): boolean => Object.values(armies).some((other) => other.territoryId === id && other.factionId === unit.factionId);
    const position = target !== undefined && ownGroundIn(target) ? target : unit.territoryId;
    if (target !== undefined) {
      events.push({ arrived: position === target, kind: "general-moved", order: { factionId: unit.factionId, from: unit.territoryId, kind: "move", to: target, unitId: unit.id } });
    }
    const gone = (id: UnitId): boolean => armies[id] === undefined || retreatedTo.has(id) || surrendered.has(id);
    const routedTo = members.map((id) => retreatedTo.get(id)).find((to) => to !== undefined);
    const positionControl = control[position];
    const overrun = members.length === 0
      ? (positionControl?.kind === "controlled" && positionControl.factionId !== unit.factionId)
        || (!ownGroundIn(position) && Object.values(armies).some((other) => other.territoryId === position && other.factionId !== unit.factionId))
      : members.every(gone);
    if (!overrun) {
      restored.push(position === unit.territoryId ? unit : { ...unit, territoryId: position });
      continue;
    }
    const roll = pick(streams("general-death", deathIndex), 20);
    deathIndex += 1;
    const safe = routedTo ?? fallbackTerritory(scenario, control, unit.factionId);
    if (roll > deathRoll && safe !== undefined) {
      restored.push({ ...unit, territoryId: safe });
      continue;
    }
    died.push(unit.id);
    events.push({ factionId: unit.factionId, generalId, kind: "general-died", territoryId: position, unitId: unit.id });
    const unavailable = fieldedGenerals(scenario, start.raised, [...Object.values(start.units), ...aside]);
    const called = callReplacement(scenario, generals, unit.factionId, unavailable, turn);
    generals = called.generals;
    if (called.outcome !== undefined) events.push(called.outcome);
  }
  armies = replaceArmies(armies, restored);

  const rallied = new Map<string, { factionId: FactionId; generalId: GeneralId; territoryId: TerritoryId; unitIds: UnitId[] }>();
  const generalUnits = Object.values(armies).filter((unit) => unitKindIn(scenario, raised, unit.id) === "general");
  const places = [...new Set(generalUnits.map((unit) => `${unit.factionId}|${unit.territoryId}`))].sort(compareIds);
  const updates: UnitState[] = [];
  for (const place of places) {
    const [factionId, territoryId] = place.split("|") as [FactionId, TerritoryId];
    const here = generalUnits.filter((unit) => unit.factionId === factionId && unit.territoryId === territoryId).map((unit) => unit.id);
    const best = bestGeneral(scenario, raised, here);
    if (best === undefined || !canRally(scenario, raised, best.unitId)) continue;
    const demoralized = Object.values(armies)
      .filter((other) => other.factionId === factionId && other.territoryId === territoryId && other.morale.demoralized)
      .sort((a, b) => compareIds(a.id, b.id));
    if (demoralized.length === 0) continue;
    updates.push(...demoralized.map((other): UnitState => ({ ...other, morale: { demoralized: false, quietTurns: 0 } })));
    rallied.set(place, { factionId, generalId: best.general.id, territoryId, unitIds: demoralized.map((other) => other.id) });
  }
  armies = replaceArmies(armies, updates);
  for (const entry of rallied.values()) events.push({ kind: "rallied", ...entry });

  const arrivals: UnitState[] = [];
  const pendingLeft: Record<FactionId, GameState["generals"][FactionId]> = { ...generals };
  for (const [factionId, entry] of Object.entries(generals) as [FactionId, GameState["generals"][FactionId]][]) {
    const due = entry.pending.filter((pending) => pending.arrivesOnTurn <= turn);
    if (due.length === 0) continue;
    const territoryId = fallbackTerritory(scenario, control, factionId);
    if (territoryId === undefined) continue;
    for (const pending of due) {
      const id = generalUnitId(pending.generalId);
      const definition = generalUnitDefinition(scenario, id);
      if (definition === undefined || armies[id] !== undefined || scenario.index.units.has(id)) continue;
      raised = { ...raised, [definition.id]: definition };
      const unit: UnitState = { factionId, fatigue: 0, id: definition.id, morale: { demoralized: false, quietTurns: 0 }, strength: definition.fullStrength, territoryId };
      arrivals.push(unit);
      armies = replaceArmies(armies, [unit]);
      events.push({ factionId, generalId: pending.generalId, kind: "replacement-arrived", territoryId, unitId: unit.id });
    }
    pendingLeft[factionId] = { ...entry, pending: entry.pending.filter((pending) => pending.arrivesOnTurn > turn) };
  }

  return {
    ...draft,
    armies,
    events: [...draft.events, ...events],
    scratch: { ...draft.scratch, air: { ...scratch, aside: {} } },
    systems: { ...draft.systems, generals: pendingLeft, raised }
  };
};

function territoryOrder(scenario: Scenario, id: TerritoryId): number {
  return scenario.territories.findIndex((territory) => territory.id === id);
}

/** Step 11, after the economy's income (U3, U4): this turn's raid cuts and recon reveals have done their work. */
export const expireAirEffects: Phase = (draft) => {
  const turn = draft.input.start.turnNumber;
  return {
    ...draft,
    systems: {
      ...draft.systems,
      raidCuts: draft.systems.raidCuts.filter((cut) => cut.turnNumber > turn),
      reveals: draft.systems.reveals.filter((reveal) => reveal.untilTurn > turn)
    }
  };
};
