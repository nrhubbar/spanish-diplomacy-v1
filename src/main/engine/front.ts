import { type PendingBattle, sideOf } from "./battle";
import {
  type Armies,
  type Combatant,
  combatantsOf,
  compareIds,
  factionsOf,
  inScenarioOrder,
  placeAt,
  removeArmies,
  replaceArmies,
  requireArmy
} from "./board";
import type { Leaving } from "./retreat";
import { type Front, type Site, settleSite } from "./site";
import type { MoveOrder, ReinforcementArrivedOutcome, Scenario, SuccessfulMoveOutcome, TerritoryId } from "./types";

/** The result of the territory-battle step (M17-M19). */
export interface FrontResolution {
  readonly armies: Armies;
  readonly arrivals: readonly (SuccessfulMoveOutcome | ReinforcementArrivedOutcome)[];
  readonly battles: readonly PendingBattle[];
  readonly leaving: readonly Leaving[];
}

/**
 * M17-M19: every territory that moves still head for, in id order. A defended territory is
 * attacked by each other faction separately, against one snapshot (section 1.6). An empty
 * territory one faction enters is taken unopposed (M6); one several factions enter is held by
 * the entrant with the greatest attack, which the others attack; a tie bounces everyone.
 */
export function resolveFront(scenario: Scenario, front: Front): FrontResolution {
  const inTransit = new Set(front.continuing.map((order) => order.unitId));
  const targets = [...new Set(front.continuing.map((order) => order.to))].sort(compareIds);
  const arrivals: (SuccessfulMoveOutcome | ReinforcementArrivedOutcome)[] = [];
  const battles: PendingBattle[] = [];
  const leaving: Leaving[] = [];
  let armies = front.armies;
  let next = front.firstIndex;

  for (const territoryId of targets) {
    const entrants = front.continuing.filter((order) => order.to === territoryId);
    const present = Object.values(front.armies).filter((unit) => unit.territoryId === territoryId && !inTransit.has(unit.id));
    const defending = factionsOf(present);
    // A faction whose own armies defend here joins them: friendly armies never fight each other.
    const joiners = entrants.filter((order) => defending.includes(order.factionId));
    const advancing = entrants.filter((order) => !defending.includes(order.factionId));
    arrivals.push(...joiners.map((order): ReinforcementArrivedOutcome => ({ kind: "reinforcement-arrived", order })));
    armies = replaceArmies(armies, joiners.map((order) => placeAt(requireArmy(armies, order.unitId), territoryId)));

    const site = siteOf(scenario, front, territoryId, [
      ...present.map((unit) => ({ from: front.origins.get(unit.id) ?? territoryId, unit })),
      ...joiners.map((order) => ({ from: order.from, unit: requireArmy(front.armies, order.unitId) }))
    ], advancing);
    if (site === "unopposed") {
      arrivals.push(...advancing.map((order): SuccessfulMoveOutcome => ({ kind: "successful-move", order })));
      armies = replaceArmies(armies, advancing.map((order) => placeAt(requireArmy(armies, order.unitId), territoryId)));
    } else if (site === "standoff") {
      leaving.push(...advancing.map((order): Leaving => ({
        from: order.from,
        kind: "return",
        report: { opposingFactionIds: inScenarioOrder(scenario, factionsOf(advancing)).filter((id) => id !== order.factionId), order },
        unitId: order.unitId
      })));
    } else if (site !== undefined) {
      const settled = settleSite(scenario, front, site, next);
      next += settled.battles.length;
      battles.push(...settled.battles);
      leaving.push(...settled.leaving);
      armies = removeArmies(replaceArmies(armies, settled.updates), settled.destroyed);
    }
  }
  return { armies, arrivals, battles, leaving };
}

/** What kind of fight a territory sees, if any. */
function siteOf(
  scenario: Scenario,
  front: Front,
  territoryId: TerritoryId,
  defenders: readonly Combatant[],
  advancing: readonly MoveOrder[]
): Site | "unopposed" | "standoff" | undefined {
  if (advancing.length === 0) {
    return undefined;
  }
  if (defenders.length > 0) {
    return { attackers: advancing, defenders, kind: "assault", territoryId };
  }
  const factionIds = factionsOf(advancing);
  if (factionIds.length === 1) {
    return "unopposed";
  }
  const attack = factionIds.map((factionId) => ({
    factionId,
    value: sideOf(scenario, combatantsOf(front.armies, advancing.filter((order) => order.factionId === factionId)), "attack").value
  }));
  const greatest = Math.max(...attack.map((entry) => entry.value));
  const leaders = attack.filter((entry) => entry.value === greatest);
  const [leader] = leaders;
  if (leaders.length > 1 || leader === undefined) {
    return "standoff";
  }
  return {
    attackers: advancing.filter((order) => order.factionId !== leader.factionId),
    defenders: combatantsOf(front.armies, advancing.filter((order) => order.factionId === leader.factionId)),
    kind: "entry",
    standing: leader.factionId,
    territoryId
  };
}

