import { generalOf, unitTypeIn } from "../engine/air/pieces";
import { canRally, commandBonus, traitRollFor } from "../engine/generals/command";
import type { CombatRole, GameState, Scenario, UnitId } from "../engine/types";
import { signedTenths, tenths } from "./numbers";

/** A general as the player reads him: who he is, and what he does to the dice. */
export interface GeneralWords {
  /** "+1 on the battle roll of his army; +1 more when defending." */
  readonly effect: string;
  /** "José Miaja, Tenacious: +1 on the battle roll of his army; +1 more when defending." */
  readonly text: string;
}

const roles: readonly CombatRole[] = ["attack", "defence"];
const roleWords: Readonly<Record<CombatRole, string>> = { attack: "attacking", defence: "defending" };

/** N10: a general's name, trait and die effect in plain words, from the scenario's effects; undefined for a unit that is not a general. */
export function generalWords(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): GeneralWords | undefined {
  const general = generalOf(scenario, raised, unitId);
  if (general === undefined) return undefined;
  const bonus = commandBonus(scenario, raised, unitId);
  const army = "the battle roll of his army";
  const parts = [
    ...(bonus === 0 ? [] : [`${signedTenths(bonus)} on ${army}`]),
    ...roles.flatMap((role) => {
      const roll = traitRollFor(scenario, general, role);
      const when = `when ${roleWords[role]}`;
      if (roll === 0) return [];
      if (bonus === 0) return [`${signedTenths(roll)} on ${army} ${when}`];
      return [roll > 0 ? `${signedTenths(roll)} more ${when}` : `${tenths(-roll)} less ${when}`];
    }),
    ...(rallies(scenario, raised, unitId) && !canRally(scenario, raised, unitId) ? ["he can't restore its morale"] : [])
  ];
  const sentence = parts.length === 0 ? "No effect on the battle roll" : parts.join("; ");
  const trait = scenario.generalTraits.find((candidate) => candidate.id === general.traitId);
  const effect = `${sentence}.`;
  return { effect, text: `${trait === undefined ? general.name : `${general.name}, ${trait.name}`}: ${effect}` };
}

/** Whether generals of his type restore morale at all, so that a trait that forbids it is worth a word. */
function rallies(scenario: Scenario, raised: GameState["raised"], unitId: UnitId): boolean {
  return unitTypeIn(scenario, raised, unitId)?.effects.some((effect) => effect.kind === "rally") ?? false;
}
