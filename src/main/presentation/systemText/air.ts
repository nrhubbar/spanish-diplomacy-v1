import { requireBuilding, requireDevelopment } from "../../engine/lookup";
import { subTerritoryYield } from "../../engine/economy/income";
import { holdsWhole } from "../../engine/partition/holders";
import type { AirBattleAircraft, AirBattleOutcome, AirMissionOrder, AirTurnOutcome, RaidFlownOutcome, RaidOutcome } from "../../engine/types";
import { amountText } from "../economy";
import { refusalText } from "../refusals";
import { factionLabel, listNames, type ReportLineContext, type ReportLines, subTerritoryLabel, territoryLabel, unitLabel } from "./lines";

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
      if (outcome.buildingId !== undefined) return `${requireBuilding(scenario, outcome.buildingId).name} hit`;
      if (outcome.developmentId !== undefined) return `${requireDevelopment(scenario, outcome.developmentId).name} down a level`;
      return "nothing worth hitting";
  }
}

/** R11: what the air battle did: "; Army of the North gets Ground Support; Republican Government loses Fighter squadron No. 1". */
function airResult({ scenario }: ReportLineContext, { aircraftLost, input, result: { row }, support }: AirBattleOutcome): string {
  // A side can be several factions: each is named by its own aircraft.
  const owners = (aircraft: readonly AirBattleAircraft[]): readonly string[] => [...new Set(aircraft.map(({ factionId }) => factionLabel(scenario, factionId)))];
  const counted = row.support === "none" ? [] : input[row.support].aircraft.filter(({ unitId }) => support[row.support as "attacker" | "defender"].unitIds.includes(unitId));
  const winner = counted.length === 0 ? "no Ground Support counts" : `${listNames(owners(counted))} gets Ground Support`;
  const fates = (["attacker", "defender"] as const).flatMap((role) => {
    const { aircraft } = input[role];
    const lost = aircraft.filter(({ unitId }) => aircraftLost.includes(unitId));
    const left = aircraft.filter(({ unitId }) => !aircraftLost.includes(unitId));
    const away = row.support === "none" ? "return home" : "are driven off";
    return [
      ...lost.map((entry) => `${factionLabel(scenario, entry.factionId)} loses ${unitLabel(scenario, entry.unitId)}`),
      ...(row.support === role ? [] : owners(left).map((name) => `${name}'s ${lost.some((entry) => factionLabel(scenario, entry.factionId) === name) ? "other " : ""}aircraft ${away}`))
    ];
  });
  return [`; ${winner}`, ...fates].join("; ");
}

export const airLines: ReportLines<AirTurnOutcome> = {
  "air-battle": (outcome, context) => {
    const { attacker, defender } = outcome.input;
    const { scenario } = context;
    return `Air battle over ${territoryLabel(scenario, outcome.territoryId)}, ${factionLabel(scenario, attacker.factionId)} against ${factionLabel(scenario, defender.factionId)}: ${outcome.result.row.name} (${String(outcome.result.score)})${airResult(context, outcome)}.`;
  },
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
  "air-support": (outcome, context) => {
    const where = territoryLabel(context.scenario, outcome.territoryId);
    if (outcome.battleIndex === undefined) return `${flier(context, outcome.order)} flew Ground Support over ${where}, but no battle was fought there.`;
    // R11: only the side that wins the air battle gets Ground Support, and at most two aircraft count.
    return outcome.applied === false
      ? `${flier(context, outcome.order)} flew Ground Support for the battle for ${where}, but its support did not count.`
      : `${flier(context, outcome.order)} gave Ground Support in the battle for ${where}.`;
  },
  // U2: the weather is Rain, Mud or Snow at a base without a paved airfield.
  grounded: (outcome, context) =>
    outcome.refusal.code === "grounded-by-weather" ? `${flier(context, outcome.order)} was grounded by the weather.` : `${flier(context, outcome.order)} did not fly: ${refusalText(context.scenario, outcome.refusal)}`,
  "aircraft-rebased": (outcome, context) =>
    `${flier(context, outcome)} lost its airfield in ${territoryLabel(context.scenario, outcome.from)} and flew to ${territoryLabel(context.scenario, outcome.to)}.`,
  "aircraft-lost": (outcome, context) =>
    `${flier(context, outcome)} lost its airfield in ${territoryLabel(context.scenario, outcome.from)} and was destroyed on the ground.`
};
