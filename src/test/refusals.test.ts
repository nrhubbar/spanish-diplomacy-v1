// The engine says why in codes; every code has one sentence, the same the player always read.
import { describe, expect, it } from "vitest";
import { modeNames } from "../main/presentation/moveModes";
import { refusalsText, refusalText, refusedMode, replenishSkipText } from "../main/presentation/refusals";
import type { BuildingId, DevelopmentId, Refusal, RefusalCode, ResourceId, Scenario, SubTerritoryId, UnitTypeId } from "../main/engine/types";
import { faction, said, spainWithAir, territory } from "./support";
import { initialGameState, resolveTurn } from "../main/engine/resolution";

const scenario = spainWithAir();
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const type = (id: string): UnitTypeId => id as UnitTypeId;
const barracks = { buildingId: "barracks" as BuildingId, kind: "building" } as const;
const factory = { developmentId: "factory" as DevelopmentId, kind: "development" } as const;

/** One refusal of each code, with its sentence: a code left out does not compile. */
const examples: { readonly [Code in RefusalCode]: readonly [Omit<Extract<Refusal, { readonly code: Code }>, "code">, string] } = {
  "already-built": [{}, "Already built."],
  "already-queued": [{}, "Already in the queue."],
  "build-contested": [{}, "Contested: building waits until the territory is held whole."],
  "capital-fell-before-training": [{}, "The capital fell before training began."],
  "capital-fell-in-training": [{}, "The capital fell while the unit was training; its payment is lost."],
  "demoralized-attack": [{}, "A demoralized unit cannot attack. It can move only into empty or friendly territory."],
  "enemy-ground-on-the-way": [{}, "Only the last step of a move may enter enemy or contested ground."],
  "foot-only": [{}, "Only foot units can cross where there is no road."],
  "full-strength": [{}, "This unit is at full strength and in good order."],
  "full-strength-demoralized": [{}, "This unit is at full strength. It recovers its morale by resting, or with a general's rally."],
  "grounded-by-weather": [{}, "Grounded by the weather."],
  "lane-port-not-held": [{}, "An army can sail only from the lane's port, and your side must hold it."],
  "link-busy": [{}, "Another work on this link is in the queue."],
  "link-main-line-already": [{}, "This is a main line already."],
  "link-needs-railway": [{}, "Needs a railway first."],
  "link-not-at-end": [{}, "Queue link works at one end of the link."],
  "link-not-bordering": [{}, "Those sub-territories don't border each other."],
  "link-railway-already": [{}, "There is a railway here already."],
  "link-road-serves": [{}, "Trucks can use this road already."],
  "march-neighbours-only": [{}, "March reaches only a neighbouring territory."],
  "max-level": [{ level: 2 }, "Max level is 2."],
  "mission-needs-aircraft": [{}, "Only aircraft fly missions."],
  "mission-not-flown": [{ unitTypeId: type("fighter-squadron") }, "A Fighter squadron cannot fly that mission."],
  "motor-contested-ground": [{}, "Motor can't enter contested ground."],
  "motor-needs-road": [{}, "Motor needs a road all the way."],
  "motor-needs-trucks": [{}, "Motor needs trucks for every unit."],
  "motor-pass-closed": [{ link: [sub("guadarrama"), sub("segovia")] }, "Motor can't cross the Somosierra pass."],
  "motor-too-far": [{ territories: 2 }, "Motor reaches at most 2 territories."],
  "move-in-contested-ground": [{}, "Not in contested ground: units here attack or withdraw."],
  "needs-building": [{ buildingId: "airfield" as BuildingId }, "Needs Airfield first."],
  "needs-capital": [{}, "Capital sub-territory only."],
  "needs-city": [{}, "Needs a city."],
  "no-airfield": [{}, "The aircraft has no airfield to fly from."],
  "no-border-from-pocket": [{}, "Your ground there does not border it."],
  "no-rail-line": [{}, "No rail line your side holds reaches it this turn."],
  "no-rail-to-capital": [{}, "No rail line your side holds reaches that capital this turn."],
  "no-railway": [{}, "No railway runs here."],
  "no-sea-lane": [{}, "No sea lane joins those territories."],
  "not-buildable-here": [{ subTerritoryId: sub("madrid") }, "Can't be built in Madrid."],
  "not-connected": [{}, "Destination is not connected to the unit's territory."],
  "one-order-per-unit": [{}, "A unit can receive only one order per turn."],
  "order-of-another-faction": [{}, "An order belongs to another faction."],
  "order-unavailable": [{}, "This order is not available in this scenario."],
  "out-of-reach": [{}, "Out of reach this turn."],
  "payment-short-at-reveal": [{}, "Not enough Funds or Manpower when the orders were revealed."],
  "project-unavailable": [{}, "Not available in this scenario."],
  "raid-own-ground": [{}, "Raids target ground another faction holds."],
  "rail-full": [{ boarding: sub("madrid"), left: 1, places: 3 }, "Rail has only 1 place left at Madrid this turn, and 3 units would board."],
  "recon-own-ground": [{}, "Recon looks at ground another faction holds."],
  "recruit-contested": [{ territoryId: territory("murcia") }, "Murcia is contested. No new units can be recruited there."],
  "recruit-locked": [{ refusals: [{ code: "type-not-raised-by", factionId: faction("republic") }, { code: "needs-city" }] }, "Not raised by the Republican Government. Needs a city."],
  "recruit-not-held": [{ territoryId: territory("murcia") }, "You must hold Murcia to recruit there."],
  "recruit-slots-full": [{ slots: 3 }, "At most 3 new units a turn can be recruited there."],
  "recruiting-unavailable": [{}, "Recruiting is not part of this scenario."],
  "replenish-contested": [{ territoryId: territory("murcia") }, "Murcia is contested. Units replenish only in uncontested ground."],
  "replenish-not-held": [{}, "Units replenish only in territory you hold."],
  "replenishing-unavailable": [{}, "Replenishing is not part of this scenario."],
  "requirements-missing": [{ missing: [barracks, factory], territoryId: territory("asturias") }, "Needs a Barracks in Oviedo and a Factory in Asturias."],
  "resources-short": [{ short: [{ amount: 4, resourceId: "funds" as ResourceId }, { amount: 1, resourceId: "manpower" as ResourceId }] }, "Needs 4 more Funds and 1 more Manpower."],
  "route-ends-elsewhere": [{}, "The route does not end at the destination."],
  "route-repeats-territory": [{}, "A route may not enter the same territory twice."],
  "route-shape": [{}, "That route is not one of the allowed shapes of move."],
  "sack-needs-general": [{}, "Only a general can be sacked."],
  "same-destination": [{}, "Choose a different territory as the destination."],
  "sea-closed": [{}, "The sea is closed by winter storms this turn."],
  "site-captured": [{}, "The sub-territory changed hands before work began."],
  "site-not-held": [{ subTerritoryId: sub("segovia") }, "Segovia is not yours."],
  "submission-of-another-faction": [{}, "Submission belongs to another faction."],
  "target-out-of-range": [{}, "The target is out of range."],
  "type-cannot-disband": [{ unitTypeId: type("general") }, "General units cannot disband."],
  "type-cannot-replenish": [{ unitTypeId: type("fighter-squadron") }, "Fighter squadron units cannot replenish."],
  "type-not-raised-by": [{ factionId: faction("republic") }, "Not raised by the Republican Government."],
  "type-not-recruited": [{ unitTypeId: type("general") }, "General cannot be recruited."],
  "unit-cannot-move": [{}, "This unit cannot move."],
  "unit-cannot-withdraw": [{}, "This unit cannot withdraw."],
  "unit-elsewhere": [{}, "Selected unit is no longer in that territory."],
  "unit-fell-back": [{}, "The unit fell back."],
  "unit-fought": [{}, "The unit fought a battle."],
  "unit-lost": [{}, "The unit was lost before the men arrived."],
  "unit-of-another-faction": [{}, "Selected unit belongs to another player."],
  "unknown-site": [{}, "Unknown sub-territory."],
  "unknown-target": [{}, "Unknown target."],
  "unknown-territory": [{}, "Unknown territory."],
  "unknown-unit": [{}, "Unknown unit."],
  "unknown-unit-type": [{}, "Unknown unit type."],
  "upkeep-short": [{ resourceIds: ["funds" as ResourceId, "manpower" as ResourceId] }, "Next turn's upkeep would leave you short of Funds and Manpower."],
  "withdraw-no-way-out": [{}, "No way out through your own sub-territories."],
  "withdraw-not-contested": [{}, "Withdraw is only for contested ground. Use Move."],
  "withdraw-target": [{}, "Withdraw to a neighbouring territory you hold whole."]
};
const all = Object.entries(examples).map(([code, [parameters, text]]): readonly [Refusal, string] => [{ code, ...parameters } as Refusal, text]);

describe("the words of every refusal", () => {
  it.each(all.map(([refusal, text]) => [refusal.code, refusal, text] as const))("%s", (_code, refusal, text) => {
    expect(refusalText(scenario, refusal)).toBe(text);
  });

  it("count the train places, and join the missing buildings by place", () => {
    expect(said(scenario, { boarding: sub("madrid"), code: "rail-full", left: 0, places: 2 })).toBe("Rail has no places left at Madrid this turn.");
    expect(said(scenario, { boarding: sub("madrid"), code: "rail-full", left: 2, places: 3 })).toBe("Rail has only 2 places left at Madrid this turn, and 3 units would board.");
    expect(said(scenario, { code: "requirements-missing", missing: [barracks, { buildingId: "airfield" as BuildingId, kind: "building" }], territoryId: territory("asturias") })).toBe("Needs a Barracks and a Airfield in Oviedo.");
    expect(said(scenario, { code: "requirements-missing", missing: [factory], territoryId: territory("asturias") })).toBe("Needs a Factory in Asturias.");
    expect(refusalsText(scenario, [])).toBe("");
  });

  it("ask for a main road where the scenario keeps Motor to them", () => {
    const { road } = scenario.linkModifiers;
    if (road === undefined) throw new Error("fixture");
    const mainOnly: Scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, road: { ...road, motorLevel: "main" } } };
    expect(said(mainOnly, { code: "motor-needs-road" })).toBe("Motor needs a main road all the way.");
  });

  it("trust the scenario to have what a refusal is about", () => {
    expect(() => refusalText(scenario, { code: "motor-pass-closed", link: [sub("madrid"), sub("barcelona")] })).toThrow(/unknown pass/u);
    expect(() => refusalText(scenario, { code: "site-not-held", subTerritoryId: sub("atlantis") })).toThrow(/unknown sub-territory/u);
    expect(() => refusalText(scenario, { code: "no-such-code" } as never)).toThrow(/no words for refusal/u);
  });

  it("lead with the mode a hover note marks them with", () => {
    for (const [refusal, text] of all) {
      const named = Object.entries(modeNames).find(([, name]) => text.startsWith(`${name} `))?.[0];
      expect(refusedMode(refusal), refusal.code).toBe(named);
    }
  });

  it("shorten why a unit can't replenish to a few words", () => {
    const short = (refusal: Refusal): string => replenishSkipText(scenario, refusal);
    expect(short({ code: "full-strength" })).toBe("at full strength");
    expect(short({ code: "full-strength-demoralized" })).toBe("at full strength");
    expect(short({ code: "replenish-contested", territoryId: territory("murcia") })).toBe("in contested ground");
    expect(short({ code: "replenish-not-held" })).toBe("outside your territory");
    expect(short({ code: "type-cannot-replenish", unitTypeId: type("general") })).toBe("General units cannot replenish");
    expect(short({ code: "replenishing-unavailable" })).toBe("Replenishing is not part of this scenario.");
  });
});

describe("what a game saves", () => {
  it("keeps no sentence in the outcomes of refused orders", () => {
    const republic = faction("republic");
    const state = initialGameState(scenario);
    const recruits = Array.from({ length: 4 }, () => ({ factionId: republic, kind: "recruit" as const, territoryId: territory("madrid"), unitTypeId: type("militia-column") }));
    const { outcomes } = resolveTurn(scenario, state, [{ factionId: republic, orders: [...recruits, { factionId: republic, kind: "build", project: { buildingId: "barracks" as BuildingId, kind: "building" }, subTerritoryId: sub("segovia") }] }], 3);
    const refused = outcomes.filter((outcome) => "refusal" in outcome);
    expect(refused.length).toBeGreaterThan(0);
    expect(JSON.stringify(refused)).not.toMatch(/"[^"]* [^"]*"/u);
  });
});
