import { type JSX, useId, useMemo } from "react";
import type { Scenario, TurnResolutionResult } from "../../engine/types";
import { groupBattles } from "../../presentation/battle";
import { battleSummary } from "../../presentation/battleText";
import { BattleCard } from "./BattleCard";

/** Cards after this many start collapsed, so a heavy turn stays readable (tasks section 4). */
export const openBattleCards = 2;

interface BattleReportProps {
  readonly result: TurnResolutionResult;
  readonly scenario: Scenario;
  /** The game's seed, which picks each battle's flavor line so replays read the same. */
  readonly seed: number;
}

/** C14: every battle of the turn, one card per place, with a summary line on top. */
export function BattleReport({ result, scenario, seed }: BattleReportProps): JSX.Element | null {
  const headingId = useId();
  const groups = useMemo(() => groupBattles(result.outcomes), [result.outcomes]);
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="pane-section battle-report">
      <h3 id={headingId}>Battles</h3>
      <p className="battle-summary">{battleSummary(groups)}</p>
      <ol className="battle-list">
        {groups.map((group, index) => (
          <li key={group.key}>
            <BattleCard
              defaultOpen={index < openBattleCards}
              finalState={result.finalState}
              group={group}
              scenario={scenario}
              seed={seed}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
