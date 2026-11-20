import type { JSX } from "react";
import { EconomyIcon } from "../../components/economy/EconomyIcon";
import { sumResources } from "../../engine/economy/resources";
import type { FactionId, IncomeOutcome, Resources, Scenario, TurnOutcome, TurnResolutionResult } from "../../engine/types";
import { amountText } from "../../presentation/economy";
import { describeSystemOutcome } from "../../presentation/systemText";

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

/**
 * D25, M10: the viewer's treasury for the turn: income from the territories held whole (after
 * raid cuts), then what this turn's orders spent. Private, so it renders only for a report with
 * one viewer, and only from the viewer's own outcomes.
 */
export function Treasury({ result, scenario, viewer }: { readonly result: TurnResolutionResult; readonly scenario: Scenario; readonly viewer: FactionId | undefined }): JSX.Element | null {
  if (viewer === undefined || scenario.rules.economy === "none") return null;
  const income = result.outcomes.find((outcome): outcome is IncomeOutcome => outcome.kind === "income" && outcome.factionId === viewer);
  const spent = amountText(scenario, spentBy(result.outcomes, viewer), " and ");
  if (income === undefined && spent === "nothing") return null;
  return (
    <section aria-labelledby="treasury-title" className="pane-section treasury">
      <h3 id="treasury-title">Treasury</h3>
      <ul className="treasury-lines">
        {income === undefined ? null : (
          <li>
            <EconomyIcon name="coin" />
            <span>{describeSystemOutcome(income, { scenario, state: result.finalState, viewer })}</span>
          </li>
        )}
        {spent === "nothing" ? null : (
          <li>
            <EconomyIcon name="crate" />
            <span>{`Spent this turn: ${spent}.`}</span>
          </li>
        )}
      </ul>
    </section>
  );
}
