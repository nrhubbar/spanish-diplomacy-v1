import { type JSX, useId, useState } from "react";
import type { MoveRoute } from "../engine/movement/routes";
import type { GameState, Scenario, TerritoryId, UnitState } from "../engine/types";
import { useAppDispatch } from "../hooks";
import { glyphs } from "../presentation/glyphs";
import { type DestinationEstimate, modifierPhrase, oddsSummary } from "../presentation/odds";
import { routeChips, routeChipText, routeDetail } from "../presentation/movement";
import { territoryName } from "../presentation/text";
import { clickMapTerritory } from "../state/gameSlice";
import { WeatherChip } from "../components/weather/WeatherChip";
import { RouteCard } from "./movement/RouteCard";
import { RouteChips } from "./movement/RouteChips";
import { OddsInfo } from "./OddsInfo";

/** X5: under the `allowance` module, each destination's route and what the selected army can do. */
export interface DestinationRoutes {
  readonly allowance: number;
  /** D5: the train places used at a ride's boarding capital this turn with these units aboard, for "uses 3 of 4 train places". */
  readonly placesUsed: (route: MoveRoute) => number;
  readonly routes: ReadonlyMap<TerritoryId, MoveRoute>;
  readonly state: GameState;
  readonly units: readonly UnitState[];
}

interface DestinationChoicesProps {
  readonly estimates: ReadonlyMap<TerritoryId, DestinationEstimate>;
  readonly moves?: DestinationRoutes | undefined;
  readonly scenario: Scenario;
}

/**
 * C15: every legal destination with what the move would meet, before the order is committed.
 * Choosing one here is the same as choosing it on the map; this list is also the keyboard and
 * screen-reader copy of the odds the map shows. The odds count every army this faction would
 * send there (A1) and read as approximate, with the "i" saying why (A2).
 */
export function DestinationChoices({ estimates, moves, scenario }: DestinationChoicesProps): JSX.Element {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const listId = useId();
  const [active, setActive] = useState<TerritoryId | undefined>(undefined);
  // X5: a tap chooses the row, so on touch screens the card opens from its own "Details" toggle.
  const [opened, setOpened] = useState<TerritoryId | undefined>(undefined);
  return (
    <div className="destination-choices">
      <OddsInfo label="About the destination odds">
        <h4 id={headingId}>Destinations</h4>
      </OddsInfo>
      <ul aria-labelledby={headingId} className="destination-list">
        {[...estimates].map(([territoryId, estimate]) => {
          const summary = oddsSummary(estimate);
          const route = moves?.routes.get(territoryId);
          const detail = estimateDetail(estimate);
          const routeLine = route === undefined || moves === undefined ? undefined : routeDetail(scenario, moves.state, route, moves.placesUsed(route));
          const chips = route === undefined || moves === undefined ? [] : routeChips(scenario, route, moves.units, moves.allowance, estimate);
          const describedBy = moves === undefined ? undefined : `${listId}-${territoryId}`;
          return (
            <li className="destination-row" key={territoryId} onMouseEnter={() => setActive(territoryId)} onMouseLeave={() => setActive(undefined)}>
              <button
                aria-describedby={describedBy}
                className="destination-button"
                data-tone={summary.tone}
                onBlur={() => setActive(undefined)}
                onClick={() => dispatch(clickMapTerritory(territoryId))}
                onFocus={() => setActive(territoryId)}
                type="button"
              >
                <span className="destination-name" id={`${listId}-${territoryId}-name`}>{territoryName(scenario, territoryId)}</span>
                <span className="odds-chip" data-tone={summary.tone}>
                  <span aria-hidden="true">{routeChipText(route, summary.label, estimate)}</span>
                  <span className="visually-hidden">{routeChipText(route, summary.sentence, estimate)}</span>
                </span>
                {detail === undefined ? null : <span className="destination-detail">{detail}</span>}
              </button>
              {describedBy === undefined || moves === undefined ? null : (
                <div className="destination-route" id={describedBy}>
                  {routeLine === undefined ? null : <span className="destination-detail">{routeLine}</span>}
                  <RouteChips chips={chips} leading={<WeatherChip scenario={scenario} state={moves.state} territoryId={territoryId} />} />
                  {route === undefined ? null : (
                    <button
                      aria-expanded={opened === territoryId}
                      aria-describedby={`${listId}-${territoryId}-name`}
                      className="text-button route-details-toggle"
                      onClick={() => setOpened(opened === territoryId ? undefined : territoryId)}
                      type="button"
                    >
                      {opened === territoryId ? "Hide route details" : "Route details"}
                    </button>
                  )}
                </div>
              )}
              {(active === territoryId || opened === territoryId) && route !== undefined && moves !== undefined
                ? <RouteCard allowance={moves.allowance} estimate={estimate} route={route} scenario={scenario} state={moves.state} />
                : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The sides and every named modifier: "Attack 8 against defence 6 - Dug in +2". */
function estimateDetail(estimate: DestinationEstimate): string | undefined {
  if (estimate.kind !== "battle") return undefined;
  const sides = `Attack ${String(estimate.attack)} against defence ${String(estimate.defence)}`;
  return [sides, ...estimate.modifiers.map(modifierPhrase)].join(` ${glyphs.dot} `);
}
