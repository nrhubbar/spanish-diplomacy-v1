import { requireUnitDefinition, requireUnitType } from "../engine/lookup";
import type { BattleArmy, BattleSide, BattleOutcome, Scenario } from "../engine/types";
import { sideFactions } from "./battle";
import { formatMen } from "./battleText";
import { signed } from "./odds";
import { type RollLedgerData, rollLedger } from "./rollLedger";
import { factionName, listNames, unitName } from "./text";

/** D7: what the battle report prints about one d20 battle's roll, and who fought in it. */

export interface BattleLedger extends RollLedgerData {
  /** "−2, kept within 0 to 20" when the outcome had to be kept on the table. */
  readonly clamp: string | undefined;
  readonly outcome: number;
}

/** The die, every effect on it, their total and the outcome on the table. */
export function battleLedger(scenario: Scenario, battle: BattleOutcome): BattleLedger {
  const { rows, total } = rollLedger(scenario, battle.modifiers);
  const raw = battle.die + total;
  return { clamp: raw === battle.score ? undefined : `${raw < 0 ? signed(raw) : String(raw)}, kept within 0 to 20`, outcome: battle.score, rows, total };
}

export interface FighterLine {
  /** "demoralized (counts half)" when it fought demoralized. */
  readonly demoralized: string | undefined;
  /** "504 of 700 men, steady"; a general has no men to count. */
  readonly detail: string;
  readonly id: string;
  readonly name: string;
  readonly value: number;
}

export interface FightingSide {
  readonly fighters: readonly FighterLine[];
  readonly heading: string;
}

/** Each side's units as the battle recorded them: the men and morale each fought with, and what it counted for. */
export function whoFought(scenario: Scenario, battle: BattleOutcome): readonly FightingSide[] {
  const side = (fighting: BattleSide, role: string): FightingSide => ({
    fighters: fighting.armies.map((army) => fighterLine(scenario, army)),
    heading: `${listNames(sideFactions(fighting).map((id) => factionName(scenario, id)))} ${role}: ${String(fighting.value)}`
  });
  return [side(battle.attacker, "attack"), side(battle.defender, "defence")];
}

function fighterLine(scenario: Scenario, army: BattleArmy): FighterLine {
  const line = { id: army.unitId, name: unitName(scenario, army.unitId), value: army.value };
  if (requireUnitType(scenario, requireUnitDefinition(scenario, army.unitId).type).kind === "general") return { ...line, demoralized: undefined, detail: "General" };
  const men = `${formatMen(army.men)} of ${formatMen(army.fullMen)} men, `;
  return army.demoralized
    ? { ...line, demoralized: `demoralized (counts ${shareText(scenario.combat.demoralizationFactor)})`, detail: men }
    : { ...line, demoralized: undefined, detail: `${men}steady` };
}

function shareText(share: number): string {
  return share === 0.5 ? "half" : `${String(Math.round(share * 100))}%`;
}
