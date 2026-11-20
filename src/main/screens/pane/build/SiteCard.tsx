import type { JSX } from "react";
import { currentLevel, isCapital, projectCost, sameProject } from "../../../engine/economy/catalogue";
import { subTerritoryYield } from "../../../engine/economy/income";
import type { BuildOrder, FactionId, GameState, Scenario, SubTerritoryId, SubTerritoryState } from "../../../engine/types";
import { isRevealed } from "../../../engine/visibility";
import { useAppDispatch } from "../../../hooks";
import { amountText, projectName, signedAmountText, turnsLeftText } from "../../../presentation/economy";
import { factionName } from "../../../presentation/text";
import { buildingIcon, developmentIcon, EconomyIcon, projectIcon } from "../../../components/economy/EconomyIcon";
import { cancelBuildOrder, focusSubTerritory } from "../../../state/gameSlice";

interface SiteCardProps {
  /** This turn's planned Build orders with their index in the plan; only this sub-territory's. */
  readonly planned: readonly { readonly index: number; readonly order: BuildOrder }[];
  readonly scenario: Scenario;
  /** The viewer's state with the planned orders previewed as queued (`previewState`). */
  readonly state: GameState;
  readonly subTerritoryId: SubTerritoryId;
  readonly viewer: FactionId;
  /** Offer the Build button that focuses the pane here (the Build tab), or not (the focus view). */
  readonly withBuildButton: boolean;
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
 * X7: one sub-territory: capital star, yield, development and improvement pips, buildings, and
 * the build queue with progress bars. Other factions' queues are hidden ($6) unless recon shows
 * them.
 */
export function SiteCard({ planned, scenario, state, subTerritoryId, viewer, withBuildButton }: SiteCardProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const sub = scenario.index.subTerritories.get(subTerritoryId);
  const site = state.subTerritories[subTerritoryId];
  if (sub === undefined || site === undefined) return null;
  const own = site.holder === viewer;
  const capital = isCapital(scenario, sub);
  const tracks = scenario.development.filter((track) => !track.cityOnly || sub.cityIds.length > 0);
  const improvements = scenario.improvements;
  const plannedCount = planned.length;
  const queue = site.queue;
  const started = queue.length - plannedCount;

  return (
    <article aria-label={sub.name} className={`site-card${own ? " site-card-own" : ""}`}>
      <header className="site-card-head">
        <h4>
          {capital ? <EconomyIcon className="site-capital" name="star" /> : null}
          {sub.name}
          {capital ? <span className="visually-hidden"> (capital)</span> : null}
        </h4>
        <span className="site-yield">{yieldText(signedAmountText(scenario, subTerritoryYield(scenario, site)))}</span>
      </header>
      {own ? null : <p className="site-holder">{`Held by ${factionName(scenario, site.holder)}`}</p>}
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
      {queue.length === 0 ? null : (
        <ol aria-label="Build queue" className="site-queue">
          {queue.map((item, at) => {
            const turns = projectCost(scenario, item.project)?.turns ?? 1;
            const plan = at >= started ? planned[at - started] : undefined;
            const name = projectName(scenario, site, item.project, levelBefore(site, queue, at));
            return (
              <li className={at === 0 ? "queue-head" : "queue-next"} key={`${String(at)}-${name}`}>
                <div className="queue-line">
                  <span><EconomyIcon name={projectIcon(scenario, item.project)} />{at === 0 ? <strong>{name}</strong> : <>Next: <strong>{name}</strong></>}</span>
                  <span className="queue-status">
                    {plan === undefined
                      ? at === 0 ? turnsLeftText(turns - item.progress) : `queued · ${amountText(scenario, item.paid)}`
                      : `this turn · ${amountText(scenario, item.paid)}`}
                  </span>
                  {plan === undefined ? null : (
                    <button aria-label={`Cancel ${name}`} className="text-button" onClick={() => dispatch(cancelBuildOrder(plan.index))} type="button">Cancel</button>
                  )}
                </div>
                <div aria-label={`${name} progress`} aria-valuemax={turns} aria-valuemin={0} aria-valuenow={item.progress} className="queue-bar" role="progressbar">
                  <span style={{ width: `${String(Math.round((100 * item.progress) / turns))}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {!own && queue.length === 0 ? (
        // U4: the viewer's recon shows this territory's queues, so an empty one reads empty.
        <p className="site-hidden"><EconomyIcon name="flag" />{isRevealed(state, viewer, sub.territoryId) ? "Queue empty (recon)" : "Queue hidden"}</p>
      ) : null}
      {own && withBuildButton ? (
        <div className="site-actions">
          <button className="secondary-button compact-button" onClick={() => dispatch(focusSubTerritory(subTerritoryId))} type="button">{`Build in ${sub.name}`}</button>
        </div>
      ) : null}
    </article>
  );
}

/** The level a queued levelled item starts from: the current level plus the same items ahead of it. */
function levelBefore(site: SubTerritoryState, queue: SubTerritoryState["queue"], at: number): number | undefined {
  const item = queue[at];
  if (item === undefined || item.project.kind === "building") return undefined;
  return currentLevel(site, item.project) + queue.slice(0, at).filter((other) => sameProject(other.project, item.project)).length;
}

const yieldText = (text: string): string => (text === "nothing" ? "no yield" : text);
