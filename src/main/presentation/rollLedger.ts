import type { CombatModifier, GeneralId, Scenario } from "../engine/types";
import { glyphs } from "./glyphs";
import { modifierName } from "./odds";

/** One line of a roll ledger: what changes the attacker's die, and by how much. */
export interface RollLedgerRow {
  readonly label: string;
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

/** Every effect on the attacker's roll as one ledger, without those that change nothing. Plus helps the attacker, whoever reads it. */
export function rollLedger(scenario: Scenario, modifiers: readonly CombatModifier[]): RollLedgerData {
  const rows = modifiers.filter((modifier) => modifier.roll !== 0).map((modifier) => ({ label: effectName(modifier, scenario), value: modifier.roll }));
  return { rows, total: rows.reduce((sum, row) => sum + row.value, 0) };
}
