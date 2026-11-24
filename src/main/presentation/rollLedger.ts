import type { PlannedAir, PlannedAirResult } from "../engine/air/groundSupport";
import type { CombatModifier, GeneralId, Scenario } from "../engine/types";
import { aircraftCount } from "./battleAir";
import { glyphs } from "./glyphs";
import { modifierName, percent, signed } from "./odds";

/** One line of a roll ledger: what changes the attacker's die, and by how much. */
export interface RollLedgerRow {
  /** What the value is made of, as a fold-out under the label. */
  readonly details?: { readonly lines: readonly string[]; readonly summary: string };
  readonly label: string;
  /** Beside the label, smaller: what kind of number the value is. */
  readonly note?: string;
  readonly value: number;
}

export interface RollLedgerData {
  readonly rows: readonly RollLedgerRow[];
  readonly total: number;
}

function generalName(scenario: Scenario, id: GeneralId): string {
  return scenario.index.generals.get(id)?.name ?? "The general";
}

/** What changed the roll, by name; the ledger prints the signed number beside it. */
export function effectName(modifier: CombatModifier, scenario: Scenario): string {
  switch (modifier.kind) {
    case "general":
      return `${generalName(scenario, modifier.generalId)} commands`;
    case "trait": {
      const trait = scenario.generalTraits.find((candidate) => candidate.id === modifier.traitId);
      return `${generalName(scenario, modifier.generalId)} is ${(trait?.name ?? modifier.traitId).toLowerCase()}`;
    }
    case "dug-in":
      return `Dug in, level ${String(modifier.level)}`;
    case "faction":
      return modifier.name;
    case "fatigue":
      return modifier.role === "attack" ? "Attackers fatigued" : "Defenders fatigued";
    case "building":
      return scenario.index.buildings.get(modifier.buildingId)?.name ?? modifierName(modifier, scenario);
    case "unit-bonus":
      return `${modifierName(modifier, scenario)} ${glyphs.dot} ${modifier.role === "attack" ? "attackers" : "defenders"}`;
    case "pass":
      return `${modifierName(modifier)}, crossed by every unit`;
    case "air-support": {
      const count = modifier.unitIds.length;
      const aircraft = `Ground Support${count === 0 ? "" : `, ${String(count)} aircraft`}`;
      return modifier.role === "attack" ? aircraft : `Defenders' ${aircraft}`;
    }
    default:
      return modifierName(modifier, scenario);
  }
}

/** To tenths, as the ledgers print averages. */
function toTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/** "Defender commands the air, 15%: the defenders' Ground Support; you lose one aircraft". */
function airResultLine({ aircraftLost, chance, name, roll, support }: PlannedAirResult): string {
  const gives = roll > 0 ? `your Ground Support, ${signed(roll)}` : support === "defender" ? "the defenders' Ground Support" : "no Ground Support";
  const loses = aircraftLost === 0 ? "" : `; you lose ${aircraftCount(aircraftLost)}`;
  return `${name}, ${percent(chance)}: ${gives}${loses}`;
}

/**
 * R11: the ledger with planned Ground Support that an air battle decides: its average to tenths,
 * and the table's results with their chances folded out. Unopposed support is among the battle's
 * modifiers already, so the ledger stays as it is.
 */
export function withPlannedAir(scenario: Scenario, ledger: RollLedgerData, air: PlannedAir | undefined): RollLedgerData {
  if (air?.results === undefined) return ledger;
  const row: RollLedgerRow = {
    details: { lines: air.results.map(airResultLine), summary: "The air battle's results" },
    label: effectName(air.modifier, scenario),
    note: "average; air battle first",
    value: toTenth(air.average)
  };
  return { rows: [...ledger.rows, row], total: toTenth(ledger.total + row.value) };
}

/** Every effect on the attacker's roll as one ledger, without those that change nothing. Plus helps the attacker, whoever reads it. */
export function rollLedger(scenario: Scenario, modifiers: readonly CombatModifier[]): RollLedgerData {
  const rows = modifiers.filter((modifier) => modifier.roll !== 0).map((modifier) => ({ label: effectName(modifier, scenario), value: modifier.roll }));
  return { rows, total: rows.reduce((sum, row) => sum + row.value, 0) };
}
