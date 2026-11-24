import { holdsWhole } from "../partition/holders";
import { heldWholeByAnother, isAirbaseFor, territoriesWithin, unitDefinitionIn, unitKindIn, unitTypeIn } from "../air/pieces";
import { airScratch } from "../air/scratch";
import { compareIds, removeArmies, replaceArmies } from "../board";
import { pick } from "../dice";
import type { Phase, TurnDraft } from "../phases/draft";
import type {
  BattleSide,
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
import { attackedThisTurn, demoralizedThisTurn } from "../d20/morale";
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

/**
 * D27.7: where a replacement general appears, and where a surviving general goes when he must
 * leave: the faction's seat when it holds the seat's capital sub-territory, even while the seat
 * is contested; otherwise the nearest territory whose capital sub-territory it holds (by
 * connections from the seat, ties in scenario order). A territory without sub-territories counts
 * when the faction holds it whole.
 */
function fallbackTerritory(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, factionId: FactionId): TerritoryId | undefined {
  const holds = (id: TerritoryId): boolean => {
    const capital = scenario.index.territories.get(id)?.capitalSubTerritoryId;
    const held = capital === undefined ? undefined : state.subTerritories[capital];
    return held === undefined ? holdsWhole(scenario, state, id, factionId) : held.holder === factionId;
  };
  const seat = scenario.index.factions.get(factionId)?.seatTerritoryId;
  const distance = seat === undefined ? new Map<TerritoryId, number>() : territoriesWithin(scenario, seat, scenario.territories.length);
  const far = scenario.territories.length + 1;
  return scenario.territories
    .map((territory, order) => ({ distance: distance.get(territory.id) ?? far, id: territory.id, order }))
    .filter((entry) => holds(entry.id))
    .sort((a, b) => a.distance - b.distance || a.order - b.order)[0]?.id;
}

/**
 * Step 9, after the dice module's morale part (AG-3, AG-8 to AG-10, D27):
 * 1. Aircraft come back to their bases, but for those shot down in an air battle (R11). One whose
 *    territory is no longer an airbase of its faction rebases to the nearest airbase of its faction within range, or is lost (D27.2).
 * 2. Generals come back: a moving general arrives where his army arrived, else stays. When his
 *    army was destroyed or routed, or he stood alone in ground the enemy took, he rolls on the
 *    `general-death` stream; a survivor follows the retreat, or goes to the fallback territory.
 * 3. The best general with each army rallies the units that started the turn demoralized and
 *    were not demoralized again this turn (C5, D5, D27.4).
 * 4. Replacement generals due this turn appear in the fallback territory (D7, D27.7).
 * Air battles are reported, then Ground Support missions with the battle they joined and whether
 * they counted (R11).
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

  // R11: each air battle fought, then each Ground Support flight with the battle it joined and whether it counted.
  const fought = [...draft.front.battles, ...draft.standing];
  const shotDown = new Set<UnitId>();
  for (const { battle: { air, index }, site } of fought) {
    if (air?.result === undefined) continue;
    for (const id of air.aircraftLost) shotDown.add(id);
    events.push({ aircraftLost: air.aircraftLost, battleIndex: index, input: air.input, kind: "air-battle", result: air.result, support: air.support, territoryId: site.territoryId });
  }
  for (const order of scratch.support) {
    if (order.mission.kind !== "support") continue;
    const territoryId = order.mission.territoryId;
    const battle = fought.find((pending) =>
      pending.site.territoryId === territoryId
      && (pending.battle.engagement.attackerFactionId === order.factionId
        || pending.battle.engagement.defenders.some((combatant) => combatant.unit.factionId === order.factionId)));
    if (battle === undefined) {
      events.push({ kind: "air-support", order, territoryId });
      continue;
    }
    const support = battle.battle.air?.support;
    const applied = support !== undefined && [...support.attacker.unitIds, ...support.defender.unitIds].includes(order.unitId);
    events.push({ applied, battleIndex: battle.battle.index, kind: "air-support", order, territoryId });
  }

  // R11: an aircraft shot down in an air battle does not come back, like a raider lost at step 2.
  const aside = Object.values(scratch.aside).filter((unit) => !shotDown.has(unit.id)).sort((a, b) => compareIds(a.id, b.id));
  const restored: UnitState[] = [];
  for (const unit of aside) {
    if (unitKindIn(scenario, start.raised, unit.id) !== "air") continue;
    const state = { control, subTerritories: draft.systems.subTerritories };
    // D17, D27.2: an aircraft rebases whenever its territory is no longer an airbase for its faction:
    // the airfield destroyed by a raid, its sub-territory lost, or the whole territory taken.
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
  const callFor = (factionId: FactionId): void => {
    const unavailable = fieldedGenerals(scenario, start.raised, [...Object.values(start.units), ...aside]);
    const called = callReplacement(scenario, generals, factionId, unavailable, turn);
    generals = called.generals;
    if (called.outcome !== undefined) events.push(called.outcome);
  };
  // AG-8 (DC-5): generals stand on the board through the battles; one dies only when a
  // battle's grade destroyed or routed his side, or he was left alone in ground the enemy holds.
  const broken = new Set(brokenUnits(scenario, draft));
  // A general the ground steps removed (his side destroyed, or surrendered with nowhere to go) is a broken army too.
  const sacked = new Set([
    ...draft.events.flatMap((event) => (event.kind === "general-sacked" ? [event.order.unitId] : [])),
    // M9: a general disbanded for an impossible move left no army behind to break.
    ...draft.orders.invalid.map((outcome) => outcome.order.unitId)
  ]);
  const taken = Object.values(start.units).filter((unit) => armies[unit.id] === undefined && !sacked.has(unit.id) && unitKindIn(scenario, start.raised, unit.id) === "general");
  for (const unit of taken) broken.add(unit.id);
  const standing = Object.values(armies).filter((other) => unitKindIn(scenario, start.raised, other.id) === "general");
  for (const unit of [...standing, ...taken].sort((a, b) => compareIds(a.id, b.id))) {
    const generalId = unitDefinitionIn(scenario, start.raised, unit.id)?.generalId;
    if (generalId === undefined) continue;
    const lostGround = heldWholeByAnother(scenario, { control, subTerritories: draft.systems.subTerritories }, unit.territoryId, unit.factionId);
    const ownGround = Object.values(armies).some((other) => other.territoryId === unit.territoryId && other.factionId === unit.factionId && other.id !== unit.id
      && unitKindIn(scenario, start.raised, other.id) === "ground");
    const alone = !ownGround && (lostGround
      || Object.values(armies).some((other) => other.territoryId === unit.territoryId && other.factionId !== unit.factionId));
    if (!broken.has(unit.id) && !alone) continue;
    const roll = pick(streams("general-death", deathIndex), 20);
    deathIndex += 1;
    const removed = armies[unit.id] === undefined;
    const safe = alone || removed ? fallbackTerritory(scenario, { control, subTerritories: draft.systems.subTerritories }, unit.factionId) : unit.territoryId;
    if (roll > deathRoll && safe !== undefined) {
      if (safe !== unit.territoryId || removed) restored.push({ ...unit, territoryId: safe });
      continue;
    }
    if (!removed) died.push(unit.id);
    events.push({ factionId: unit.factionId, generalId, kind: "general-died", territoryId: unit.territoryId, unitId: unit.id });
    callFor(unit.factionId);
  }
  armies = removeArmies(armies, died);
  armies = replaceArmies(armies, restored);

  const rallied = new Map<string, { factionId: FactionId; generalId: GeneralId; territoryId: TerritoryId; unitIds: UnitId[] }>();
  const generalUnits = Object.values(armies).filter((unit) => unitKindIn(scenario, raised, unit.id) === "general");
  const places = [...new Set(generalUnits.map((unit) => `${unit.factionId}|${unit.territoryId}`))].sort(compareIds);
  const updates: UnitState[] = [];
  // D27.4: a rally recovers units that started the turn demoralized, never a demoralization from this turn.
  const fresh = demoralizedThisTurn(draft);
  const attacked = attackedThisTurn(draft);
  for (const place of places) {
    const [factionId, territoryId] = place.split("|") as [FactionId, TerritoryId];
    const group = Object.values(armies).filter((other) => other.factionId === factionId && other.territoryId === territoryId);
    const here = generalUnits.filter((unit) => unit.factionId === factionId && unit.territoryId === territoryId).map((unit) => unit.id);
    // M5, D5: the general whose +1 counted rallies: the army is ranked for the role it fought in this turn.
    const best = bestGeneral(scenario, raised, here, group.some((other) => attacked.has(other.id)) ? "attack" : "defence");
    if (best === undefined || !canRally(scenario, raised, best.unitId)) continue;
    const demoralized = group
      .filter((other) => other.morale.demoralized && start.units[other.id]?.morale.demoralized === true && !fresh.has(other.id))
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
    const territoryId = fallbackTerritory(scenario, { control, subTerritories: draft.systems.subTerritories }, factionId);
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

/**
 * AG-8, M6: units on a side whose army a d20 battle destroyed or routed, read from what the
 * battles did, never a grade's id:
 * - the grade destroyed the side (`lossPercent` 100) or demoralized all of it (routed);
 * - or every fighting unit on the side was destroyed by this turn's battles taken together:
 *   break-up below `breakUpShare` (D6), or losses that add up over several attacks (M17).
 */
function brokenUnits(scenario: Scenario, draft: TurnDraft): ReadonlySet<UnitId> {
  const { raised } = draft.input.start;
  const grades = new Map(scenario.d20.grades.map((grade) => [grade.id, grade]));
  const reports = [...draft.meetings.battles, ...[...draft.front.battles, ...draft.standing].map((pending) => pending.report)];
  const destroyed = new Set(reports.flatMap((report) => report.losses.flatMap((loss) => (loss.destroyed ? [loss.unitId] : []))));
  const broken = new Set<UnitId>();
  const mark = (side: BattleSide, effect: { readonly demoralized: string; readonly lossPercent: number } | undefined): void => {
    const fighting = side.armies.filter((army) => unitKindIn(scenario, raised, army.unitId) !== "general");
    const wiped = fighting.length > 0 && fighting.every((army) => destroyed.has(army.unitId));
    if (wiped || (effect !== undefined && (effect.lossPercent >= 100 || effect.demoralized === "all"))) for (const army of side.armies) broken.add(army.unitId);
  };
  for (const outcome of draft.meetings.battles) {
    const grade = grades.get(outcome.grade);
    mark(outcome.attacker, grade?.attacker);
    mark(outcome.defender, grade?.defender);
  }
  for (const pending of [...draft.front.battles, ...draft.standing]) {
    const { battle } = pending;
    mark(battle.attacker, battle.grade.attacker);
    mark(battle.defender, battle.grade.defender);
  }
  return broken;
}

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
