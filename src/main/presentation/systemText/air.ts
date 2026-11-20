import { requireUnitDefinition } from "../../engine/lookup";
import type { AirMissionOrder, AirTurnOutcome, RaidOutcome, Scenario, SystemOutcome } from "../../engine/types";

/** Short report lines for the air outcomes, for places without the scenario. */
export const airLines: Readonly<Record<AirTurnOutcome["kind"], string>> = {
  "air-support": "Aircraft supported a battle.",
  grounded: "An aircraft could not fly.",
  interception: "Fighters intercepted a raid.",
  raid: "Aircraft raided a province.",
  recon: "Aircraft flew a reconnaissance mission.",
  "aircraft-lost": "An aircraft lost its airfield and was destroyed on the ground.",
  "aircraft-rebased": "An aircraft lost its airfield and flew to another."
};

const airKinds = new Set<string>(Object.keys(airLines));

export function isAirOutcome(outcome: SystemOutcome): outcome is AirTurnOutcome {
  return airKinds.has(outcome.kind);
}

/** U3: the raid table's outcomes as players read them. */
export const raidResultNames: Readonly<Record<RaidOutcome, string>> = {
  "air-eliminated": "Air eliminated",
  "building-hit": "Building hit",
  "income-cut": "Income cut 1 turn",
  "nothing-hit": "Nothing hit"
};

function unit(scenario: Scenario, order: Pick<AirMissionOrder, "unitId">): string {
  return requireUnitDefinition(scenario, order.unitId).name;
}

function faction(scenario: Scenario, id: AirMissionOrder["factionId"]): string {
  return scenario.index.factions.get(id)?.name ?? id;
}

function territory(scenario: Scenario, id: Parameters<Scenario["index"]["territories"]["get"]>[0]): string {
  return scenario.index.territories.get(id)?.name ?? id;
}

/** U2-U4, D7: one full report sentence per air outcome. */
export function describeAirOutcome(scenario: Scenario, outcome: AirTurnOutcome): string {
  switch (outcome.kind) {
    case "raid":
      return describeRaid(scenario, outcome);
    case "recon":
      return `${faction(scenario, outcome.order.factionId)}: ${unit(scenario, outcome.order)} flew reconnaissance over ${territory(scenario, outcome.territoryId)}; its balances, queues and training are shown next turn.`;
    case "interception": {
      const lost = outcome.lostUnitIds.length;
      return `${faction(scenario, outcome.factionId)}'s fighters intercepted raiders over ${territory(scenario, outcome.territoryId)}${lost === 0 ? "." : `, shooting down ${String(lost)}.`}`;
    }
    case "air-support":
      return outcome.battleIndex === undefined
        ? `${faction(scenario, outcome.order.factionId)}: ${unit(scenario, outcome.order)} flew support over ${territory(scenario, outcome.territoryId)}, but no battle was fought there.`
        : `${faction(scenario, outcome.order.factionId)}: ${unit(scenario, outcome.order)} supported the battle for ${territory(scenario, outcome.territoryId)}.`;
    case "grounded":
      return `${faction(scenario, outcome.order.factionId)}: ${unit(scenario, outcome.order)} was grounded by the weather.`;
    case "aircraft-rebased":
      return `${faction(scenario, outcome.factionId)}: ${unit(scenario, outcome)} lost its airfield in ${territory(scenario, outcome.from)} and flew to ${territory(scenario, outcome.to)}.`;
    case "aircraft-lost":
      return `${faction(scenario, outcome.factionId)}: ${unit(scenario, outcome)} lost its airfield in ${territory(scenario, outcome.from)} and was destroyed on the ground.`;
  }
}

function describeRaid(scenario: Scenario, outcome: Extract<AirTurnOutcome, { readonly kind: "raid" }>): string {
  const target = scenario.index.subTerritories.get(outcome.subTerritoryId)?.name ?? outcome.subTerritoryId;
  const who = `${faction(scenario, outcome.order.factionId)}: ${unit(scenario, outcome.order)} raided ${target} (roll ${String(outcome.roll)})`;
  switch (outcome.result) {
    case "air-eliminated":
      return `${who} and was shot down.`;
    case "nothing-hit":
      return `${who} and hit nothing.`;
    case "income-cut":
      return `${who}; its income is cut next turn.`;
    case "building-hit": {
      if (outcome.buildingId !== undefined) return `${who} and hit its ${scenario.index.buildings.get(outcome.buildingId)?.name ?? outcome.buildingId}.`;
      if (outcome.developmentId !== undefined) return `${who}; its ${scenario.index.development.get(outcome.developmentId)?.name ?? outcome.developmentId} lost a level.`;
      return `${who} and hit nothing worth hitting.`;
    }
  }
}
