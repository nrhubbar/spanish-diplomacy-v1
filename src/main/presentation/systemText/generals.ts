import type { GeneralId, GeneralsTurnOutcome, Scenario, SystemOutcome } from "../../engine/types";

/** Short report lines for the generals outcomes, for places without the scenario. */
export const generalsLines: Readonly<Record<GeneralsTurnOutcome["kind"], string>> = {
  "general-died": "A general was killed.",
  "general-sacked": "A general was dismissed.",
  "replacement-arrived": "A new general took command.",
  "replacement-due": "A new general is on his way.",
  "general-moved": "A general moved with his army."
};

const generalKinds = new Set<string>(Object.keys(generalsLines));

export function isGeneralsOutcome(outcome: SystemOutcome): outcome is GeneralsTurnOutcome {
  return generalKinds.has(outcome.kind);
}

function general(scenario: Scenario, id: GeneralId): string {
  return scenario.index.generals.get(id)?.name ?? id;
}

/** C5, U5 (D7): a general's rally, a morale outcome that only generals cause. */
export function describeRally(scenario: Scenario, outcome: Extract<SystemOutcome, { readonly kind: "rallied" }>): string {
  const count = outcome.unitIds.length;
  return `${general(scenario, outcome.generalId)} rallied ${String(count)} demoralized ${count === 1 ? "unit" : "units"} in ${scenario.index.territories.get(outcome.territoryId)?.name ?? outcome.territoryId}.`;
}

/** U5, D7: one full report sentence per generals outcome. */
export function describeGeneralsOutcome(scenario: Scenario, outcome: GeneralsTurnOutcome): string {
  switch (outcome.kind) {
    case "general-died":
      return `${general(scenario, outcome.generalId)} was killed when his army was broken in ${scenario.index.territories.get(outcome.territoryId)?.name ?? outcome.territoryId}.`;
    case "general-sacked":
      return `${general(scenario, outcome.generalId)} was relieved of command.`;
    case "replacement-due":
      return `${general(scenario, outcome.generalId)} has been called to command and arrives next turn.`;
    case "general-moved": {
      const name = scenario.index.units.get(outcome.order.unitId)?.name ?? general(scenario, outcome.order.unitId.replace(/^general-/, "") as GeneralId);
      const to = scenario.index.territories.get(outcome.order.to)?.name ?? outcome.order.to;
      return outcome.arrived ? `${name} went with his army to ${to}.` : `${name} stayed behind: his army did not reach ${to}.`;
    }
    case "replacement-arrived":
      return `${general(scenario, outcome.generalId)} took command in ${scenario.index.territories.get(outcome.territoryId)?.name ?? outcome.territoryId}.`;
  }
}
