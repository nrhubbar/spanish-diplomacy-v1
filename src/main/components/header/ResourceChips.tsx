import { type JSX, memo, useId, useMemo, useState } from "react";
import type { ResourceId } from "../../engine/types";
import { useSession } from "../../hooks";
import { isInGame } from "../../state/session";
import { amountHeld, resourceAmount, resourceAmountInFull, signedResourceAmount } from "../../presentation/economy";
import { glyphs } from "../../presentation/glyphs";
import { ledgersFor } from "../../presentation/ledger";
import { Ledger } from "./Ledger";
import { EconomyIcon, resourceIcon } from "../economy/EconomyIcon";
import type { HeaderSlotProps } from "./slots";

/**
 * X1, U11: one chip per resource: the balance after this turn's Build and Recruit orders, then
 * next turn's change. Tapping a chip opens its balance view (`Ledger`): one row per territory,
 * the expense rows, and a total that is the chip's second figure, then other factions'
 * balances, which stay hidden unless recon reveals them ($6). Renders nothing without an
 * economy or a viewer.
 */
function Chips({ scenario, state, viewer }: HeaderSlotProps): JSX.Element | null {
  // Read through the visible session ($6, m3), whose game state stays the same object while the
  // player selects (`visibleSession`), so next turn's income is not recomputed on each click.
  const session = useSession();
  const record = isInGame(session) ? session.game.state : undefined;
  const disbands = session.phase === "planning" ? session.draft.disbands : undefined;
  const builds = session.phase === "planning" ? session.draft.builds : undefined;
  const recruits = session.phase === "planning" ? session.draft.recruits : undefined;
  const replenishments = session.phase === "planning" ? session.draft.replenishments : undefined;
  const source = record?.turnNumber === state.turnNumber ? record : state;
  const [open, setOpen] = useState<ResourceId | undefined>(undefined);
  const id = useId();
  const ledgers = useMemo(() => {
    if (viewer === undefined || scenario.rules.economy === "none" || state.treasuries[viewer] === undefined) return undefined;
    return ledgersFor(scenario, { ...source, treasuries: state.treasuries }, viewer, {
      builds: builds ?? [],
      recruits: recruits ?? [],
      disbands: disbands ?? [],
      replenishments: replenishments ?? []
    });
  }, [builds, disbands, recruits, replenishments, scenario, source, state, viewer]);
  if (ledgers === undefined) return null;
  const others = scenario.factions.filter((faction) => faction.id !== viewer);

  return (
    <>
      {scenario.resources.map((resource, index) => {
        const ledger = ledgers[index];
        if (ledger === undefined) return null;
        const expanded = open === resource.id;
        // EB-12: every amount reads through the resource's display scale ("Manpower 18k +9k").
        const shown = (value: number): string => resourceAmount(scenario, resource.id, value);
        const next = signedResourceAmount(scenario, resource.id, ledger.total);
        return (
          <div className={`resource-chip-wrap header-meter${index === 0 ? " resource-chip-first" : ""}`} key={resource.id}>
            <button
              aria-controls={`${id}-${resource.id}`}
              aria-expanded={expanded}
              className="resource-chip"
              onClick={() => { setOpen(expanded ? undefined : resource.id); }}
              type="button"
            >
              <EconomyIcon name={resourceIcon(scenario, resource.id)} />
              <span className="resource-name">{resource.name}</span>{" "}
              <span className="resource-balance">{shown(ledger.now)}</span>{" "}
              <span className="resource-income" data-negative={ledger.total < 0}>{next}</span>
              <span className="visually-hidden"> next turn</span>
            </button>
            {expanded ? (
              <div className="resource-detail" id={`${id}-${resource.id}`} role="region" aria-label={`${resource.name} detail`}>
                <p>
                  <strong>{`${resource.name}: ${shown(ledger.now)} now ${glyphs.dot} ${next} next turn`}</strong>
                </p>
                <Ledger ledger={ledger} scenario={scenario} />
                {ledger.spent > 0
                  ? <p>{`This turn's Build and Recruit orders spend ${shown(ledger.spent)} of the ${shown(ledger.held)}${resource.display === undefined ? "" : ` (${resourceAmountInFull(scenario, resource.id, ledger.held)})`} you hold.`}</p>
                  : <p>{`You hold ${shown(ledger.held)}${resource.display === undefined ? "" : ` (${resourceAmountInFull(scenario, resource.id, ledger.held)})`}.`}</p>}
                <ul aria-label="Other factions" className="resource-others">
                  {others.map((faction) => {
                    const theirs = state.treasuries[faction.id];
                    return (
                      <li key={faction.id}>
                        <span>{faction.name}</span>
                        <span className={theirs === undefined ? "resource-hidden" : "resource-revealed"}>
                          {theirs === undefined ? "hidden" : `${amountHeld(scenario, theirs, resource.id)} (recon)`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

/**
 * Re-rendered only when what it shows can change: the viewer, the turn, the visible balances or
 * raid cuts (planned builds come through the store selection). Selecting territories rebuilds
 * the filtered state without changing any of these.
 */
export const ResourceChips = memo(Chips, (before, after) =>
  before.scenario === after.scenario
  && before.viewer === after.viewer
  && before.state.turnNumber === after.state.turnNumber
  && before.state.raidCuts === after.state.raidCuts
  && JSON.stringify(before.state.treasuries) === JSON.stringify(after.state.treasuries));
