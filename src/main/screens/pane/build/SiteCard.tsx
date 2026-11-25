import { type JSX, useId } from "react";
import type { BuildOrder, FactionId, GameState, Scenario, SubTerritoryId } from "../../../engine/types";
import { glyphs } from "../../../presentation/glyphs";
import { siteCard } from "../../../presentation/siteCard";
import { buildingIcon, developmentIcon, EconomyIcon } from "../../../components/economy/EconomyIcon";
import { QueueList } from "../../queues/QueueList";
import { SiteIcon } from "../../../components/SiteIcons";
import { BuildOptions } from "./BuildOptions";

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
  const card = siteCard(scenario, state, subTerritoryId, viewer, planned);
  if (card === undefined) return null;
  const { capital, contested, entries, holder, own, port, queueNote, rail, summary } = card;

  return (
    <article aria-label={card.name} className={`site-card${own ? " site-card-own" : ""}`} data-expanded={expanded}>
      <h4 className="site-card-head">
        <button aria-controls={bodyId} aria-expanded={expanded} className="site-card-toggle" onClick={onToggle} type="button">
          <span aria-hidden="true" className="site-card-caret">{expanded ? glyphs.caretDown : glyphs.caretRight}</span>
          {capital ? <EconomyIcon className="site-capital" name="star" /> : null}
          <span className="site-name">{card.name}</span>
          {capital ? <span className="visually-hidden"> (capital)</span> : null}
          <span className="site-yield">{card.yieldText}</span>
        </button>
      </h4>
      {expanded || summary === undefined ? null : (
        <p className="site-summary">
          <span>{summary.name}</span>
          <span className="queue-status">{summary.status}</span>
        </p>
      )}
      {holder === undefined ? null : <p className="site-holder">{holder}</p>}
      {expanded ? (
        <div className="site-card-body" id={bodyId}>
          <ul aria-label="About this sub-territory" className="site-chips">
            <li className="site-chip"><SiteIcon kind={card.terrain.kind} />{card.terrain.name}</li>
            {card.portLevel > 0 ? <li className="site-chip"><SiteIcon kind="port" />{`Port ${String(card.portLevel)}`}</li> : null}
            {card.railLevel > 0 ? <li className="site-chip"><SiteIcon kind="rail" />{`Rail ${String(card.railLevel)}`}</li> : null}
            {contested ? <li className="site-chip" data-tone="contested"><SiteIcon kind="contested" />Contested ground</li> : null}
          </ul>
          {card.cities.length === 0 ? null : <p className="site-cities">{`Cities: ${card.cities.join(", ")}`}</p>}
          <ul aria-label="Development and improvements" className="site-levels">
            {card.tracks.map(({ level, max, track }) => (
              <li key={track.id}>
                <EconomyIcon name={developmentIcon(scenario, track)} />
                <span>{track.name}</span>
                <Pips label={track.name} level={level} max={max} />
              </li>
            ))}
            {rail === undefined ? null : <li><EconomyIcon name="rail" /><span>Rail</span><Pips label="Rail" level={rail.level} max={rail.max} /></li>}
            {port === undefined ? null : <li><EconomyIcon name="anchor" /><span>Port</span><Pips label="Port" level={port.level} max={port.max} /></li>}
          </ul>
          {card.buildings.length === 0 ? null : (
            <ul aria-label="Buildings" className="site-buildings">
              {card.buildings.map((building) => <li key={building.id}><EconomyIcon name={buildingIcon(building)} />{building.name}</li>)}
            </ul>
          )}
          {entries.length === 0 ? null : <QueueList entries={entries} label="Build queue" paused={contested} scenario={scenario} />}
          {queueNote === undefined ? null : (
            <p className="site-hidden"><EconomyIcon name="flag" />{queueNote}</p>
          )}
          <BuildOptions scenario={scenario} state={state} subTerritoryId={subTerritoryId} viewer={viewer} />
        </div>
      ) : null}
    </article>
  );
}
