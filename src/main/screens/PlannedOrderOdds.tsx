import { type JSX, useMemo } from "react";
import { isMoveOrder, type Scenario, type TerritoryId } from "../engine/types";
import { type DestinationEstimate, oddsSummary, plannedEstimates } from "../presentation/odds";
import type { PlanningSession } from "../state/planning";
import { OddsInfo } from "./OddsInfo";

interface PlannedOddsProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
}

function usePlannedEstimates({ scenario, session }: PlannedOddsProps): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const { draft, factionId, game } = session;
  return useMemo(() => plannedEstimates(scenario, game.state, factionId, draft.orders.filter(isMoveOrder)), [draft.orders, factionId, game.state, scenario]);
}

/**
 * A1 (B.2): on a planned attack, the combined odds of every army ordered to the same
 * destination. Moves that meet no battle show nothing: they have no odds.
 */
export function PlannedOrderOdds({ territoryId, ...props }: PlannedOddsProps & { readonly territoryId: TerritoryId }): JSX.Element | null {
  const estimate = usePlannedEstimates(props).get(territoryId);
  if (estimate?.kind !== "battle") return null;
  const summary = oddsSummary(estimate);
  return (
    <span className="odds-chip planned-odds" data-tone={summary.tone}>
      <span aria-hidden="true">{summary.label}</span>
      <span className="visually-hidden">{summary.sentence}</span>
    </span>
  );
}

/** A2: the "i" for the planned attacks' odds, shown only when a planned move meets a battle. */
export function PlannedOddsInfo(props: PlannedOddsProps): JSX.Element | null {
  const estimates = usePlannedEstimates(props);
  if (![...estimates.values()].some((estimate) => estimate.kind === "battle")) return null;
  return (
    <OddsInfo label="About the planned odds">
      <p className="pane-meta">Odds count every unit ordered to the same place.</p>
    </OddsInfo>
  );
}
