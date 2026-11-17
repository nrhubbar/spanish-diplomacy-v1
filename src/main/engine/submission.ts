import type {
  FactionId,
  GameState,
  PlayerSubmission,
  ScenarioDefinition,
  ValidationResult
} from "./types";
import { validateMoveOrder } from "./validation";

export function validateSubmission(
  scenario: ScenarioDefinition,
  state: GameState,
  factionId: FactionId,
  submission: PlayerSubmission
): ValidationResult {
  if (submission.factionId !== factionId) {
    return { ok: false, reason: "Submission belongs to another faction." };
  }

  const seen = new Set<string>();

  for (const order of submission.orders) {
    if (seen.has(order.unitId)) {
      return { ok: false, reason: "A unit can receive only one order per turn." };
    }

    seen.add(order.unitId);
    const validation = validateMoveOrder(scenario, state, order);

    if (!validation.ok) {
      return validation;
    }
  }

  return { ok: true };
}
