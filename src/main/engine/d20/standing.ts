import type { PendingBattle } from "../battle";
import { type Armies, armiesIn, compareIds, factionsOf, removeArmies, replaceArmies } from "../board";
import { type BattleDice, pick } from "../dice";
import type { RandomSource } from "../random";
import type { Leaving } from "../retreat";
import type { CombatRole, FactionId, Occupation, Scenario, StandingTieBreak, TerritoryId, UnitState } from "../types";
import { fightGraded, type GradedInput, rollD20 } from "./battle";
import { cannotAttackAlone, standingHolder } from "./front";
import { fightingSurvivors } from "./grades";
import { gradedSide } from "./modifiers";

/** The result of the d20 standing-battle step. */
export interface GradedStanding {
  readonly armies: Armies;
  readonly battles: readonly PendingBattle[];
  readonly leaving: readonly Leaving[];
}

/**
 * M27 on the d20 (C2, C3). After every other battle, factions still sharing a territory fight
 * there once per territory per turn, in territory id order, except where a battle was already
 * fought this turn (`foughtIn`): the assault was that turn's battle. A faction's standing attack
 * is its units' attack there, without demoralized units (C4) and generals. The faction with the
 * greatest standing attack attacks. The defender is the other faction with the greatest
 * standing attack; with three or more factions, the capital holder (else the last controller)
 * always defends (C3). Neither side has works; faction modifiers, barricades and the hooks apply.
 * The attacker stays whatever happens. A grade with ground "all" makes the defender retreat
 * (M21); a partial grade leaves both in place and its ground to the partition module (P4, P5).
 */
export function resolveGradedStanding(
  scenario: Scenario,
  input: GradedInput,
  armies: Armies,
  dice: BattleDice,
  firstIndex: number,
  foughtIn: ReadonlySet<TerritoryId>
): GradedStanding {
  const { start } = input;
  const battles: PendingBattle[] = [];
  const leaving: Leaving[] = [];
  let current = armies;
  const shared = scenario.territories
    .map((territory) => territory.id)
    .filter((id) => !foughtIn.has(id) && factionsOf(armiesIn(armies, id)).length > 1)
    .sort(compareIds);

  for (const territoryId of shared) {
    const present = armiesIn(current, territoryId);
    const able = (factionId: FactionId) => present.filter((unit) => unit.factionId === factionId && !unit.morale.demoralized);
    const ranking = factionsOf(present).map((factionId) => ({
      factionId,
      value: standingAttack(scenario, input, able(factionId), territoryId)
    }));
    const holder = ranking.length >= 3 ? standingHolder(scenario, start, territoryId, ranking.map((entry) => entry.factionId)) : undefined;
    const candidates = ranking.filter((entry) => entry.factionId !== holder && !cannotAttackAlone(scenario, start, able(entry.factionId)));
    if (candidates.every((entry) => entry.value === 0)) continue;
    const index = firstIndex + battles.length;
    const random = dice(index);
    const die = rollD20(random);
    const attacker = choose(random, candidates, "attack");
    const defender = holder !== undefined ? { factionId: holder } : choose(random, ranking.filter((entry) => entry.factionId !== attacker.factionId), "defence");
    const battle = fightGraded(scenario, input, current, {
      attackerFactionId: attacker.factionId,
      attackers: able(attacker.factionId).map((unit) => ({ from: territoryId, unit })),
      context: { attackerFactionId: attacker.factionId, defenderFactionIds: [defender.factionId], diggingIn: false, territoryId },
      defenderRole: "defence",
      defenders: present.filter((unit) => unit.factionId === defender.factionId).map((unit) => ({ from: territoryId, unit }))
    }, index, die);

    const casualties = [battle.attackerCasualties, battle.defenderCasualties];
    const destroyed = casualties.flatMap((side) => side.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId));
    current = removeArmies(replaceArmies(current, casualties.flatMap((side) => side.survivors)), destroyed);
    const ousted = battle.grade.ground === "all";
    if (ousted) {
      leaving.push(...battle.defenderCasualties.survivors.map((unit): Leaving => ({ from: territoryId, kind: "retreat", report: { battleIndex: index }, unitId: unit.id })));
    }
    const defenderGone = ousted || fightingSurvivors(scenario, start, battle.defenderCasualties).length === 0;
    const remaining = armiesIn(current, territoryId).filter((unit) => unit.factionId !== defender.factionId);
    const occupation: Occupation = !defenderGone ? { kind: "held" }
      : fightingSurvivors(scenario, start, battle.attackerCasualties).length > 0 ? { factionId: attacker.factionId, kind: "taken" }
      : remaining.length > 0 ? { kind: "held" } : { kind: "left-empty" };
    battles.push({
      battle,
      report: {
        demoralizedUnitIds: [...battle.attackerCasualties.demoralized, ...battle.defenderCasualties.demoralized],
        losses: [...battle.attackerCasualties.losses, ...battle.defenderCasualties.losses],
        retreats: [],
        surrenderedUnitIds: []
      },
      site: { kind: "standing", occupation, territoryId, tieBreaks: [attacker.tieBreak, "tieBreak" in defender ? defender.tieBreak : undefined].flatMap((tie) => tie ?? []) }
    });
  }
  return { armies: current, battles, leaving };
}

function standingAttack(scenario: Scenario, input: GradedInput, units: readonly UnitState[], territoryId: TerritoryId): number {
  return units.length === 0 ? 0 : gradedSide(scenario, input.start, units.map((unit) => ({ from: territoryId, unit })), "attack").value;
}

interface Choice {
  readonly factionId: FactionId;
  readonly tieBreak?: StandingTieBreak;
}

/** The faction with the greatest standing attack; a tie is settled by a seeded roll among the tied, in id order. */
function choose(random: RandomSource, ranking: readonly { readonly factionId: FactionId; readonly value: number }[], role: CombatRole): Choice {
  const greatest = Math.max(...ranking.map((entry) => entry.value));
  const factionIds = ranking.filter((entry) => entry.value === greatest).map((entry) => entry.factionId).sort(compareIds);
  const [first] = factionIds;
  if (first === undefined) throw new Error("Invariant violated: a standing battle needs two factions.");
  if (factionIds.length === 1) return { factionId: first };
  const roll = pick(random, factionIds.length);
  return { factionId: factionIds[roll - 1] ?? first, tieBreak: { factionIds, role, roll } };
}
