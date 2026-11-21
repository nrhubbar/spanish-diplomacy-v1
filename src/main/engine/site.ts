import { type BattleReport, fight, type FoughtBattle, type PendingBattle } from "./battle";
import { freshlyDemoralized, resultEffects } from "./battleResults";
import { type Armies, type Combatant, combatantsOf, factionsOf, placeAt } from "./board";
import { armyValue, isSuccessful, situationalModifiers } from "./combat";
import { type BattleDice, rollDie } from "./dice";
import type { TurnScratch } from "./phases/draft";
import type { Leaving } from "./retreat";
import type { FactionId, GameState, MoveOrder, Occupation, Scenario, TerritoryId, UnitId, UnitState } from "./types";

/** Everything the territory-battle step reads: the start of the turn, the armies after the meetings, the moves still on their way. */
export interface Front {
  readonly armies: Armies;
  readonly continuing: readonly MoveOrder[];
  readonly dice: BattleDice;
  /** The index of the step's first battle (M26). */
  readonly firstIndex: number;
  /** Each moving army's origin. */
  readonly origins: ReadonlyMap<UnitId, TerritoryId>;
  /** The turn's scratch, for the combat hooks (air support, generals). */
  readonly scratch?: TurnScratch;
  readonly start: GameState;
}

/** A territory with a fight: defended (M17), or empty and entered by several factions (M19). */
export interface Site {
  readonly attackers: readonly MoveOrder[];
  readonly defenders: readonly Combatant[];
  readonly kind: "assault" | "entry";
  /** The entry battle's standing entrant (M19). */
  readonly standing?: FactionId;
  readonly territoryId: TerritoryId;
}

/** What a site's battles changed: battles awaiting their retreats, and the armies' new states. */
export interface SettledSite {
  readonly battles: readonly PendingBattle[];
  readonly destroyed: readonly UnitId[];
  readonly leaving: readonly Leaving[];
  readonly updates: readonly UnitState[];
}

/**
 * Section 1.6: each attacking faction fights the defenders separately, from the same values. The
 * defenders take every result: any destroying result destroys them, any demoralizing result
 * demoralizes them, and `defender-demoralized` makes them leave. M18 then decides who occupies.
 * Each effect is reported once, in the first battle (by index) that caused it.
 */
export function settleSite(scenario: Scenario, front: Front, site: Site, firstIndex: number): SettledSite {
  const defenderFactionIds = factionsOf(site.defenders.map((combatant) => combatant.unit));
  const fought = factionsOf(site.attackers).map((factionId, offset) => {
    const index = firstIndex + offset;
    return fight(scenario, front.armies, {
      attackerFactionId: factionId,
      attackers: combatantsOf(front.armies, site.attackers.filter((order) => order.factionId === factionId)),
      defenderRole: site.kind === "entry" ? "attack" : "defence",
      defenders: site.defenders,
      situational: situationalModifiers(scenario, front.start, {
        attackerFactionId: factionId,
        battleIndex: index,
        defenderFactionIds,
        defenderUnitIds: site.defenders.map((combatant) => combatant.unit.id),
        diggingIn: site.kind === "assault",
        ...(front.scratch === undefined ? {} : { scratch: front.scratch }),
        territoryId: site.territoryId
      })
    }, index, rollDie(front.dice(index)));
  });
  const destroying = fought.find((battle) => resultEffects[battle.face.result].defender === "destroyed");
  const ousting = fought.find((battle) => battle.face.result === "defender-demoralized");
  const defendersRemain = destroying === undefined && ousting === undefined;
  const occupant = occupantOf(scenario, fought);
  const occupation: Occupation = occupant !== undefined ? { factionId: occupant, kind: "taken" }
    : defendersRemain ? (site.standing === undefined ? { kind: "held" } : { factionId: site.standing, kind: "taken" })
    : { kind: "left-empty" };

  const demoralizedBy = new Map<UnitId, number>();
  for (const battle of destroying === undefined ? fought : []) {
    for (const id of battle.defenderCasualties.demoralized) if (!demoralizedBy.has(id)) demoralizedBy.set(id, battle.index);
  }
  const battles = fought.map((battle): PendingBattle => ({
    battle,
    report: reportOf(battle, battle === destroying, demoralizedBy),
    site: { kind: site.kind, occupation, territoryId: site.territoryId }
  }));

  const settledDefenders = destroying === undefined
    ? site.defenders.map(({ unit }) => (demoralizedBy.has(unit.id) ? { ...unit, morale: freshlyDemoralized } : unit))
    : [];
  const leaving: Leaving[] = [];
  const updates: UnitState[] = [];
  for (const battle of fought) {
    const occupies = battle.engagement.attackerFactionId === occupant;
    for (const unit of battle.attackerCasualties.survivors) {
      if (occupies) {
        updates.push(placeAt(unit, site.territoryId));
      } else {
        updates.push(unit);
        leaving.push({ from: originOf(front, unit.id), kind: "return", report: { battleIndex: battle.index }, unitId: unit.id });
      }
    }
  }
  for (const unit of settledDefenders) {
    if (ousting !== undefined && site.kind === "assault") {
      leaving.push({ from: site.territoryId, kind: "retreat", report: { battleIndex: ousting.index }, unitId: unit.id });
      updates.push(placeAt(unit, site.territoryId));
    } else if (ousting !== undefined) {
      // An ousted standing entrant never got in: it returns to its origin (M21).
      leaving.push({ from: originOf(front, unit.id), kind: "return", report: { battleIndex: ousting.index }, unitId: unit.id });
      updates.push(unit);
    } else {
      updates.push(placeAt(unit, site.territoryId));
    }
  }
  const destroyed = [
    ...fought.flatMap((battle) => battle.attackerCasualties.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId)),
    ...(destroying === undefined ? [] : site.defenders.map(({ unit }) => unit.id))
  ];
  return { battles, destroyed, leaving, updates };
}

/**
 * M18: attackers whose battle succeeded and who have survivors claim the territory. With one
 * claimant it moves in; with several, the one with the greatest attack left after its own losses
 * (M12, recomputed); with a tie for greatest, nobody does.
 */
function occupantOf(scenario: Scenario, fought: readonly FoughtBattle[]): FactionId | undefined {
  const claims = fought
    .filter((battle) => isSuccessful(battle.face.result) && battle.attackerCasualties.survivors.length > 0)
    .map((battle) => ({
      factionId: battle.engagement.attackerFactionId,
      value: battle.attackerCasualties.survivors.reduce((sum, unit) => sum + armyValue(scenario, unit, "attack"), 0)
    }));
  const greatest = Math.max(...claims.map((claim) => claim.value));
  const leaders = claims.filter((claim) => claim.value === greatest);
  return leaders.length === 1 ? leaders[0]?.factionId : undefined;
}

function reportOf(battle: FoughtBattle, destroys: boolean, demoralizedBy: ReadonlyMap<UnitId, number>): BattleReport {
  return {
    demoralizedUnitIds: [
      ...battle.attackerCasualties.demoralized,
      ...battle.defenderCasualties.demoralized.filter((id) => demoralizedBy.get(id) === battle.index)
    ],
    losses: [...battle.attackerCasualties.losses, ...(destroys ? battle.defenderCasualties.losses : [])],
    retreats: [],
    surrenderedUnitIds: []
  };
}

function originOf(front: Front, id: UnitId): TerritoryId {
  const origin = front.origins.get(id);
  if (origin === undefined) {
    throw new Error(`Invariant violated: army "${id}" moved without an origin.`);
  }
  return origin;
}
