import { type JSX, memo, useId, useMemo, useState } from "react";
import { plannedSpend } from "../../engine/economy/catalogue";
import { holdersIn, territoriesHeldWhole } from "../../engine/economy/holdings";
import { incomeFor } from "../../engine/economy/income";
import { amountOf, treasuryOf } from "../../engine/economy/resources";
import { addResources } from "../../engine/resources";
import type { ResourceId } from "../../engine/types";
import { useAppSelector } from "../../hooks";
import { replenishmentCost } from "../../state/planning/recruitment";
import { resourceAmount, resourceAmountInFull, signedResourceAmount } from "../../presentation/economy";
import { EconomyIcon, resourceIcon } from "../economy/EconomyIcon";
import type { HeaderSlotProps } from "./slots";

/**
 * X1: one chip per resource with the balance and next turn's income. Tapping a chip opens its
 * detail: where the income comes from, what this turn's orders will spend, and other factions'
 * balances, which stay hidden unless recon reveals them ($6). Renders nothing without an
 * economy or a viewer.
 */
function Chips({ scenario, state, viewer }: HeaderSlotProps): JSX.Element | null {
  // Narrow selections from the raw store, stable while the player selects: the game record's
  // state (income reads only public data and the viewer's own hooks) and this turn's planned
  // builds (the viewer's own). The filtered `state` prop is rebuilt on every selection.
  const record = useAppSelector((root) => ("game" in root.game.session ? root.game.session.game.state : undefined));
  const builds = useAppSelector((root) => (root.game.session.phase === "planning" ? root.game.session.draft.builds : undefined));
  const recruits = useAppSelector((root) => (root.game.session.phase === "planning" ? root.game.session.draft.recruits : undefined));
  const replenishments = useAppSelector((root) => (root.game.session.phase === "planning" ? root.game.session.draft.replenishments : undefined));
  const source = record?.turnNumber === state.turnNumber ? record : state;
  const [open, setOpen] = useState<ResourceId | undefined>(undefined);
  const id = useId();
  const income = useMemo(() => (viewer === undefined || scenario.rules.economy === "none" ? undefined : incomeFor(scenario, source, viewer)), [scenario, source, viewer]);
  if (viewer === undefined || income === undefined || state.treasuries[viewer] === undefined) return null;
  const balance = treasuryOf(state, viewer);
  // m11: builds, Recruit and Replenish orders, as the Recruit tab's "Left" counts them.
  const spend = addResources(plannedSpend(scenario, [...(builds ?? []), ...(recruits ?? [])]), replenishmentCost(scenario, state, viewer, replenishments ?? []));
  const whole = open === undefined ? 0 : territoriesHeldWhole(scenario, source.subTerritories, viewer).length;
  const contested = open === undefined ? 0 : scenario.territories.filter((territory) => {
    const holders = holdersIn(scenario, source.subTerritories, territory.id);
    return holders.length > 1 && holders.includes(viewer);
  }).length;
  const others = scenario.factions.filter((faction) => faction.id !== viewer);

  return (
    <>
      {scenario.resources.map((resource, index) => {
        const expanded = open === resource.id;
        const gain = amountOf(income.paid, resource.id);
        const spent = amountOf(spend, resource.id);
        // EB-12: every amount reads through the resource's display scale ("Manpower 18k +9k").
        const shown = (value: number): string => resourceAmount(scenario, resource.id, value);
        const gainText = signedResourceAmount(scenario, resource.id, gain);
        const held = amountOf(balance, resource.id);
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
              <span className="resource-balance">{shown(held - spent)}</span>{" "}
              <span className="resource-income">{gainText}</span>
              <span className="visually-hidden"> next turn</span>
            </button>
            {expanded ? (
              <div className="resource-detail" id={`${id}-${resource.id}`} role="region" aria-label={`${resource.name} detail`}>
                <p>
                  <strong>{`${resource.name}: ${shown(held)}`}</strong>
                  {resource.display === undefined ? null : ` (${resourceAmountInFull(scenario, resource.id, held)})`}
                </p>
                {spent > 0 ? <p>{`This turn's orders spend ${shown(spent)} when revealed.`}</p> : null}
                <p>{`Next turn ${gainText} from ${String(whole)} ${whole === 1 ? "territory" : "territories"} held whole.`}</p>
                {amountOf(income.cut, resource.id) > 0 ? <p>{`Raids cut ${shown(amountOf(income.cut, resource.id))}.`}</p> : null}
                {contested > 0 ? <p>{`${String(contested)} contested ${contested === 1 ? "territory pays" : "territories pay"} nothing.`}</p> : null}
                <ul aria-label="Other factions" className="resource-others">
                  {others.map((faction) => {
                    const theirs = state.treasuries[faction.id];
                    return (
                      <li key={faction.id}>
                        <span>{faction.name}</span>
                        <span className={theirs === undefined ? "resource-hidden" : "resource-revealed"}>
                          {theirs === undefined ? "hidden" : `${shown(amountOf(theirs, resource.id))} (recon)`}
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
