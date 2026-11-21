import { type JSX, useId } from "react";
import { isCapital } from "../../../engine/economy/catalogue";
import { subTerritoryYield } from "../../../engine/economy/income";
import { isContested } from "../../../engine/partition/holders";
import type { BuildOrder, FactionId, GameState, Scenario, SubTerritoryId, TerrainKind } from "../../../engine/types";
import { isRevealed } from "../../../engine/visibility";
import { signedAmountText } from "../../../presentation/economy";
import { glyphs } from "../../../presentation/glyphs";
import { buildEntries } from "../../../presentation/queues";
import { factionName } from "../../../presentation/text";
import { buildingIcon, developmentIcon, EconomyIcon } from "../../../components/economy/EconomyIcon";
import { QueueList } from "../../queues/QueueList";
import { SiteIcon } from "../SiteIcons";
import { BuildOptions } from "./BuildOptions";

const terrainNames: Readonly<Record<TerrainKind, string>> = { mountain: "Mountains", open: "Open ground", swamp: "Marsh" };

interface SiteCardProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** This turn's planned Build orders with their index in the plan; only this sub-territory's. */
  readonly planned: readonly { readonly index: number; readonly order: BuildOrder }[];
  readonly scenario: Scenario;
  /** The viewer's state with the planned orders previewed as queued (`previewState`). */
  readonly state: GameState;
  readonly subTerritoryId: SubTerritoryId;
  readonly viewer: FactionId;
}

/** Level pips: filled squares up to the level, hollow up to the maximum. */
export function Pips({ label, level, max }: { readonly label: string; readonly level: number; readonly max: number }): JSX.Element {
  return (
    <span aria-label={`${label} level ${String(level)} of ${String(max)}`} className="pips" role="img">
      {Array.from({ length: max }, (_, at) => <span className={at < level ? "pip pip-full" : "pip"} key={at} />)}
    </span>
  );
}

/**
 * U9 (note 15), X7: one sub-territory in the Buildings tab, as a card that opens. Closed, it
 * shows its name, yield and the queue's head; open, its terrain, levels, buildings, the whole
 * queue (the shared queue component) and, for the viewer's own, the projects to add. Other
 * factions' queues are hidden ($6) unless recon shows them.
 */
export function SiteCard({ expanded, onToggle, planned, scenario, state, subTerritoryId, viewer }: SiteCardProps): JSX.Element | null {
  const bodyId = useId();
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  const site = state.subTerritories[subTerritoryId];
  if (sub === undefined || site === undefined) return null;
  const own = site.holder === viewer;
  const capital = isCapital(scenario, sub);
  const contested = isContested(scenario, state, sub.territoryId);
  const entries = buildEntries(scenario, site, planned, contested);
  const head = entries[0];
  const tracks = scenario.development.filter((track) => !track.cityOnly || sub.cityIds.length > 0);
  const improvements = scenario.improvements;
  const hidden = !own && entries.length === 0;

  return (
    <article aria-label={sub.name} className={`site-card${own ? " site-card-own" : ""}`} data-expanded={expanded}>
      <h4 className="site-card-head">
        <button aria-controls={bodyId} aria-expanded={expanded} className="site-card-toggle" onClick={onToggle} type="button">
          <span aria-hidden="true" className="site-card-caret">{expanded ? glyphs.caretDown : glyphs.caretRight}</span>
          {capital ? <EconomyIcon className="site-capital" name="star" /> : null}
          <span className="site-name">{sub.name}</span>
          {capital ? <span className="visually-hidden"> (capital)</span> : null}
          <span className="site-yield">{yieldText(signedAmountText(scenario, subTerritoryYield(scenario, site)))}</span>
        </button>
      </h4>
      {expanded || head === undefined ? null : (
        <p className="site-summary">
          <span>{head.name}</span>
          <span className="queue-status">{`${head.status}${entries.length > 1 ? ` ${glyphs.dot} +${String(entries.length - 1)} queued` : ""}`}</span>
        </p>
      )}
      {own ? null : <p className="site-holder">{`Held by ${factionName(scenario, site.holder)}`}</p>}
      {expanded ? (
        <div className="site-card-body" id={bodyId}>
          <ul aria-label="About this sub-territory" className="site-chips">
            <li className="site-chip"><SiteIcon kind={sub.terrain} />{terrainNames[sub.terrain]}</li>
            {site.port > 0 ? <li className="site-chip"><SiteIcon kind="port" />{`Port ${String(site.port)}`}</li> : null}
            {site.rail > 0 ? <li className="site-chip"><SiteIcon kind="rail" />{`Rail ${String(site.rail)}`}</li> : null}
            {contested ? <li className="site-chip" data-tone="contested"><SiteIcon kind="contested" />Contested ground</li> : null}
          </ul>
          {sub.cityIds.length === 0 ? null : <p className="site-cities">{`Cities: ${sub.cityIds.map((id) => scenario.index.cities.get(id)?.name ?? id).join(", ")}`}</p>}
          <ul aria-label="Development and improvements" className="site-levels">
            {tracks.map((track) => (
              <li key={track.id}>
                <EconomyIcon name={developmentIcon(scenario, track)} />
                <span>{track.name}</span>
                <Pips label={track.name} level={site.development[track.id] ?? 0} max={track.maxLevel} />
              </li>
            ))}
            {improvements === undefined ? null : (
              <>
                <li><EconomyIcon name="rail" /><span>Rail</span><Pips label="Rail" level={site.rail} max={improvements.rail.maxLevel} /></li>
                {site.port > 0 || sub.port > 0 ? <li><EconomyIcon name="anchor" /><span>Port</span><Pips label="Port" level={site.port} max={improvements.port.maxLevel} /></li> : null}
              </>
            )}
          </ul>
          {site.buildings.length === 0 ? null : (
            <ul aria-label="Buildings" className="site-buildings">
              {site.buildings.map((id) => {
                const building = scenario.index.buildings.get(id);
                return building === undefined ? null : <li key={id}><EconomyIcon name={buildingIcon(building)} />{building.name}</li>;
              })}
            </ul>
          )}
          {entries.length === 0 ? null : <QueueList entries={entries} label="Build queue" paused={contested} scenario={scenario} />}
          {hidden ? (
            // U4: the viewer's recon shows this territory's queues, so an empty one reads empty.
            <p className="site-hidden"><EconomyIcon name="flag" />{isRevealed(state, viewer, sub.territoryId) ? "Queue empty (recon)" : "Queue hidden"}</p>
          ) : null}
          <BuildOptions scenario={scenario} state={state} subTerritoryId={subTerritoryId} viewer={viewer} />
        </div>
      ) : null}
    </article>
  );
}

const yieldText = (text: string): string => (text === "nothing" ? "no yield" : text);
