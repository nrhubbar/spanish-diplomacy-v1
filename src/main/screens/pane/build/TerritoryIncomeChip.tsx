import type { JSX } from "react";
import type { FactionId, GameState, Scenario, TerritoryId } from "../../../engine/types";
import { territoryIncome } from "../../../presentation/holdings";
import { EconomyIcon } from "../../../components/economy/EconomyIcon";

/**
 * $2: what a territory pays a turn, as a chip for the pane's meta row: its development yield to
 * the faction holding it whole, or "No income" while it is contested (M12). Development is on the board,
 * so this is public. Meant for `m3r1-weather-timer`'s meta-row slot beside the weather pill.
 */
export function TerritoryIncomeChip({ scenario, state, territoryId, viewer }: { readonly scenario: Scenario; readonly state: GameState; readonly territoryId: TerritoryId; readonly viewer: FactionId }): JSX.Element | null {
  const income = territoryIncome(scenario, state, territoryId, viewer);
  if (income === undefined) return null;
  if (income.paused) return <span className="income-chip income-chip-none"><EconomyIcon name="coin" />{income.text}</span>;
  return (
    <span className={`income-chip${income.own ? " income-chip-own" : ""}`}>
      <EconomyIcon name="coin" />
      {income.text}
    </span>
  );
}
