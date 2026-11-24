import { freshlyDemoralized } from "./grades";
import { type Armies, replaceArmies } from "../board";
import type { Phase, TurnDraft } from "../phases/draft";
import type { FactionId, FatigueOutcome, RecoveredOutcome, Scenario, TerritoryId, UnitId, UnitState } from "../types";
import { isContested, isPartitioned } from "../partition/holders";
import { digIn, notEntrenching } from "../works";
import { isGeneralUnit, unitRank } from "./rules";

/**
 * W6, C1: territories contested at the end of the turn. With a partition module, the
 * sub-territory holders say so (`isContested`, after step 8); without one, control shows it as
 * contested, or armies of several factions share it.
 */
function contestedAtEnd(scenario: Scenario, draft: TurnDraft): ReadonlySet<TerritoryId> {
  // W6 (m3r1-sub-territories): with the provinces partition, contested ground is the holders' (step 8 has run).
  if (isPartitioned(scenario)) {
    const state = { control: draft.control.control, subTerritories: draft.systems.subTerritories };
    return new Set(scenario.territories.filter((territory) => isContested(scenario, state, territory.id)).map((territory) => territory.id));
  }
  const contested = new Set<TerritoryId>();
  for (const territory of scenario.territories) {
    if (draft.control.control[territory.id]?.kind === "contested") contested.add(territory.id);
  }
  const factions = new Map<TerritoryId, Set<FactionId>>();
  const note = (territoryId: TerritoryId, factionId: FactionId) => factions.set(territoryId, (factions.get(territoryId) ?? new Set()).add(factionId));
  for (const unit of Object.values(draft.armies)) note(unit.territoryId, unit.factionId);
  for (const [territoryId, held] of factions) if (held.size > 1) contested.add(territoryId);
  return contested;
}

/**
 * D27.4: units demoralized this turn: by a battle's grade or result (meetings, territory and
 * standing battles), or by reaching the top of the fatigue track (the `fatigue` outcomes).
 */
export function demoralizedThisTurn(draft: TurnDraft): ReadonlySet<UnitId> {
  return new Set([
    ...draft.meetings.battles.flatMap((battle) => battle.demoralizedUnitIds),
    ...[...draft.front.battles, ...draft.standing].flatMap((pending) => pending.report.demoralizedUnitIds),
    ...draft.events.flatMap((event) => (event.kind === "fatigue" && event.demoralized ? [event.unitId] : []))
  ]);
}

/** Every unit that fought on the attacking side of a battle this turn (C2: only attackers tire). */
export function attackedThisTurn(draft: TurnDraft): ReadonlySet<UnitId> {
  return new Set([
    ...draft.meetings.battles.flatMap((battle) => battle.attacker.armies.map((army) => army.unitId)),
    ...[...draft.front.battles, ...draft.standing].flatMap((pending) => pending.battle.attacker.armies.map((army) => army.unitId))
  ]);
}

/**
 * Step 9 (C4-C7, M22, M23):
 * - Fatigue (C6): +1 for a unit that attacked, up to the demoralizing level, which demoralizes
 *   it; a unit already at that level that attacks is demoralized again (D27.4). Generals never
 *   tire (DC-5). A quiet turn in uncontested ground (no move order, no retreat, no attack) resets
 *   it to 0. Defending never tires a unit.
 * - Rest (C5, M23): a demoralized unit recovers after one quiet turn, only in uncontested ground
 *   (C4). Replenish (recruitment) and a general's rally (air) are their modules' later parts of
 *   this step; they run after this one. The rally never clears a demoralization from this turn
 *   (D27.4, `demoralizedThisTurn`).
 * - Digging in (M22, R8): works grow a pip a turn up to three (`combat.diggingIn`), never in
 *   contested ground (C1), and as the `canDigIn` hooks allow (T4).
 */
export const updateMorale: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const rules = scenario.d20;
  const rank = unitRank(scenario);
  const moved = new Set(draft.orders.origins.keys());
  const retreated = new Set(draft.settled.flatMap((entry) => (entry.kind === "retreated" ? [entry.leaving.unitId] : [])));
  const demoralizedNow = new Set([
    ...draft.meetings.battles.flatMap((battle) => battle.demoralizedUnitIds),
    ...[...draft.front.battles, ...draft.standing].flatMap((pending) => pending.report.demoralizedUnitIds)
  ]);
  const attacked = attackedThisTurn(draft);
  const contested = contestedAtEnd(scenario, draft);
  const { demoralizedLevel } = rules.fatigue;

  const fatigueEvents: FatigueOutcome[] = [];
  const recovered: RecoveredOutcome[] = [];
  const updates: UnitState[] = [];
  for (const unit of [...Object.values(draft.armies)].sort((left, right) => rank(left.id) - rank(right.id) || (left.id < right.id ? -1 : 1))) {
    let next = unit;
    const quiet = !moved.has(unit.id) && !retreated.has(unit.id) && !attacked.has(unit.id) && !contested.has(unit.territoryId);
    if (attacked.has(unit.id) && !isGeneralUnit(scenario, start.raised, unit.id)) {
      // C6, D27.4: at the top of the track a unit that attacks again is demoralized again.
      const fatigue = Math.min(unit.fatigue + 1, demoralizedLevel);
      const tired = fatigue >= demoralizedLevel;
      next = { ...next, fatigue, ...(tired ? { morale: freshlyDemoralized } : {}) };
      fatigueEvents.push({ demoralized: tired, factionId: unit.factionId, fatigue, kind: "fatigue", unitId: unit.id });
    } else if (quiet && unit.fatigue > 0) {
      next = { ...next, fatigue: 0 };
      fatigueEvents.push({ demoralized: false, factionId: unit.factionId, fatigue: 0, kind: "fatigue", unitId: unit.id });
    }
    if (next.morale.demoralized) {
      const rested = quiet && !demoralizedNow.has(unit.id);
      if (rested) {
        next = { ...next, morale: { demoralized: false, quietTurns: 0 } };
        recovered.push({ factionId: unit.factionId, kind: "recovered", territoryId: unit.territoryId, unitId: unit.id });
      } else {
        next = { ...next, morale: freshlyDemoralized };
      }
    }
    if (next !== unit) updates.push(next);
  }
  const armies: Armies = replaceArmies(draft.armies, updates);
  const foughtIn = new Set([...draft.front.battles, ...draft.standing].map((pending) => pending.site.territoryId));
  const fortification = digIn(scenario, start, { armies, control: draft.control.control }, new Set([...foughtIn, ...contested]), notEntrenching(draft));
  return { ...draft, armies, events: [...draft.events, ...fatigueEvents], fortification, recovered: [...draft.recovered, ...recovered] };
};
