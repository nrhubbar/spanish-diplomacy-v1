import type { JSX } from "react";
import { TerritoryWeather } from "../../components/weather/TerritoryWeather";
import { citiesIn } from "../../engine/lookup";
import type { Scenario } from "../../engine/types";
import { controlDescription, territoryName } from "../../presentation/text";
import { ContestedChip } from "./ContestedChip";
import { IncomeChip } from "./IncomeChip";
import { RecruitsAtChip } from "./RecruitsAtChip";
import type { TerritoryTabProps } from "./TerritoryTabs";

/** Whether the scenario plays any system the meta row shows (weather, economy, recruitment). */
export function hasTerritoryMeta(scenario: Scenario): boolean {
  const { rules } = scenario;
  return rules.weather !== "none" || rules.economy !== "none" || rules.recruitment !== "none";
}

/**
 * The selected territory's heading, shown above the pane's tabs so it stays on every tab
 * (approved capture `ux-world`): the name, who holds it, its cities, then the meta row.
 */
export function TerritoryHeading(props: TerritoryTabProps): JSX.Element {
  const { scenario, session, territoryId } = props;
  const cities = citiesIn(scenario, territoryId);
  return (
    <>
      <h3>{territoryName(scenario, territoryId)}</h3>
      <p className="pane-meta">{controlDescription(scenario, session.game.state.control[territoryId])}</p>
      {cities.length === 0 ? null : <p className="pane-meta">{`Cities: ${cities.map((city) => city.name).join(", ")}`}</p>}
      {hasTerritoryMeta(scenario) ? <TerritoryMetaRow {...props} /> : null}
    </>
  );
}

/**
 * The meta row's chips, left to right. Each chip is its own component, owned by its slice, and
 * renders nothing when it has nothing to say:
 * - the weather pill and next turn's forecast (T3, `m3r1-weather-timer`);
 * - the income chip, "Pays +11 Funds · +4k men a turn" (X1, `m3r1-economy-builds`, `IncomeChip.tsx`);
 * - contested ground, "Contested · you hold 3 of 8" (W6, `m3r1-sub-territories`, `ContestedChip.tsx`);
 * - the recruiting chip, "Recruits at Barcelona" (R2, `m3r1-recruit-replenish`, `RecruitsAtChip.tsx`).
 */
function TerritoryMetaRow(props: TerritoryTabProps): JSX.Element {
  const { scenario, session, territoryId } = props;
  return (
    <div className="territory-meta">
      <TerritoryWeather scenario={scenario} state={session.game.state} territoryId={territoryId} />
      <ContestedChip {...props} />
      <IncomeChip {...props} />
      <RecruitsAtChip {...props} />
    </div>
  );
}
