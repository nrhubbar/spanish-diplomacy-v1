import { subTerritoryYield } from "../../engine/economy/income";
import { holdsWhole } from "../../engine/partition/holders";
import type { AirMissionOrder, AirTurnOutcome, RaidFlownOutcome, RaidOutcome } from "../../engine/types";
import { amountText } from "../economy";
import { factionLabel, type ReportLineContext, type ReportLines, subTerritoryLabel, territoryLabel, unitLabel } from "./lines";

/**
 * U2-U4, D7: the air outcomes as report sentences. Raids, interceptions, support, grounding and
 * rebasing are public; recon is its flier's own (CT-46). A raid's income cut is read from the
 * target's development, which is on the board, never from a treasury.
 */

/** U3: the raid table's outcomes as players read them. */
export const raidResultNames: Readonly<Record<RaidOutcome, string>> = {
  "air-eliminated": "Air eliminated",
  "building-hit": "Building hit",
  "income-cut": "Income cut 1 turn",
  "nothing-hit": "Nothing hit"
};

/** "Republican Government's Bomber squadron No. 1". */
function flier(context: ReportLineContext, order: Pick<AirMissionOrder, "factionId" | "unitId">): string {
  return `${factionLabel(context.scenario, order.factionId)}'s ${unitLabel(context.scenario, order.unitId)}`;
}

/** U3: what the raid did, after the target's name: "Airfield hit", "income cut by 4 Funds next turn". */
function raidEffect(context: ReportLineContext, outcome: RaidFlownOutcome): string {
  const { scenario, state } = context;
  switch (outcome.result) {
    case "air-eliminated":
      return "the raider was shot down";
    case "nothing-hit":
      return "nothing hit";
    case "income-cut": {
      // U3, $2: as `raidIncomeDelta`, the cut is the site's yield, and only a territory held whole pays any.
      const site = state?.subTerritories[outcome.subTerritoryId];
      const territoryId = scenario.index.subTerritories.get(outcome.subTerritoryId)?.territoryId;
      if (state === undefined || site === undefined || territoryId === undefined) return "income cut next turn";
      if (!holdsWhole(scenario, state, territoryId, site.holder)) return `no income to cut while ${territoryLabel(scenario, territoryId)} is contested`;
      const cut = amountText(scenario, subTerritoryYield(scenario, site), " and ");
      return cut === "nothing" ? "no income to cut there" : `income cut by ${cut} next turn`;
    }
    case "building-hit":
      if (outcome.buildingId !== undefined) return `${scenario.index.buildings.get(outcome.buildingId)?.name ?? outcome.buildingId} hit`;
      if (outcome.developmentId !== undefined) return `${scenario.index.development.get(outcome.developmentId)?.name ?? outcome.developmentId} down a level`;
      return "nothing worth hitting";
  }
}

export const airLines: ReportLines<AirTurnOutcome> = {
  raid: (outcome, context) => {
    const { scenario } = context;
    const others = outcome.aircraftLost.filter((id) => outcome.result !== "air-eliminated" || id !== outcome.order.unitId).length;
    const losses = others === 0 ? "" : `; ${String(others)} aircraft lost to fighters`;
    return `Raid on ${subTerritoryLabel(scenario, outcome.subTerritoryId)} by ${flier(context, outcome.order)}: ${raidEffect(context, outcome)}${losses}.`;
  },
  recon: (outcome, context) =>
    `${flier(context, outcome.order)} flew reconnaissance over ${territoryLabel(context.scenario, outcome.territoryId)}; its balances, queues and training show until turn ${String(outcome.untilTurn)}.`,
  interception: (outcome, { scenario }) => {
    const lost = outcome.lostUnitIds.length;
    return `${factionLabel(scenario, outcome.factionId)}'s fighters intercepted enemy aircraft over ${territoryLabel(scenario, outcome.territoryId)}${lost === 0 ? "." : `, shooting down ${String(lost)}.`}`;
  },
  "air-support": (outcome, context) =>
    outcome.battleIndex === undefined
      ? `${flier(context, outcome.order)} flew support over ${territoryLabel(context.scenario, outcome.territoryId)}, but no battle was fought there.`
      : `${flier(context, outcome.order)} supported the battle for ${territoryLabel(context.scenario, outcome.territoryId)}.`,
  // U2: "weather" is the mission step's code for Mud and Snow without a paved airfield.
  grounded: (outcome, context) =>
    outcome.reason === "weather" ? `${flier(context, outcome.order)} was grounded by the weather.` : `${flier(context, outcome.order)} did not fly: ${outcome.reason}`,
  "aircraft-rebased": (outcome, context) =>
    `${flier(context, outcome)} lost its airfield in ${territoryLabel(context.scenario, outcome.from)} and flew to ${territoryLabel(context.scenario, outcome.to)}.`,
  "aircraft-lost": (outcome, context) =>
    `${flier(context, outcome)} lost its airfield in ${territoryLabel(context.scenario, outcome.from)} and was destroyed on the ground.`
};
