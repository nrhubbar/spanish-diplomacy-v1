import type { JSX } from "react";
import { requireFaction } from "../engine/lookup";
import type { Scenario, TurnOutcome, TurnResolutionResult } from "../engine/types";
import { glyphs } from "../presentation/glyphs";
import { medallionMarkup } from "../presentation/outcomeArt";
import type { OutcomeKey } from "../presentation/outcomes";
import { outcomeText } from "../presentation/outcomeText";
import { cssVariables } from "../presentation/style";
import { controllerName, describeOutcomeGroup, factionName, groupOutcomes, route, territoryName, unitName } from "../presentation/text";
import type { RevealedOrders } from "../state/selectors";

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
    </section>
  );
}

interface OutcomeGroupSpec {
  readonly kinds: readonly TurnOutcome["kind"][];
  readonly label: string;
  readonly open: boolean;
  /** An outcome medallion (H's art), or a plain route-coloured dot for ordinary moves. */
  readonly icon: { readonly medallion: OutcomeKey } | { readonly tone: "bounced" | "disbanded" | "moved" };
}

/** Battles have their own cards; these are every other kind of outcome, most serious first. */
const groups: readonly OutcomeGroupSpec[] = [
  { icon: { medallion: "surrendered" }, kinds: ["disbanded-move"], label: outcomeText.surrendered.title, open: true },
  { icon: { tone: "disbanded" }, kinds: ["invalid-order"], label: "Disbanded", open: true },
  { icon: { tone: "bounced" }, kinds: ["bounced-move"], label: "Bounced", open: true },
  { icon: { medallion: "recovered" }, kinds: ["recovered"], label: outcomeText.recovered.title, open: true },
  { icon: { medallion: "reinforcement-arrived" }, kinds: ["reinforcement-arrived"], label: outcomeText["reinforcement-arrived"].title, open: false },
  { icon: { tone: "moved" }, kinds: ["successful-move"], label: "Completed moves", open: false }
];

/** Neutral ring for report icons, which stand for a kind of outcome rather than a faction. */
const reportRing = "#5b4d40";

/**
 * U2: a compact summary grouped by result, with routine detail collapsed. Formations of one
 * faction that took the same route with the same result share one line.
 */
export function OutcomeSummary({ result, scenario }: { readonly result: TurnResolutionResult; readonly scenario: Scenario }): JSX.Element {
  const holds = result.outcomes.filter((outcome) => outcome.kind === "no-move").length;
  const bounced = result.outcomes.some((outcome) => outcome.kind === "bounced-move" || outcome.kind === "disbanded-move");
  return (
    <section aria-labelledby="outcomes-title" className="pane-section">
      <h3 id="outcomes-title">What happened</h3>
      {bounced ? <p className="pane-hint">{"Only another faction's armies can stop a move. A faction's own armies never block each other."}</p> : null}
      {groups.map((group) => {
        const outcomes = result.outcomes.filter((outcome) => group.kinds.includes(outcome.kind));
        if (outcomes.length === 0) return null;
        return (
          <details className="outcome-group" key={group.label} open={group.open}>
            <summary>
              {"medallion" in group.icon
                ? <span aria-hidden="true" className="outcome-medallion" dangerouslySetInnerHTML={{ __html: medallionMarkup(group.icon.medallion, reportRing) }} />
                : <span aria-hidden="true" className={`outcome-icon outcome-icon-${group.icon.tone}`} />}
              {`${group.label} (${String(outcomes.length)})`}
            </summary>
            <ul>
              {groupOutcomes(outcomes).map((entry, index) => (
                <li key={`${group.label}-${String(index)}`}>{describeOutcomeGroup(scenario, entry, result.outcomes)}</li>
              ))}
            </ul>
          </details>
        );
      })}
      {holds === 0 ? null : <p className="pane-hint">{`${String(holds)} ${holds === 1 ? "army" : "armies"} held without orders.`}</p>}
    </section>
  );
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
