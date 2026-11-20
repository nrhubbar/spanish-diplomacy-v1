import type { JSX } from "react";
import type { MoveRoute } from "../../engine/movement/routes";
import type { GameState, Scenario } from "../../engine/types";
import { routeRows } from "../../presentation/movement";
import { type DestinationEstimate, modifierName, percent, signed } from "../../presentation/odds";
import { territoryName } from "../../presentation/text";

interface RouteCardProps {
  readonly allowance: number;
  readonly estimate: DestinationEstimate | undefined;
  readonly route: MoveRoute;
  readonly scenario: Scenario;
  readonly state: GameState;
}

/**
 * X5: the full breakdown for the destination row under the pointer or focus: the odds and every
 * modifier for an attack, then what the route costs (moves, terrain, rail, sea, weather).
 */
export function RouteCard({ allowance, estimate, route, scenario, state }: RouteCardProps): JSX.Element {
  const name = territoryName(scenario, route.to);
  const verb = estimate?.kind === "battle" ? "Attack" : estimate?.kind === "reinforcement" ? "Reinforce" : "Move to";
  return (
    <div aria-live="polite" className="route-card">
      <h5>{`${verb} ${name}`}</h5>
      <dl className="route-card-rows">
        {estimate?.kind === "battle" ? (
          <>
            <div><dt>{`Odds (attack ${String(estimate.attack)} v defence ${String(estimate.defence)})`}</dt><dd>{estimate.oddsLabel}</dd></div>
            {estimate.modifiers.map((modifier, index) => (
              <div key={`${modifier.kind}-${String(index)}`}><dt>{modifierName(modifier)}</dt><dd>{signed(modifier.roll)}</dd></div>
            ))}
          </>
        ) : null}
        {routeRows(scenario, state, route, allowance).map((row) => (
          <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
        ))}
        {estimate?.kind === "battle" ? (
          <div className="route-card-total"><dt>Chance to take it</dt><dd>{percent(estimate.takeChance)}</dd></div>
        ) : null}
      </dl>
    </div>
  );
}
