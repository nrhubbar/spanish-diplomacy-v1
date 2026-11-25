import { describe, expect, it } from "vitest";
import { type Feedback, feedbackText } from "../main/presentation/feedback";
import { unexpectedError } from "../main/presentation/notifications";
import { skippedText } from "../main/presentation/replenish";
import { unitName } from "../main/presentation/text";
import { faction, spain, territory, unit } from "./support";

const scenario = spain();
const madrid = territory("madrid");
const galicia = territory("galicia");
const wadRas = unit("rep-wad-ras-1");
const upkeep = [{ reason: { code: "upkeep" }, unitId: wadRas }] as const;
const skipped = `Skips ${unitName(scenario, wadRas)} (upkeep leaves too little next turn).`;

const cases: readonly (readonly [Feedback, string])[] = [
  [{ code: "refused", refusals: [{ code: "unknown-unit" }] }, "Unknown unit."],
  [{ code: "refused", refusals: [{ code: "unknown-unit" }, { code: "order-of-another-faction" }] }, "Unknown unit. An order belongs to another faction."],
  [{ cause: { reason: "cannot-fight" }, code: "held-back", from: madrid, to: galicia }, "It can't go alone: tick a unit in Madrid that can fight and goes the same way."],
  [{ code: "disband-planned", unitIds: [wadRas] }, `${unitName(scenario, wadRas)} will disband at the end of the turn.`],
  [{ aircraft: 1, code: "muster-ordered", kind: "invade", territoryId: madrid, units: 2 }, "2 units and 1 aircraft ordered to invade Madrid."],
  [{ aircraft: 0, code: "muster-ordered", kind: "reinforce", territoryId: madrid, units: 1 }, "1 unit ordered to reinforce Madrid."],
  [{ aircraft: 3, code: "muster-ordered", kind: "invade", territoryId: madrid, units: 0 }, "3 aircraft ordered to invade Madrid."],
  [{ aircraft: 0, code: "muster-ordered", kind: "invade", territoryId: madrid, units: 0 }, "No units are ordered to invade Madrid."],
  [{ code: "not-connected", from: madrid, to: galicia }, "Galicia is not connected to Madrid. Choose a highlighted territory."],
  [{ code: "out-of-range", range: 1 }, "Out of range: it flies up to 1 territory from its airfield."],
  [{ code: "out-of-range", range: 3 }, "Out of range: it flies up to 3 territories from its airfield."],
  [{ code: "player-needed", factionId: faction("republic") }, `Choose a local or computer player for ${String(scenario.factions.find((each) => each.id === "republic")?.name)}. Online play is coming later.`],
  [{ code: "recruit-slots", slots: 4 }, "At most 4 new units a turn can be recruited here."],
  [{ code: "replenish-none", skipped: upkeep }, `No selected unit can replenish. ${skipped}`],
  [{ code: "replenish-planned", skipped: [], units: 1 }, "1 unit will replenish."],
  [{ code: "replenish-planned", skipped: upkeep, units: 2 }, `2 units will replenish. ${skipped}`],
  [{ code: "stay-planned", order: "attack", units: 1 }, "1 unit will attack where they stand."],
  [{ code: "stay-planned", order: "hold", units: 2 }, "2 units will hold."],
  [{ code: "stay-planned", order: "entrench", units: 1 }, "1 unit will entrench."],
  [{ code: "stay-planned", order: "rest", units: 1 }, "1 unit will rest."],
  [{ code: "support-cancelled", territoryIds: [madrid, galicia] }, "Ground Support over Madrid and Galicia is cancelled too: none of your units go there now."],
  [
    { before: { code: "build-queued" }, code: "support-cancelled", territoryIds: [madrid] },
    "Queued. It is paid when orders are revealed. Ground Support over Madrid is cancelled too: none of your units go there now."
  ],
  [{ code: "build-queued" }, "Queued. It is paid when orders are revealed."],
  [{ code: "cannot-entrench" }, "Demoralized units cannot entrench. They rest instead."],
  [{ code: "cannot-move-together" }, "These units cannot move anywhere together this turn."],
  [{ code: "cannot-rest" }, "Only demoralized units rest."],
  [{ code: "every-unit-moving" }, "Every unit here is moving. Select one to change its order."],
  [{ code: "move-not-chosen" }, "Select units and choose Move first."],
  [{ code: "no-mission-target" }, "Nothing in range for this mission."],
  [{ code: "no-territory-selected" }, "Select a territory first."],
  [{ code: "no-units-here" }, "None of your units are in this territory."],
  [{ code: "no-units-selected" }, "Select at least one unit first."],
  [{ code: "no-way-out" }, "These units have no way out through your own sub-territories."],
  [{ code: "not-your-unit" }, "Select one of your own units."],
  [{ code: "nothing-to-hit" }, "Nothing to hit there."],
  [{ code: "replenish-unpaid" }, "Not enough Funds or Manpower left to replenish."],
  [{ code: "same-destination" }, "Choose a different territory as the destination."],
  [{ code: "unreachable-together" }, "These units cannot move there together. Choose a highlighted territory."],
  [{ code: "withdraw-target" }, "Withdraw to a highlighted territory: one you hold whole, reached through your own sub-territories."]
];

describe("what the player is told", () => {
  it.each(cases)("%j", (feedback, text) => {
    expect(feedbackText(scenario, feedback)).toBe(text);
  });

  it("names the resources a skipped Replenish is short of", () => {
    const [funds, manpower] = scenario.resources;
    const reason = { code: "unpaid", resourceIds: [funds!.id, manpower!.id] } as const;
    expect(skippedText(scenario, [{ reason, unitId: wadRas }])).toBe(`Skips ${unitName(scenario, wadRas)} (not enough ${funds!.name} and ${manpower!.name}).`);
  });

  it("has words for a failed action that has none", () => {
    expect(unexpectedError).toBe("Unexpected application error.");
  });
});
