import { sumResources } from "../engine/economy/resources";
import type { FactionId, Resources, TurnOutcome } from "../engine/types";

/** What the viewer's own orders paid this turn: builds queued, recruits started and replenishments. */
export function spentBy(outcomes: readonly TurnOutcome[], viewer: FactionId): Resources {
  return sumResources(...outcomes.flatMap((outcome): Resources[] => {
    switch (outcome.kind) {
      case "build-queued":
        return outcome.order.factionId === viewer ? [outcome.paid] : [];
      case "training-started":
        return outcome.order.factionId === viewer ? [outcome.paid] : [];
      case "replenish-applied":
        return outcome.order.factionId === viewer ? [outcome.paid] : [];
      default:
        return [];
    }
  }));
}
