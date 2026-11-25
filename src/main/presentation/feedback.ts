import { requireFaction } from "../engine/lookup";
import type { StandingOrder } from "../engine/orders";
import type { FactionId, HeldBackCause, Refusal, Scenario, TerritoryId, UnitId } from "../engine/types";
import type { MusterKind } from "./muster";
import { heldBackRefusal } from "./musterFit";
import { unitsNamed } from "./recruitment";
import { refusalsText } from "./refusals";
import { type ReplenishSkip, skippedText } from "./replenish";
import { listNames, territoryName } from "./text";

/**
 * What the player is told about a change they made, as data: a code and the ids and numbers it
 * is about. The store keeps these, and `feedbackText` writes the words.
 */
export type Feedback =
  /** The rules refuse it. */
  | { readonly code: "refused"; readonly refusals: readonly Refusal[] }
  /** N3: an army of these moves would be held back at the reveal. */
  | { readonly cause: HeldBackCause; readonly code: "held-back"; readonly from: TerritoryId; readonly to: TerritoryId }
  | { readonly code: "disband-planned"; readonly unitIds: readonly UnitId[] }
  | { readonly aircraft: number; readonly code: "muster-ordered"; readonly kind: MusterKind; readonly territoryId: TerritoryId; readonly units: number }
  | { readonly code: "not-connected"; readonly from: TerritoryId; readonly to: TerritoryId }
  /** N6: the target is further than the aircraft flies, in territories. */
  | { readonly code: "out-of-range"; readonly range: number }
  /** B12: a faction with no player this device can give it. */
  | { readonly code: "player-needed"; readonly factionId: FactionId }
  | { readonly code: "recruit-slots"; readonly slots: number }
  | { readonly code: "replenish-none"; readonly skipped: readonly ReplenishSkip[] }
  | { readonly code: "replenish-planned"; readonly skipped: readonly ReplenishSkip[]; readonly units: number }
  | { readonly code: "stay-planned"; readonly order: StandingOrder | "attack" | "hold"; readonly units: number }
  /** N3: Ground Support cancelled with the attack it was planned for, after what the change itself had to say. */
  | { readonly before?: Feedback; readonly code: "support-cancelled"; readonly territoryIds: readonly TerritoryId[] }
  | { readonly code: PlainCode };

/** Feedback that says all there is to say with its code alone. */
type PlainCode =
  | "build-queued"
  | "cannot-entrench"
  | "cannot-move-together"
  | "cannot-rest"
  | "every-unit-moving"
  | "move-not-chosen"
  | "no-mission-target"
  | "no-territory-selected"
  | "no-units-here"
  | "no-units-selected"
  | "no-way-out"
  | "not-your-unit"
  | "nothing-to-hit"
  | "replenish-unpaid"
  | "same-destination"
  | "unreachable-together"
  | "withdraw-target";

/** One or more refusals of the engine's, as feedback. */
export function refusedFeedback(...refusals: readonly Refusal[]): Feedback {
  return { code: "refused", refusals };
}

/** The feedback in words. */
export function feedbackText(scenario: Scenario, feedback: Feedback): string {
  switch (feedback.code) {
    case "refused":
      return refusalsText(scenario, feedback.refusals);
    case "held-back":
      return heldBackRefusal(scenario, feedback.cause, feedback.from, feedback.to);
    case "disband-planned":
      return `${unitsNamed(scenario, feedback.unitIds)} will disband at the end of the turn.`;
    case "muster-ordered": {
      const { aircraft, kind, territoryId, units } = feedback;
      const what = [...(units === 0 ? [] : [unitCount(units)]), ...(aircraft === 0 ? [] : [`${String(aircraft)} aircraft`])].join(" and ");
      return `${what === "" ? "No units are" : what} ordered to ${kind} ${territoryName(scenario, territoryId)}.`;
    }
    case "not-connected":
      return `${territoryName(scenario, feedback.to)} is not connected to ${territoryName(scenario, feedback.from)}. Choose a highlighted territory.`;
    case "out-of-range":
      return `Out of range: it flies up to ${feedback.range === 1 ? "1 territory" : `${String(feedback.range)} territories`} from its airfield.`;
    case "player-needed":
      return `Choose a local or computer player for ${requireFaction(scenario, feedback.factionId).name}. Online play is coming later.`;
    case "recruit-slots":
      return `At most ${String(feedback.slots)} new units a turn can be recruited here.`;
    case "replenish-none":
      return `No selected unit can replenish. ${skippedText(scenario, feedback.skipped)}`;
    case "replenish-planned": {
      const skips = skippedText(scenario, feedback.skipped);
      return `${unitCount(feedback.units)} will replenish.${skips === "" ? "" : ` ${skips}`}`;
    }
    case "stay-planned":
      return `${unitCount(feedback.units)} will ${feedback.order === "attack" ? "attack where they stand" : feedback.order}.`;
    case "support-cancelled": {
      const note = `Ground Support over ${listNames(feedback.territoryIds.map((id) => territoryName(scenario, id)))} is cancelled too: none of your units go there now.`;
      return feedback.before === undefined ? note : `${feedbackText(scenario, feedback.before)} ${note}`;
    }
    default:
      return plainText[feedback.code];
  }
}

const plainText: Readonly<Record<PlainCode, string>> = {
  "build-queued": "Queued. It is paid when orders are revealed.",
  "cannot-entrench": "Demoralized units cannot entrench. They rest instead.",
  "cannot-move-together": "These units cannot move anywhere together this turn.",
  "cannot-rest": "Only demoralized units rest.",
  "every-unit-moving": "Every unit here is moving. Select one to change its order.",
  "move-not-chosen": "Select units and choose Move first.",
  "no-mission-target": "Nothing in range for this mission.",
  "no-territory-selected": "Select a territory first.",
  "no-units-here": "None of your units are in this territory.",
  "no-units-selected": "Select at least one unit first.",
  "no-way-out": "These units have no way out through your own sub-territories.",
  "not-your-unit": "Select one of your own units.",
  "nothing-to-hit": "Nothing to hit there.",
  "replenish-unpaid": "Not enough Funds or Manpower left to replenish.",
  "same-destination": "Choose a different territory as the destination.",
  "unreachable-together": "These units cannot move there together. Choose a highlighted territory.",
  "withdraw-target": "Withdraw to a highlighted territory: one you hold whole, reached through your own sub-territories."
};

function unitCount(count: number): string {
  return count === 1 ? "1 unit" : `${String(count)} units`;
}
