import { type JSX, useId, useState } from "react";
import { plannedSpend } from "../../engine/economy/catalogue";
import { holdersIn, territoriesHeldWhole } from "../../engine/economy/holdings";
import { incomeFor } from "../../engine/economy/income";
import { amountOf, treasuryOf } from "../../engine/economy/resources";
import type { ResourceId } from "../../engine/types";
import { useAppSelector } from "../../hooks";
import { signed } from "../../presentation/economy";
import { plannedBuilds } from "../../state/planning";
import { EconomyIcon, resourceIcon } from "../economy/EconomyIcon";
import type { HeaderSlotProps } from "./slots";

/**
 * X1: one chip per resource with the balance and next turn's income. Tapping a chip opens its
 * detail: where the income comes from, what this turn's orders will spend, and other factions'
 * balances, which stay hidden unless recon reveals them ($6). Renders nothing without an
 * economy or a viewer.
 */
export function ResourceChips({ scenario, state, viewer }: HeaderSlotProps): JSX.Element | null {
  // The raw session: planned builds are the viewer's own, and the header needs no registry.
  const session = useAppSelector((root) => root.game.session);
  const [open, setOpen] = useState<ResourceId | undefined>(undefined);
  const id = useId();
  if (viewer === undefined || scenario.rules.economy === "none" || state.treasuries[viewer] === undefined) return null;
  const balance = treasuryOf(state, viewer);
  const income = incomeFor(scenario, state, viewer);
  const spend = session.phase === "planning" ? plannedSpend(scenario, plannedBuilds(session)) : {};
  const whole = territoriesHeldWhole(scenario, state.subTerritories, viewer).length;
  const contested = scenario.territories.filter((territory) => {
    const holders = holdersIn(scenario, state.subTerritories, territory.id);
    return holders.length > 1 && holders.includes(viewer);
  }).length;
  const others = scenario.factions.filter((faction) => faction.id !== viewer);

  return (
    <div className="resource-chips" role="group" aria-label="Resources">
      {scenario.resources.map((resource) => {
        const expanded = open === resource.id;
        const gain = amountOf(income.paid, resource.id);
        const spent = amountOf(spend, resource.id);
        return (
          <div className="resource-chip-wrap" key={resource.id}>
            <button
              aria-label={`${resource.name} ${String(amountOf(balance, resource.id) - spent)}, ${signed(gain)} next turn`}
              aria-controls={`${id}-${resource.id}`}
              aria-expanded={expanded}
              className="resource-chip"
              onClick={() => { setOpen(expanded ? undefined : resource.id); }}
              type="button"
            >
              <EconomyIcon name={resourceIcon(scenario, resource.id)} />
              <span className="resource-name">{resource.name}</span>
              <span className="resource-balance">{String(amountOf(balance, resource.id) - spent)}</span>
              <span className="resource-income">{signed(gain)}</span>
            </button>
            {expanded ? (
              <div className="resource-detail" id={`${id}-${resource.id}`} role="region" aria-label={`${resource.name} detail`}>
                <p><strong>{`${resource.name}: ${String(amountOf(balance, resource.id))}`}</strong></p>
                {spent > 0 ? <p>{`This turn's orders spend ${String(spent)} when revealed.`}</p> : null}
                <p>{`Next turn ${signed(gain)} from ${String(whole)} ${whole === 1 ? "territory" : "territories"} held whole.`}</p>
                {amountOf(income.cut, resource.id) > 0 ? <p>{`Raids cut ${String(amountOf(income.cut, resource.id))}.`}</p> : null}
                {contested > 0 ? <p>{`${String(contested)} contested ${contested === 1 ? "territory pays" : "territories pay"} nothing.`}</p> : null}
                <ul aria-label="Other factions" className="resource-others">
                  {others.map((faction) => {
                    const theirs = state.treasuries[faction.id];
                    return (
                      <li key={faction.id}>
                        <span>{faction.name}</span>
                        <span className={theirs === undefined ? "resource-hidden" : "resource-revealed"}>
                          {theirs === undefined ? "hidden" : `${String(amountOf(theirs, resource.id))} (recon)`}
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
    </div>
  );
}
