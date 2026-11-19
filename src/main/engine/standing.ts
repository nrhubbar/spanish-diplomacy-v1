import { fight, type PendingBattle, sideOf } from "./battle";
import { type Armies, armiesIn, compareIds, factionsOf, removeArmies, replaceArmies } from "./board";
import { situationalModifiers } from "./combat";
import { type BattleDice, pick, rollDie } from "./dice";
import type { RandomSource } from "./random";
import type { Leaving } from "./retreat";
import type { CombatRole, FactionId, GameState, Occupation, Scenario, StandingTieBreak, TerritoryId, UnitState } from "./types";

/** The result of the standing-battle step (M27). */
export interface StandingResolution {
  readonly armies: Armies;
  readonly battles: readonly PendingBattle[];
  readonly leaving: readonly Leaving[];
}

/**
 * M27 (D29): after every other battle, factions that still share a territory fight where they
 * stand, once per territory per turn, in territory id order. A faction's standing attack is the
 * attack value of its armies there that are not demoralized, since a demoralized army cannot
 * attack (M23). The faction with the greatest standing attack attacks with those armies; the
 * other faction with the greatest standing attack defends with all of its armies there. Neither
 * side has works; faction modifiers apply. A seeded roll breaks each tie, after the battle's
 * die. Every battle uses the armies as the earlier steps left them; a defender that must
 * retreat leaves the territory (M21), and an attacker that loses stays.
 */
export function resolveStanding(
  scenario: Scenario,
  start: GameState,
  armies: Armies,
  dice: BattleDice,
  firstIndex: number
): StandingResolution {
  const battles: PendingBattle[] = [];
  const leaving: Leaving[] = [];
  const updates: UnitState[] = [];
  const destroyed: UnitState["id"][] = [];
  const shared = scenario.territories
    .map((territory) => territory.id)
    .filter((id) => factionsOf(armiesIn(armies, id)).length > 1)
    .sort(compareIds);

  for (const territoryId of shared) {
    const present = armiesIn(armies, territoryId);
    const ranking = factionsOf(present).map((factionId) => ({
      factionId,
      value: standingAttack(scenario, present.filter((unit) => unit.factionId === factionId && !unit.morale.demoralized), territoryId)
    }));
    if (ranking.every((entry) => entry.value === 0)) {
      continue;
    }
    const index = firstIndex + battles.length;
    const random = dice(index);
    const die = rollDie(random);
    const attacker = choose(random, ranking, "attack");
    const defender = choose(random, ranking.filter((entry) => entry.factionId !== attacker.factionId), "defence");
    const battle = fight(scenario, armies, {
      attackerFactionId: attacker.factionId,
      attackers: present.filter((unit) => unit.factionId === attacker.factionId && !unit.morale.demoralized).map((unit) => ({ from: territoryId, unit })),
      defenderRole: "defence",
      defenders: present.filter((unit) => unit.factionId === defender.factionId).map((unit) => ({ from: territoryId, unit })),
      situational: situationalModifiers(scenario, start, {
        attackerFactionId: attacker.factionId,
        defenderFactionIds: [defender.factionId],
        diggingIn: false,
        territoryId
      })
    }, index, die);

    const casualties = [battle.attackerCasualties, battle.defenderCasualties];
    updates.push(...casualties.flatMap((side) => side.survivors));
    destroyed.push(...casualties.flatMap((side) => side.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId)));
    const ousted = battle.face.result === "defender-demoralized";
    if (ousted) {
      leaving.push(...battle.defenderCasualties.survivors.map((unit): Leaving => ({
        from: territoryId, kind: "retreat", report: { battleIndex: index }, unitId: unit.id
      })));
    }
    const defenderGone = ousted || battle.defenderCasualties.survivors.length === 0;
    const remaining = present.filter((unit) =>
      unit.factionId !== defender.factionId && !destroyed.includes(unit.id));
    const occupation: Occupation = !defenderGone ? { kind: "held" }
      : battle.attackerCasualties.survivors.length > 0 ? { factionId: attacker.factionId, kind: "taken" }
      : remaining.length > 0 ? { kind: "held" } : { kind: "left-empty" };
    battles.push({
      battle,
      report: {
        demoralizedUnitIds: [...battle.attackerCasualties.demoralized, ...battle.defenderCasualties.demoralized],
        losses: [...battle.attackerCasualties.losses, ...battle.defenderCasualties.losses],
        retreats: [],
        surrenderedUnitIds: []
      },
      site: { kind: "standing", occupation, territoryId, tieBreaks: [attacker.tieBreak, defender.tieBreak].flatMap((tie) => tie ?? []) }
    });
  }
  return { armies: removeArmies(replaceArmies(armies, updates), destroyed), battles, leaving };
}

function standingAttack(scenario: Scenario, units: readonly UnitState[], territoryId: TerritoryId): number {
  return units.length === 0 ? 0 : sideOf(scenario, units.map((unit) => ({ from: territoryId, unit })), "attack").value;
}

interface Choice {
  readonly factionId: FactionId;
  readonly tieBreak?: StandingTieBreak;
}

/** The faction with the greatest standing attack; a tie is settled by a seeded roll among the tied, in id order. */
function choose(random: RandomSource, ranking: readonly { readonly factionId: FactionId; readonly value: number }[], role: CombatRole): Choice {
  const greatest = Math.max(...ranking.map((entry) => entry.value));
  const factionIds = ranking.filter((entry) => entry.value === greatest).map((entry) => entry.factionId).sort(compareIds);
  if (factionIds.length === 1) {
    return { factionId: requireFirst(factionIds) };
  }
  const roll = pick(random, factionIds.length);
  return { factionId: requireFirst(factionIds.slice(roll - 1)), tieBreak: { factionIds, role, roll } };
}

function requireFirst(ids: readonly FactionId[]): FactionId {
  const [first] = ids;
  if (first === undefined) {
    throw new Error("Invariant violated: a standing battle needs two factions.");
  }
  return first;
}
