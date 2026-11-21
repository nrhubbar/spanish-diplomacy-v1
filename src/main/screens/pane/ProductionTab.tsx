import type { JSX } from "react";
import { amountOf } from "../../engine/economy/resources";
import type { ResourceId } from "../../engine/types";
import { glyphs } from "../../presentation/glyphs";
import { signedResourceAmount } from "../../presentation/economy";
import { productionOf, yieldSources } from "../../presentation/ledger";
import { factionName } from "../../presentation/text";
import { previewState } from "../../state/planning";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * U9 (note 15): where the territory's Funds and Manpower come from, sub-territory by
 * sub-territory, and what it pays: the sum to the faction holding it whole, nothing while
 * contested. Development is on the board, so this is public.
 */
export function ProductionTab({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element {
  const production = productionOf(scenario, previewState(scenario, session), territoryId);
  const name = scenario.index.territories.get(territoryId)?.name ?? "";
  const cell = (value: number, resourceId: ResourceId): string => (value === 0 ? glyphs.minus : signedResourceAmount(scenario, resourceId, value));
  return (
    <div className="production-tab">
      <div className="build-tab-head">
        <h4>Production</h4>
        <span className="pane-hint">{`What ${name} pays a turn`}</span>
      </div>
      <table className="production-table">
        <thead>
          <tr>
            <th scope="col">Sub-territory</th>
            {scenario.resources.map((resource) => <th key={resource.id} scope="col">{resource.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {production.rows.map((row) => (
            <tr data-raided={row.raided} key={row.subTerritoryId}>
              <th scope="row">
                <span className="production-name">{`${row.capital ? `${glyphs.star} ` : ""}${row.name}`}</span>
                <span className="production-levels">
                  {row.levels}
                  {row.holder === session.factionId ? "" : ` ${glyphs.dot} held by ${factionName(scenario, row.holder)}`}
                  {row.raided ? ` ${glyphs.dot} raided this turn` : ""}
                </span>
              </th>
              {scenario.resources.map((resource) => <td key={resource.id}>{cell(amountOf(row.yield, resource.id), resource.id)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr data-contested={production.contested}>
            <th scope="row">{production.contested ? "Contested: pays nothing" : "Held whole: pays"}</th>
            {scenario.resources.map((resource) => {
              const total = amountOf(production.total, resource.id);
              return <td key={resource.id}>{production.contested ? <s>{cell(total, resource.id)}</s> : cell(total, resource.id)}</td>;
            })}
          </tr>
        </tfoot>
      </table>
      <p className="pane-hint">
        {[...yieldSources(scenario), "A raid on a sub-territory cuts its yield for a turn."].join(" ")}
      </p>
    </div>
  );
}
