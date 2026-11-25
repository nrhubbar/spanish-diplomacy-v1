import { type JSX, useId } from "react";
import type { Scenario, UnitId, UnitState } from "../../engine/types";
import { WeatherChip } from "../../components/weather/WeatherChip";
import { WeatherIcon } from "../../components/weather/WeatherIcon";
import { useAppDispatch } from "../../hooks";
import { feedbackText } from "../../presentation/feedback";
import { glyphs } from "../../presentation/glyphs";
import {
  aircraftLine,
  aircraftView,
  antiAirHeading,
  antiAirLabel,
  baseWeather,
  fightersLabel,
  generalView,
  missionHints,
  missionNames,
  sameMission
} from "../../presentation/airPane";
import { raidResultNames } from "../../presentation/systemText/air";
import { unitName } from "../../presentation/text";
import { chooseAirMission, clickMapUnit, closeAircraftPane, planAirMission, toggleSackOrder } from "../../state/gameSlice";
import {
  type AirTarget,
  airTargets,
  isSackPlanned,
  plannedMission,
  type PlanningSession,
  raidPreview
} from "../../state/planning";
import { AircraftDisband } from "./DisbandControls";

interface AirPaneProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly unitId: UnitId;
}

/**
 * U2 (Q-UX-10, `ux-air-a.webp`): the selected aircraft's pane. Its base, type and range, one
 * button per mission (missions its type cannot fly are greyed), which starts choosing its target on
 * the map (N6), and a card for the chosen target: range, anti-air, enemy fighters in reach, and the raid's chances.
 */
export function AirPane({ scenario, session, unitId }: AirPaneProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const state = session.game.state;
  const unit = state.units[unitId];
  const planned = plannedMission(session.draft, unitId);
  if (unit === undefined) return null;
  const { base, meta, missions, name, others, range } = aircraftView(scenario, state, unit);
  const { stage } = session.draft;
  const shown = stage?.step === "choose-target" ? stage.mission : planned?.mission.kind;
  const chosen = planned !== undefined && planned.mission.kind === shown ? airTargets(scenario, state, unitId, shown).find((target) => sameMission(planned.mission, target.mission)) : undefined;

  return (
    <section aria-labelledby={headingId} className="air-pane">
      <h3 id={headingId}>{name}</h3>
      <p className="pane-meta">
        {meta}
      </p>
      <div className="territory-meta">
        <WeatherChip scenario={scenario} state={state} territoryId={unit.territoryId} />
        <span className="site-chip">1 mission a turn</span>
      </div>
      <h4>Mission</h4>
      <div aria-label="Mission" className="air-missions" role="group">
        {missions.map(({ allowed, kind: mission, title }) => (
          <button
            aria-pressed={shown === mission}
            className="air-mission-button"
            disabled={!allowed}
            key={mission}
            onClick={() => dispatch(chooseAirMission({ mission, unitId }))}
            title={title}
            type="button"
          >
            {missionNames[mission]}
          </button>
        ))}
        <button
          aria-pressed={shown === undefined}
          className="air-mission-button"
          onClick={() => dispatch(planAirMission({ unitId }))}
          type="button"
        >
          Stand down
        </button>
        <AircraftDisband scenario={scenario} session={session} unit={unit} />
      </div>
      {shown === undefined ? <p className="pane-hint">Choose a mission, then its target on the map.</p> : (
        <>
          <p className="pane-hint">{missionHints[shown]}</p>
          {chosen === undefined ? null : <TargetCard range={range} scenario={scenario} session={session} target={chosen} unit={unit} />}
        </>
      )}
      {session.draft.feedback === undefined ? null : <p className="inline-feedback" role="status">{feedbackText(scenario, session.draft.feedback)}</p>}
      {others.length === 0 ? null : (
        <>
          <h4>{`Other aircraft at ${base}`}</h4>
          <ul className="plain-list">
            {others.map((other) => {
              const mission = plannedMission(session.draft, other.id);
              return (
                <li key={other.id}>
                  {aircraftLine(unitName(scenario, other.id), mission?.mission.kind)}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <button className="text-button" onClick={() => dispatch(closeAircraftPane())} type="button">{`Back to ${base}`}</button>
    </section>
  );
}

function TargetCard({ range, scenario, session, target, unit }: {
  readonly range: number;
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly target: AirTarget;
  readonly unit: UnitState;
}): JSX.Element {
  const state = session.game.state;
  const raid = target.mission.kind === "raid" ? raidPreview(scenario, state, unit.id, target.mission.subTerritoryId) : undefined;
  return (
    <div className="air-target-card">
      <strong>{`${missionNames[target.mission.kind]} ${target.name}`}</strong>
      <dl>
        <dt>Range</dt>
        <dd>{`${String(target.distance)} of ${String(range)}`}</dd>
        <BaseWeather scenario={scenario} session={session} unit={unit} />
        {raid === undefined ? null : (
          <>
            <dt>{antiAirHeading(scenario, target.mission, target.name)}</dt>
            <dd>{antiAirLabel(raid.antiAir)}</dd>
            <dt>Enemy fighters in range</dt>
            <dd>{fightersLabel(raid.fightersInReach)}</dd>
          </>
        )}
      </dl>
      {raid === undefined ? null : (
        <ul aria-label="Raid chances before interception" className="air-chances">
          {(Object.keys(raidResultNames) as (keyof typeof raidResultNames)[]).map((result) => (
            <li key={result}>
              <span aria-hidden="true" className="air-chance-key" data-result={result} />
              {`${raidResultNames[result]} ${String(Math.round(raid.chances[result] * 100))}%`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** M11, T3, U2 (`ux-air-a`): the weather at the aircraft's base and whether it flies. */
function BaseWeather({ scenario, session, unit }: { readonly scenario: Scenario; readonly session: PlanningSession; readonly unit: UnitState }): JSX.Element | null {
  const base = baseWeather(scenario, session.game.state, unit);
  if (base === undefined) return null;
  return (
    <>
      <dt>
        {base.heading}
        <WeatherIcon weatherId={base.weather.id} />
        {` ${base.weather.name}`}
      </dt>
      <dd data-grounded={base.grounded}>{base.verdict}</dd>
    </>
  );
}

/** U2: the player's aircraft in a territory, each opening its missions; listed apart from the armies. */
export function AircraftHere({ aircraft, scenario, session }: { readonly aircraft: readonly UnitState[]; readonly scenario: Scenario; readonly session: PlanningSession }): JSX.Element | null {
  const dispatch = useAppDispatch();
  if (aircraft.length === 0) return null;
  return (
    <div className="aircraft-here">
      <h4>Aircraft here</h4>
      <ul className="plain-list">
        {aircraft.map((unit) => {
          const mission = plannedMission(session.draft, unit.id);
          const name = unitName(scenario, unit.id);
          return (
            <li key={unit.id}>
              <button className="text-button" onClick={() => dispatch(clickMapUnit(unit.id))} type="button">
                {aircraftLine(name, mission?.mission.kind)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** U5 (`ux-pane-a-units.webp`): a general's pill (name and trait) and his Sack order. */
export function GeneralControls({ scenario, session, unit }: { readonly scenario: Scenario; readonly session: PlanningSession; readonly unit: UnitState }): JSX.Element | null {
  const dispatch = useAppDispatch();
  const general = generalView(scenario, session.game.state, unit.id);
  if (general === undefined) return null;
  const sacking = isSackPlanned(session.draft, unit.id);
  return (
    <div className="general-controls">
      <span className="general-pill" title={general.title}>
        <span aria-hidden="true">{glyphs.star}</span>
        {general.text}
      </span>
      {general.canSack ? (
        <button aria-pressed={sacking} className="text-button" onClick={() => dispatch(toggleSackOrder(unit.id))} type="button">
          {sacking ? "Keep him" : "Sack"}
        </button>
      ) : null}
      {sacking ? <span className="pane-meta">Relieved this turn; the next general arrives the turn after.</span> : null}
    </div>
  );
}
