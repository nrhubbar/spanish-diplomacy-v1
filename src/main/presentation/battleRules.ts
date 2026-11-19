import type { FactionId, GameState, Scenario } from "../engine/types";
import { attackLeft, type BattleGroup, claimants, sideFactions } from "./battle";
import { placeName, roadName, sentenceCase } from "./battleText";
import { factionName, listNames } from "./text";

/**
 * The rule behind a battle card that is more than one attacker against one defender (section
 * 1.6, C9, M27), told with the battle's own numbers. Plain two-sided assaults need no note.
 */
export interface RuleNote {
  readonly steps: readonly string[];
  readonly title: string;
}

export function ruleNote(scenario: Scenario, finalState: GameState, group: BattleGroup): RuleNote | undefined {
  const battles = group.battles.map((entry) => entry.battle);
  const first = battles[0];
  if (first === undefined) return undefined;
  const the = theFaction(scenario);
  const site = first.site;
  switch (group.kind) {
    case "meeting": {
      if (site.kind !== "meeting") return undefined;
      const defender = listNames(sideFactions(first.defender).map(the));
      return {
        steps: [
          `Armies of ${the(first.attackerFactionId)} and ${defender} set out along ${roadName(scenario, site.between)} in opposite directions and met on the way.`,
          `The side with the greater attack, ${the(first.attackerFactionId)}, attacked with ${String(first.attacker.value)} against a defence of ${String(first.defender.value)}. On the road neither side has works or faction modifiers.`,
          site.winner === undefined
            ? "Neither side won, so both returned to where they started."
            : `${sentenceCase(the(site.winner))} won and continued its move as if the road were clear. The other side returned to where it started.`
        ],
        title: "How a meeting on the road is decided"
      };
    }
    case "standing": {
      const place = placeName(scenario, first);
      return {
        steps: [
          `Armies of ${listNames([first.attackerFactionId, ...sideFactions(first.defender)].map(the))} were all still in ${place} after the other battles.`,
          `The faction with the greatest attack there, ${the(first.attackerFactionId)}, attacked with ${String(first.attacker.value)} against the next strongest, whose defence was ${String(first.defender.value)}.`,
          "Neither side gets a dug-in bonus in a standing battle. Results apply as in any other battle, and a defender that must retreat leaves the territory."
        ],
        title: "Why armies sharing a territory fought"
      };
    }
    case "entry":
      return {
        steps: [
          `No army held ${placeName(scenario, first)} when ${listNames([...sideFactions(first.defender), ...battles.map((battle) => battle.attackerFactionId)].map(the))} entered it together.`,
          `The entrant with the greatest attack, ${listNames(sideFactions(first.defender).map(the))}, stood as defender, using its attack of ${String(first.defender.value)} as its defence, with no works. Every other entrant fought it.`,
          occupationStep(scenario, finalState, group)
        ],
        title: "How several armies entering one territory are decided"
      };
    case "assault":
      if (battles.length < 2) return undefined;
      return {
        steps: [
          `${sentenceCase(listNames(battles.map((battle) => the(battle.attackerFactionId))))} attacked ${placeName(scenario, first)} at once. Each fought the defenders separately, all from the same starting values, so the order did not matter.`,
          "The defenders took every result they received: their losses added up, and any result that removed them removed them.",
          occupationStep(scenario, finalState, group)
        ],
        title: "How a battle with several attackers is decided"
      };
  }
}

/** Section 1.6 step 2 with the real numbers: who claimed the territory and who moved in. */
function occupationStep(scenario: Scenario, finalState: GameState, group: BattleGroup): string {
  const winners = claimants(group);
  const first = group.battles[0]?.battle;
  const place = first === undefined ? "" : placeName(scenario, first);
  const the = theFaction(scenario);
  const [only] = winners;
  if (only === undefined) return `No attack succeeded, so the defenders held ${place}.`;
  if (winners.length === 1) return `Only ${the(only.attackerFactionId)} succeeded, so it claimed ${place} alone.`;
  const left = winners.map((battle) => `${the(battle.attackerFactionId)} ${String(attackLeft(scenario, finalState, battle))}`);
  const site = first?.site;
  const decided = site !== undefined && site.kind !== "meeting" && site.occupation.kind === "taken"
    ? `${sentenceCase(the(site.occupation.factionId))} moved in; the others returned home without further loss.`
    : `That was a tie, so every claimant returned home and ${place} was left empty.`;
  return `Several attackers succeeded. The one with the greatest attack left after its own losses moves in: ${listNames(left)}. ${decided}`;
}

function theFaction(scenario: Scenario): (id: FactionId) => string {
  return (id) => `the ${factionName(scenario, id)}`;
}
