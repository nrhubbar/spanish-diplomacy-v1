import type { JSX } from "react";
import { requireTerritory } from "../../engine/lookup";
import { isContested } from "../../engine/partition/holders";
import type { FactionId, GameState, Scenario, SubTerritoryId, TerrainKind } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { factionName } from "../../presentation/text";
import { focusSubTerritory } from "../../state/gameSlice";
import { SiteIcon } from "./SiteIcons";
import { SubTerritoryBuild } from "./SubTerritoryBuild";

const terrainNames: Readonly<Record<TerrainKind, string>> = { mountain: "Mountains", open: "Open ground", swamp: "Marsh" };

export interface SubTerritoryFocusProps {
  readonly factionId: FactionId;
  readonly scenario: Scenario;
  readonly state: GameState;
  readonly subTerritoryId: SubTerritoryId;
}

/**
 * X3 (Q-UX-04): the pane focused on one sub-territory: a link back to its territory, its name
 * (with the capital star, W3), who holds it, and a summary of its terrain, port, rail and cities
 * (P8, M3, M5). The card and build list below belong to `m3r1-economy-builds` (`SubTerritoryBuild`).
 */
export function SubTerritoryFocus({ factionId, scenario, state, subTerritoryId }: SubTerritoryFocusProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  if (sub === undefined) return null;
  const territory = requireTerritory(scenario, sub.territoryId);
  const site = state.subTerritories[sub.id];
  const holder = site?.holder ?? sub.startHolder;
  const capital = territory.capitalSubTerritoryId === sub.id;
  const contested = isContested(scenario, state, territory.id);
  const cities = sub.cityIds.flatMap((id) => scenario.index.cities.get(id)?.name ?? []);
  const port = site?.port ?? sub.port;
  const rail = site?.rail ?? sub.rail;

  return (
    <div className="sub-territory-focus" data-sub-territory-id={sub.id}>
      <button aria-label={`Back to ${territory.name}`} className="text-button sub-territory-back" onClick={() => dispatch(focusSubTerritory(undefined))} type="button">
        {`${glyphs.back} ${territory.name}`}
      </button>
      <h3>
        {capital ? <span aria-hidden="true" className="capital-star">{`${glyphs.star} `}</span> : null}
        {sub.name}
      </h3>
      <p className="pane-meta">
        {`${capital ? "Capital sub-territory" : "Sub-territory"} of ${territory.name} ${glyphs.dot} held by ${factionName(scenario, holder)}`}
      </p>
      <ul aria-label="About this sub-territory" className="site-chips">
        <li className="site-chip"><SiteIcon kind={sub.terrain} />{terrainNames[sub.terrain]}</li>
        {port > 0 ? <li className="site-chip"><SiteIcon kind="port" />{`Coast ${glyphs.dot} port ${String(port)}`}</li> : null}
        {rail > 0 ? <li className="site-chip"><SiteIcon kind="rail" />{`Rail ${String(rail)}`}</li> : null}
        {contested ? <li className="site-chip" data-tone="contested"><SiteIcon kind="contested" />Contested ground</li> : null}
      </ul>
      {cities.length === 0 ? null : <p className="pane-meta">{`Cities: ${cities.join(", ")}`}</p>}
      {contested ? (
        <p className="pane-note" data-tone="contested">
          {`${territory.name} is contested: it pays no income, and nothing is recruited or built here until one side holds all of it.`}
        </p>
      ) : null}
      <SubTerritoryBuild factionId={factionId} scenario={scenario} state={state} subTerritoryId={sub.id} />
    </div>
  );
}
