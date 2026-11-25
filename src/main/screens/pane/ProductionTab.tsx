import type { JSX } from "react";
import { glyphs } from "../../presentation/glyphs";
import { yieldCell } from "../../presentation/economy";
import { productionOf, yieldSources } from "../../presentation/ledger";
import { factionName, territoryName } from "../../presentation/text";
import { previewState } from "../../state/planning";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * U9 (note 15): where the territory's Funds and Manpower come from, sub-territory by
 * sub-territory, and what it pays: the sum to the faction holding it whole, nothing while
 * contested. Development is on the board, so this is public.
 */
export function ProductionTab({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element {
  const production = productionOf(scenario, previewState(scenario, session), territoryId);
  const name = territoryName(scenario, territoryId);
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
              {scenario.resources.map((resource) => <td key={resource.id}>{yieldCell(scenario, row.yield, resource.id)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr data-contested={production.contested}>
            <th scope="row">{production.contested ? "Contested: pays nothing" : "Held whole: pays"}</th>
            {scenario.resources.map((resource) => {
              const total = yieldCell(scenario, production.total, resource.id);
              return <td key={resource.id}>{production.contested ? <s>{total}</s> : total}</td>;
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
