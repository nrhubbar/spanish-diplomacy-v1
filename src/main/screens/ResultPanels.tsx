import { type JSX, useEffect, useRef } from "react";
import { unitKindIn } from "../engine/air/pieces";
import { requireFaction } from "../engine/lookup";
import type { FactionId, Scenario, TerritoryId, TurnOutcome, TurnResolutionResult } from "../engine/types";
import { glyphs } from "../presentation/glyphs";
import { medallionMarkup } from "../presentation/outcomeArt";
import { EconomyIcon } from "../components/economy/EconomyIcon";
import { cssVariables } from "../presentation/style";
import { controllerName, describeOutcomeGroup, factionName, groupOutcomes, type ReportView, route, territoryName, unitName } from "../presentation/text";
import type { RevealedOrders } from "../state/selectors";
import { eventsAt, revealInPane } from "./report/focus";
import { groupMembers, groupOpen, type OutcomeGroupIcon, outcomeGroups } from "./report/groups";
import { SiteIcon } from "./pane/SiteIcons";
import { SubTerritoryChanges } from "./report/SubTerritoryChanges";

/** U5: which territories changed hands this turn. */
export function TerritoryChanges({ result, scenario }: { readonly result: TurnResolutionResult; readonly scenario: Scenario }): JSX.Element {
  return (
    <section aria-labelledby="changes-title" className="pane-section">
      <h3 id="changes-title">Territories changed</h3>
      {result.controlChanges.length === 0 ? (
        <p className="pane-hint">No territory changed hands.</p>
      ) : (
        <ul className="change-list">
          {result.controlChanges.map((change) => (
            <li key={change.territoryId}>
              <strong>{territoryName(scenario, change.territoryId)}</strong>
              <span>{`${controllerName(scenario, change.before)} ${glyphs.arrow} ${controllerName(scenario, change.after)}`}</span>
            </li>
          ))}
        </ul>
      )}
      <SubTerritoryChanges result={result} scenario={scenario} />
    </section>
  );
}

interface FocusNoteProps {
  /** Whether the focused place has battle cards, which then tell its story instead. */
  readonly battle: boolean;
  readonly focusedTerritoryId: TerritoryId | undefined;
  readonly result: TurnResolutionResult;
  readonly scenario: Scenario;
  /** The report's viewer, so a line never names another faction's numbers (`ReportView`). */
  readonly viewer?: FactionId | undefined;
}

/**
 * F1: the top of the turn report when a place is focused on the map. A place without a battle
 * gets a short note of what happened there. The region is always present and polite, so a
 * keyboard player on the map hears the answer without leaving it.
 */
export function FocusNote({ battle, focusedTerritoryId, result, scenario, viewer }: FocusNoteProps): JSX.Element {
  const note = useRef<HTMLElement>(null);
  const shown = focusedTerritoryId !== undefined && !battle;
  useEffect(() => {
    if (shown && note.current !== null) revealInPane(note.current);
  }, [focusedTerritoryId, shown]);
  const name = focusedTerritoryId === undefined ? "" : territoryName(scenario, focusedTerritoryId);
  const view = { state: result.finalState, ...(viewer === undefined ? {} : { viewer }) };
  const events = focusedTerritoryId === undefined || battle ? [] : eventsAt(scenario, result, focusedTerritoryId, view);
  return (
    <div className="focus-status" role="status">
      {focusedTerritoryId === undefined ? null : battle ? (
        <span className="visually-hidden">{`${name}: its battle is shown below.`}</span>
      ) : (
        <section aria-label={`What happened in ${name}`} className="pane-section focus-note" ref={note}>
          <h3>{name}</h3>
          {events.length === 0 ? (
            <p className="pane-hint">{`Nothing happened in ${name} this turn.`}</p>
          ) : (
            <ul>{events.map((line) => <li key={line}>{line}</li>)}</ul>
          )}
        </section>
      )}
    </div>
  );
}

/** Neutral ring for report icons, which stand for a kind of outcome rather than a faction. */
const reportRing = "#5b4d40";

/**
 * U2: a compact summary grouped by result, with routine detail collapsed. Formations of one
 * faction that took the same route with the same result share one line.
 */
export function OutcomeSummary({ result, scenario, viewer }: { readonly result: TurnResolutionResult; readonly scenario: Scenario; readonly viewer?: FactionId | undefined }): JSX.Element {
  // The Milestone 3 lines read the viewer's board (development) and keep other factions' numbers private.
  const view = { state: result.finalState, ...(viewer === undefined ? {} : { viewer }) };
  // Armies only: aircraft and generals have no order to hold on ($6: holds come from public orders, T6).
  const holds = result.outcomes.filter((outcome) => outcome.kind === "no-move" && outcome.unitId !== undefined
    && unitKindIn(scenario, result.finalState.raised, outcome.unitId) === "ground").length;
  const bounced = result.outcomes.some((outcome) => outcome.kind === "bounced-move" || outcome.kind === "disbanded-move");
  return (
    <section aria-labelledby="outcomes-title" className="pane-section">
      <h3 id="outcomes-title">What happened</h3>
      {bounced ? <p className="pane-hint">{"Only another faction's units can stop a move. A faction's own units never block each other."}</p> : null}
      {outcomeGroups.map((group) => {
        const outcomes = groupMembers(group, result.outcomes);
        if (outcomes.length === 0) return null;
        return (
          <details className="outcome-group" key={group.label} open={groupOpen(group, outcomes)}>
            <summary>
              <GroupIcon icon={group.icon} />
              {`${group.label} (${String(outcomes.length)})`}
            </summary>
            <ul>
              {groupLines(scenario, outcomes, result.outcomes, view).map((line, index) => (
                <li key={`${group.label}-${String(index)}`}>{line}</li>
              ))}
            </ul>
          </details>
        );
      })}
      {holds === 0 ? null : <p className="pane-hint">{`${String(holds)} ${holds === 1 ? "unit" : "units"} held without orders.`}</p>}
    </section>
  );
}

/** Builds still under way are summed into one line once there are this many. */
const progressSummaryFrom = 3;

/**
 * A group's lines in the report's words. Routine build progress is summed into one line
 * ("3 builds progressed: Farms at Girona, 1 of 3 turns; ...") so a long queue does not bury the
 * finished and lost builds above it.
 */
function groupLines(scenario: Scenario, outcomes: readonly TurnOutcome[], all: readonly TurnOutcome[], view: ReportView): readonly string[] {
  const progressed = outcomes.filter((outcome) => outcome.kind === "build-progressed");
  const rest = progressed.length < progressSummaryFrom ? outcomes : outcomes.filter((outcome) => outcome.kind !== "build-progressed");
  const lines = groupOutcomes(rest).map((entry) => describeOutcomeGroup(scenario, entry, all, view));
  if (rest === outcomes) return lines;
  const parts = progressed.map((outcome) => describeOutcomeGroup(scenario, { outcome, unitIds: [] }, all, view).replace(/\.$/u, "").replace(": ", ", "));
  return [...lines, `${String(progressed.length)} builds progressed: ${parts.join("; ")}.`];
}

/** A report group's icon (X8): H's medallion, a route-coloured dot, or a line icon. */
function GroupIcon({ icon }: { readonly icon: OutcomeGroupIcon }): JSX.Element {
  if ("medallion" in icon) return <span aria-hidden="true" className="outcome-medallion" dangerouslySetInnerHTML={{ __html: medallionMarkup(icon.medallion, reportRing) }} />;
  if ("tone" in icon) return <span aria-hidden="true" className={`outcome-icon outcome-icon-${icon.tone}`} />;
  return <span aria-hidden="true" className="outcome-line-icon">{"site" in icon ? <SiteIcon kind={icon.site} /> : <EconomyIcon name={icon.economy} />}</span>;
}

/** U4: progress against the thresholds, stated plainly. */
export function VictoryProgressPanel({ result, scenario }: { readonly result: TurnResolutionResult; readonly scenario: Scenario }): JSX.Element {
  return (
    <section aria-labelledby="progress-title" className="pane-section">
      <h3 id="progress-title">Victory progress</h3>
      <ul className="progress-list">
        {result.progress.map((entry) => {
          const color = requireFaction(scenario, entry.factionId).color;
          return (
            <li key={entry.factionId} style={cssVariables({ "--faction-color": color })}>
              <strong>{factionName(scenario, entry.factionId)}</strong>
              <Meter label="Territories" needed={entry.territoryThreshold} value={entry.territoriesControlled} />
              <Meter label="Cities" needed={entry.cityThreshold} value={entry.citiesControlled} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Meter({ label, needed, value }: { readonly label: string; readonly needed: number; readonly value: number }): JSX.Element {
  return (
    <div className="meter">
      <span className="meter-label">{`${label}: ${String(value)} (${String(needed)} needed)`}</span>
      <meter aria-label={`${label}: ${String(value)} of ${String(needed)} needed`} max={needed} min={0} value={Math.min(value, needed)} />
    </div>
  );
}

/** U1: one line per revealed order, grouped by faction. */
export function RevealedOrdersPanel({ revealed, scenario }: { readonly revealed: readonly RevealedOrders[]; readonly scenario: Scenario }): JSX.Element {
  return (
    <section aria-labelledby="revealed-title" className="pane-section">
      <h3 id="revealed-title">Revealed orders</h3>
      {revealed.map((entry) => (
        <details className="revealed-group" key={entry.factionId}>
          <summary>{`${factionName(scenario, entry.factionId)} (${entry.orders.length === 0 ? "all held" : `${String(entry.orders.length)} order${entry.orders.length === 1 ? "" : "s"}`})`}</summary>
          {entry.orders.length === 0 ? null : (
            <ul className="order-list">
              {entry.orders.map((order) => (
                <li key={order.unitId}>
                  <span>
                    <span className="order-unit">{unitName(scenario, order.unitId)}</span>
                    <span className="order-route">{route(scenario, order)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      ))}
    </section>
  );
}
