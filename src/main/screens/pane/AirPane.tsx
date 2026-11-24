import { type JSX, useId, useState } from "react";
import { generalOf, isAllWeatherAirbaseFor, unitDefinitionIn, unitKindIn, unitTypeIn } from "../../engine/air/pieces";
import { type AirMission, type AirMissionKind, type Scenario, type UnitId, type UnitState } from "../../engine/types";
import { WeatherChip } from "../../components/weather/WeatherChip";
import { WeatherIcon } from "../../components/weather/WeatherIcon";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import {
  aircraftLine,
  aircraftMeta,
  allowedMissions,
  antiAirLabel,
  baseWeather,
  fightersLabel,
  generalPill,
  missionHints,
  missionButtonOrder,
  missionNames,
  missionTitle
} from "../../presentation/airPane";
import { raidResultNames } from "../../presentation/systemText/air";
import { clickMapUnit, closeAircraftPane, planAirMission, toggleSackOrder } from "../../state/gameSlice";
import {
  type AirTarget,
  airTargets,
  isSackPlanned,
  missionTerritoryId,
  plannedMission,
  type PlanningSession,
  raidPreview
} from "../../state/planning";
import { DisbandControls } from "./DisbandControls";

function sameMission(a: AirMission | undefined, b: AirMission): boolean {
  return a !== undefined && JSON.stringify(a) === JSON.stringify(b);
}

interface AirPaneProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly unitId: UnitId;
}

/**
 * U2 (Q-UX-10, `ux-air-a.webp`): the selected aircraft's pane. Its base, type and range, one
 * button per mission (missions its type cannot fly are greyed), the target list, and a card for
 * the chosen target: range, anti-air, enemy fighters in reach, and the raid's chances.
 */
export function AirPane({ scenario, session, unitId }: AirPaneProps): JSX.Element | null {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const state = session.game.state;
  const unit = state.units[unitId];
  const planned = plannedMission(session.draft, unitId);
  const [kind, setKind] = useState<AirMissionKind | undefined>(planned?.mission.kind);
  if (unit === undefined) return null;
  const type = unitTypeIn(scenario, state.raised, unitId);
  const name = unitDefinitionIn(scenario, state.raised, unitId)?.name ?? unitId;
  const allowed = allowedMissions(type);
  const base = scenario.index.territories.get(unit.territoryId)?.name ?? unit.territoryId;
  const paved = isAllWeatherAirbaseFor(scenario, state, unit.territoryId, unit.factionId);
  const shown = kind ?? planned?.mission.kind;
  const targets = shown === undefined ? [] : airTargets(scenario, state, unitId, shown);
  const chosen = planned !== undefined && planned.mission.kind === shown ? targets.find((target) => sameMission(planned.mission, target.mission)) : undefined;
  const others = Object.values(state.units).filter((other) => other.id !== unitId && other.factionId === unit.factionId && other.territoryId === unit.territoryId
    && unitKindIn(scenario, state.raised, other.id) === "air");

  return (
    <section aria-labelledby={headingId} className="air-pane">
      <h3 id={headingId}>{name}</h3>
      <p className="pane-meta">
        {aircraftMeta(type, base, paved)}
      </p>
      <div className="territory-meta">
        <WeatherChip scenario={scenario} state={state} territoryId={unit.territoryId} />
        <span className="site-chip">1 mission a turn</span>
      </div>
      <h4>Mission</h4>
      <div aria-label="Mission" className="air-missions" role="group">
        {missionButtonOrder.map((mission) => (
          <button
            aria-pressed={shown === mission}
            className="air-mission-button"
            disabled={!allowed.includes(mission)}
            key={mission}
            onClick={() => { setKind(mission); }}
            title={missionTitle(type, mission)}
            type="button"
          >
            {missionNames[mission]}
          </button>
        ))}
        <button
          aria-pressed={shown === undefined && planned === undefined}
          className="air-mission-button"
          onClick={() => { setKind(undefined); dispatch(planAirMission({ unitId })); }}
          type="button"
        >
          Stand down
        </button>
      </div>
      {shown === undefined ? <p className="pane-hint">Choose a mission, then its target.</p> : (
        <>
          <p className="pane-hint">{missionHints[shown]}</p>
          {targets.length === 0 ? <p className="pane-hint">Nothing in range for this mission.</p> : (
            <label className="air-target-picker">
              <span>Target</span>
              <select
                onChange={(event) => {
                  const target = targets[Number(event.target.value)];
                  if (target !== undefined) dispatch(planAirMission({ mission: target.mission, unitId }));
                }}
                value={chosen === undefined ? "" : String(targets.indexOf(chosen))}
              >
                <option disabled value="">Choose a target</option>
                {targets.map((target, index) => (
                  <option key={JSON.stringify(target.mission)} value={String(index)}>{`${target.name} (${String(target.distance)} away)`}</option>
                ))}
              </select>
            </label>
          )}
          {chosen === undefined ? null : <TargetCard range={type?.air?.range ?? 0} scenario={scenario} session={session} target={chosen} unit={unit} />}
        </>
      )}
      {session.draft.feedback === undefined ? null : <p className="inline-feedback" role="status">{session.draft.feedback}</p>}
      {others.length === 0 ? null : (
        <>
          <h4>{`Other aircraft at ${base}`}</h4>
          <ul className="plain-list">
            {others.map((other) => {
              const mission = plannedMission(session.draft, other.id);
              return (
                <li key={other.id}>
                  {aircraftLine(unitDefinitionIn(scenario, state.raised, other.id)?.name ?? other.id, mission?.mission.kind)}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <DisbandControls scenario={scenario} session={session} unit={unit} />
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
  const territoryId = missionTerritoryId(scenario, target.mission);
  return (
    <div className="air-target-card">
      <strong>{`${missionNames[target.mission.kind]} ${target.name}`}</strong>
      <dl>
        <dt>Range</dt>
        <dd>{`${String(target.distance)} of ${String(range)}`}</dd>
        <BaseWeather scenario={scenario} session={session} unit={unit} />
        {raid === undefined ? null : (
          <>
            <dt>{`Anti-air in ${territoryId === undefined ? target.name : scenario.index.territories.get(territoryId)?.name ?? target.name}`}</dt>
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
          const name = unitDefinitionIn(scenario, session.game.state.raised, unit.id)?.name ?? unit.id;
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
  const general = generalOf(scenario, session.game.state.raised, unit.id);
  if (general === undefined) return null;
  const pill = generalPill(general, scenario.generalTraits.find((candidate) => candidate.id === general.traitId));
  const sacking = isSackPlanned(session.draft, unit.id);
  const canSack = unitTypeIn(scenario, session.game.state.raised, unit.id)?.orders.includes("sack") ?? false;
  return (
    <div className="general-controls">
      <span className="general-pill" title={pill.title}>
        <span aria-hidden="true">{glyphs.star}</span>
        {pill.text}
      </span>
      {canSack ? (
        <button aria-pressed={sacking} className="text-button" onClick={() => dispatch(toggleSackOrder(unit.id))} type="button">
          {sacking ? "Keep him" : "Sack"}
        </button>
      ) : null}
      {sacking ? <span className="pane-meta">Relieved this turn; the next general arrives the turn after.</span> : null}
    </div>
  );
}
