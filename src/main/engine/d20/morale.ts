import { freshlyDemoralized } from "../battleResults";
import { type Armies, replaceArmies } from "../board";
import type { Phase, TurnDraft } from "../phases/draft";
import type { FactionId, FatigueOutcome, RecoveredOutcome, Scenario, TerritoryId, UnitId, UnitState } from "../types";
import { digIn } from "../works";
import { requireD20, unitRank } from "./rules";

/**
 * W6, C1: territories contested at the end of the turn: shown as contested by control, or shared
 * by armies of several factions. Sub-territory holders are not read yet: nothing flips them until
 * the partition module lands, so the 1936 start holders would keep mixed territories contested
 * for good, even after one faction takes the whole territory.
 * TODO(m3r1-sub-territories): replace with their contested-territory helper (W6) when it lands.
 */
export function contestedAtEnd(scenario: Scenario, draft: TurnDraft): ReadonlySet<TerritoryId> {
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

/** Every unit that fought on the attacking side of a battle this turn (C2: only attackers tire). */
export function attackedThisTurn(draft: TurnDraft): ReadonlySet<UnitId> {
  return new Set([
    ...draft.meetings.battles.flatMap((battle) => battle.attacker.armies.map((army) => army.unitId)),
    ...[...draft.front.battles, ...draft.standing].flatMap((pending) => pending.battle.attacker.armies.map((army) => army.unitId))
  ]);
}

/**
 * Step 9 for `d20-graded` (C4-C7, M22, M23):
 * - Fatigue (C6): +1 for a unit that attacked, up to the demoralizing level, which demoralizes
 *   it. A quiet turn in uncontested ground (no move order, no retreat, no attack) resets it to 0.
 *   Defending never tires a unit.
 * - Rest (C5, M23): a demoralized unit recovers after one quiet turn, only in uncontested ground
 *   (C4). Replenish (recruitment) and a general's rally (air) are their modules' later parts of
 *   this step; they run after this one and may clear demoralization themselves.
 * - Digging in (M22, D3): works grow by the d20's `worksPerTurn` up to `worksMax`, never in
 *   contested ground (C1), and as the `canDigIn` hooks allow (T4).
 */
export const updateGradedMorale: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const rules = requireD20(scenario);
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
    if (attacked.has(unit.id) && unit.fatigue < demoralizedLevel) {
      const fatigue = unit.fatigue + 1;
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
  const fortification = digIn(scenario, start, { armies, control: draft.control.control }, new Set([...foughtIn, ...contested]), moved,
    { max: rules.modifiers.worksMax, perTurn: rules.modifiers.worksPerTurn });
  return { ...draft, armies, events: [...draft.events, ...fatigueEvents], fortification, recovered: [...draft.recovered, ...recovered] };
};
