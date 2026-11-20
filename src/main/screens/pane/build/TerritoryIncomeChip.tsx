import type { JSX } from "react";
import { holdersIn, subTerritoriesOf } from "../../../engine/economy/holdings";
import { subTerritoryYield } from "../../../engine/economy/income";
import { addResources } from "../../../engine/economy/resources";
import type { FactionId, GameState, Scenario, TerritoryId } from "../../../engine/types";
import { signedAmountText } from "../../../presentation/economy";
import { factionName } from "../../../presentation/text";
import { EconomyIcon } from "../../../components/economy/EconomyIcon";

/**
 * $2: what a territory pays a turn, as a chip for the pane's meta row: its development yield to
 * the faction holding it whole, or nothing while it is contested. Development is on the board,
 * so this is public. Meant for `m3r1-weather-timer`'s meta-row slot beside the weather pill.
 */
export function TerritoryIncomeChip({ scenario, state, territoryId, viewer }: { readonly scenario: Scenario; readonly state: GameState; readonly territoryId: TerritoryId; readonly viewer: FactionId }): JSX.Element | null {
  if (scenario.rules.economy === "none") return null;
  const holders = holdersIn(scenario, state.subTerritories, territoryId);
  if (holders.length === 0) return null;
  if (holders.length > 1) return <span className="income-chip income-chip-none"><EconomyIcon name="coin" />Contested: pays nobody</span>;
  const total = addResources(...subTerritoriesOf(scenario, territoryId).flatMap((sub) => {
    const site = state.subTerritories[sub.id];
    return site === undefined ? [] : [subTerritoryYield(scenario, site)];
  }));
  const amount = signedAmountText(scenario, total);
  const holder = holders[0];
  const text = amount === "nothing" ? "Pays nothing" : `Pays ${amount} a turn`;
  return (
    <span className={`income-chip${holder === viewer ? " income-chip-own" : ""}`}>
      <EconomyIcon name="coin" />
      {holder === viewer || holder === undefined ? text : `${text} to ${factionName(scenario, holder)}`}
    </span>
  );
}
