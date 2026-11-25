import {
  requireBuilding,
  requireDevelopment,
  requireFaction,
  requirePassName,
  requireResource,
  requireSubTerritory,
  requireTerritory,
  requireUnitType
} from "../engine/lookup";
import type { MoveMode } from "../engine/network/reach";
import type { RailShortage, RecruitRequirement, Refusal, Scenario, TerritoryId } from "../engine/types";
import { listNames } from "./systemText/lines";

/**
 * The engine's refusals in words. The engine says why with a code and ids (`Refusal`); these
 * functions are the only place the sentences are written. Every switch covers every code, so a
 * new one does not compile until it has words.
 */

/** One refusal as a plain sentence. */
export function refusalText(scenario: Scenario, refusal: Refusal): string {
  switch (refusal.code) {
    // Any order.
    case "one-order-per-unit":
      return "A unit can receive only one order per turn.";
    case "order-of-another-faction":
      return "An order belongs to another faction.";
    case "order-unavailable":
      return "This order is not available in this scenario.";
    case "submission-of-another-faction":
      return "Submission belongs to another faction.";
    case "unit-elsewhere":
      return "Selected unit is no longer in that territory.";
    case "unit-of-another-faction":
      return "Selected unit belongs to another player.";
    case "unknown-unit":
      return "Unknown unit.";
    // Moves and routes.
    case "demoralized-attack":
      return "A demoralized unit cannot attack. It can move only into empty or friendly territory.";
    case "enemy-ground-on-the-way":
      return "Only the last step of a move may enter enemy or contested ground.";
    case "foot-only":
      return "Only foot units can cross where there is no road.";
    case "lane-port-not-held":
      return "An army can sail only from the lane's port, and your side must hold it.";
    case "march-neighbours-only":
      return "March reaches only a neighbouring territory.";
    case "motor-contested-ground":
      return "Motor can't enter contested ground.";
    case "motor-needs-road":
      return `Motor needs a ${scenario.linkModifiers.road?.motorLevel === "main" ? "main road" : "road"} all the way.`;
    case "motor-needs-trucks":
      return "Motor needs trucks for every unit.";
    case "motor-pass-closed":
      return `Motor can't cross the ${requirePassName(scenario, ...refusal.link)} pass.`;
    case "motor-too-far":
      return `Motor reaches at most ${String(refusal.territories)} territories.`;
    case "no-border-from-pocket":
      return "Your ground there does not border it.";
    case "no-rail-line":
      return "No rail line your side holds reaches it this turn.";
    case "no-rail-to-capital":
      return "No rail line your side holds reaches that capital this turn.";
    case "no-sea-lane":
      return "No sea lane joins those territories.";
    case "not-connected":
      return "Destination is not connected to the unit's territory.";
    case "out-of-reach":
      return "Out of reach this turn.";
    case "rail-full":
      return railFullText(scenario, refusal);
    case "route-ends-elsewhere":
      return "The route does not end at the destination.";
    case "route-repeats-territory":
      return "A route may not enter the same territory twice.";
    case "route-shape":
      return "That route is not one of the allowed shapes of move.";
    case "same-destination":
      return "Choose a different territory as the destination.";
    case "sea-closed":
      return "The sea is closed by winter storms this turn.";
    case "unit-cannot-move":
      return "This unit cannot move.";
    // Contested ground.
    case "move-in-contested-ground":
      return "Not in contested ground: units here attack or withdraw.";
    case "unit-cannot-withdraw":
      return "This unit cannot withdraw.";
    case "withdraw-no-way-out":
      return "No way out through your own sub-territories.";
    case "withdraw-not-contested":
      return "Withdraw is only for contested ground. Use Move.";
    case "withdraw-target":
      return "Withdraw to a neighbouring territory you hold whole.";
    // Air missions and generals.
    case "grounded-by-weather":
      return "Grounded by the weather.";
    case "mission-needs-aircraft":
      return "Only aircraft fly missions.";
    case "mission-not-flown":
      return `A ${requireUnitType(scenario, refusal.unitTypeId).name} cannot fly that mission.`;
    case "no-airfield":
      return "The aircraft has no airfield to fly from.";
    case "raid-own-ground":
      return "Raids target ground another faction holds.";
    case "recon-own-ground":
      return "Recon looks at ground another faction holds.";
    case "sack-needs-general":
      return "Only a general can be sacked.";
    case "target-out-of-range":
      return "The target is out of range.";
    case "unknown-target":
      return "Unknown target.";
    // Building and link works.
    case "already-built":
      return "Already built.";
    case "already-queued":
      return "Already in the queue.";
    case "build-contested":
      return "Contested: building waits until the territory is held whole.";
    case "link-busy":
      return "Another work on this link is in the queue.";
    case "link-main-line-already":
      return "This is a main line already.";
    case "link-needs-railway":
      return "Needs a railway first.";
    case "link-not-at-end":
      return "Queue link works at one end of the link.";
    case "link-not-bordering":
      return "Those sub-territories don't border each other.";
    case "link-railway-already":
      return "There is a railway here already.";
    case "link-road-serves":
      return "Trucks can use this road already.";
    case "max-level":
      return `Max level is ${String(refusal.level)}.`;
    case "needs-building":
      return `Needs ${requireBuilding(scenario, refusal.buildingId).name} first.`;
    case "needs-capital":
      return "Capital sub-territory only.";
    case "needs-city":
      return "Needs a city.";
    case "no-railway":
      return "No railway runs here.";
    case "not-buildable-here":
      return `Can't be built in ${requireSubTerritory(scenario, refusal.subTerritoryId).name}.`;
    case "project-unavailable":
      return "Not available in this scenario.";
    case "resources-short":
      return `Needs ${refusal.short.map(({ amount, resourceId }) => `${String(amount)} more ${requireResource(scenario, resourceId).name}`).join(" and ")}.`;
    case "site-captured":
      return "The sub-territory changed hands before work began.";
    case "site-not-held":
      return `${requireSubTerritory(scenario, refusal.subTerritoryId).name} is not yours.`;
    case "unknown-site":
      return "Unknown sub-territory.";
    // Recruiting, replenishing and disbanding.
    case "capital-fell-before-training":
      return "The capital fell before training began.";
    case "capital-fell-in-training":
      return "The capital fell while the unit was training; its payment is lost.";
    case "full-strength":
      return "This unit is at full strength and in good order.";
    case "full-strength-demoralized":
      return "This unit is at full strength. It recovers its morale by resting, or with a general's rally.";
    case "payment-short-at-reveal":
      return "Not enough Funds or Manpower when the orders were revealed.";
    case "recruit-contested":
      return `${requireTerritory(scenario, refusal.territoryId).name} is contested. No new units can be recruited there.`;
    case "recruit-locked":
      return refusalsText(scenario, refusal.refusals);
    case "recruit-not-held":
      return `You must hold ${requireTerritory(scenario, refusal.territoryId).name} to recruit there.`;
    case "recruit-slots-full":
      return `At most ${String(refusal.slots)} new units a turn can be recruited there.`;
    case "recruiting-unavailable":
      return "Recruiting is not part of this scenario.";
    case "replenish-contested":
      return `${requireTerritory(scenario, refusal.territoryId).name} is contested. Units replenish only in uncontested ground.`;
    case "replenish-not-held":
      return "Units replenish only in territory you hold.";
    case "replenishing-unavailable":
      return "Replenishing is not part of this scenario.";
    case "requirements-missing":
      return `Needs ${missingWords(scenario, refusal.territoryId, refusal.missing)}.`;
    case "type-cannot-disband":
      return `${requireUnitType(scenario, refusal.unitTypeId).name} units cannot disband.`;
    case "type-cannot-replenish":
      return `${requireUnitType(scenario, refusal.unitTypeId).name} units cannot replenish.`;
    case "type-not-raised-by":
      return `Not raised by the ${requireFaction(scenario, refusal.factionId).name}.`;
    case "type-not-recruited":
      return `${requireUnitType(scenario, refusal.unitTypeId).name} cannot be recruited.`;
    case "unit-fell-back":
      return "The unit fell back.";
    case "unit-fought":
      return "The unit fought a battle.";
    case "unit-lost":
      return "The unit was lost before the men arrived.";
    case "unknown-territory":
      return "Unknown territory.";
    case "unknown-unit-type":
      return "Unknown unit type.";
    case "upkeep-short":
      return `Next turn's upkeep would leave you short of ${refusal.resourceIds.map((id) => requireResource(scenario, id).name).join(" and ")}.`;
    default:
      return unwritten(refusal);
  }
}

/** Several refusals as one line. */
export function refusalsText(scenario: Scenario, refusals: readonly Refusal[]): string {
  return refusals.map((refusal) => refusalText(scenario, refusal)).join(" ");
}

/** The move mode a refusal is about, when its sentence opens by naming one. */
export function refusedMode(refusal: Refusal): MoveMode | undefined {
  switch (refusal.code) {
    case "march-neighbours-only":
      return "march";
    case "motor-contested-ground":
    case "motor-needs-road":
    case "motor-needs-trucks":
    case "motor-pass-closed":
    case "motor-too-far":
      return "motor";
    case "rail-full":
      return "rail";
    default:
      return undefined;
  }
}

/** U12: why a unit can't replenish, in a few words for a list. */
export function replenishSkipText(scenario: Scenario, refusal: Refusal): string {
  switch (refusal.code) {
    case "full-strength":
    case "full-strength-demoralized":
      return "at full strength";
    case "replenish-contested":
      return "in contested ground";
    case "replenish-not-held":
      return "outside your territory";
    case "type-cannot-replenish":
      return `${requireUnitType(scenario, refusal.unitTypeId).name} units cannot replenish`;
    default:
      return refusalText(scenario, refusal);
  }
}

/** R3: the building's or the track's name. */
export function requirementName(scenario: Scenario, requirement: RecruitRequirement): string {
  return requirement.kind === "building"
    ? requireBuilding(scenario, requirement.buildingId).name
    : requireDevelopment(scenario, requirement.developmentId).name;
}

/** R3: "a Barracks in Valladolid and a Factory in Castilla y Leon": buildings belong in the capital, tracks anywhere in the territory. */
function missingWords(scenario: Scenario, territoryId: TerritoryId, missing: readonly RecruitRequirement[]): string {
  const territory = requireTerritory(scenario, territoryId);
  const capital = territory.capitalSubTerritoryId;
  const places = { building: capital === undefined ? territory.name : requireSubTerritory(scenario, capital).name, development: territory.name };
  return (["building", "development"] as const).flatMap((kind) => {
    const names = missing.filter((requirement) => requirement.kind === kind).map((requirement) => `a ${requirementName(scenario, requirement)}`);
    return names.length === 0 ? [] : [`${listNames(names)} in ${places[kind]}`];
  }).join(" and ");
}

/** D5: the refusal of an army its trains can't take whole, with the places left. */
function railFullText(scenario: Scenario, { boarding, left, places }: RailShortage): string {
  const station = requireSubTerritory(scenario, boarding).name;
  if (left === 0) return `Rail has no places left at ${station} this turn.`;
  return `Rail has only ${String(left)} ${left === 1 ? "place" : "places"} left at ${station} this turn, and ${String(places)} units would board.`;
}

/** A code no sentence covers: the compiler rules it out, so only data from another version reaches this. */
function unwritten(refusal: never): never {
  throw new Error(`Invariant violated: no words for refusal ${JSON.stringify(refusal)}.`);
}
