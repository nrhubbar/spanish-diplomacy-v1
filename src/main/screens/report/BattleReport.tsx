import { type JSX, useId, useMemo, useState } from "react";
import type { Scenario, TerritoryId, TurnResolutionResult } from "../../engine/types";
import { groupBattles } from "../../presentation/battle";
import { battleSummary } from "../../presentation/battleText";
import { BattleCard } from "./BattleCard";
import { battleKeysAt } from "./focus";

/** Cards after this many start collapsed, so a heavy turn stays readable (tasks section 4). */
const openBattleCards = 2;

interface BattleReportProps {
  /** F1: the place focused on the map; its cards open, scroll into view, and are highlighted. */
  readonly focusedTerritoryId: TerritoryId | undefined;
  /** The turn's outcomes and the board they left: a resolution result, or a history entry (U10). */
  readonly result: Pick<TurnResolutionResult, "finalState" | "outcomes">;
  readonly scenario: Scenario;
  /** The game's seed, which picks each battle's flavor line so replays read the same. */
  readonly seed: number;
}

/** C14: every battle of the turn, one card per place, with a summary line on top. */
export function BattleReport({ focusedTerritoryId, result, scenario, seed }: BattleReportProps): JSX.Element | null {
  const headingId = useId();
  const groups = useMemo(() => groupBattles(result.outcomes), [result.outcomes]);
  const focusedKeys = useMemo(
    () => new Set(focusedTerritoryId === undefined ? [] : battleKeysAt(groups, focusedTerritoryId)),
    [focusedTerritoryId, groups]
  );
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(() => new Set(groups.slice(0, openBattleCards).map((group) => group.key)));
  // A newly focused place opens its cards; clearing the focus leaves them as they are.
  const [seenFocus, setSeenFocus] = useState(focusedKeys);
  if (seenFocus !== focusedKeys) {
    setSeenFocus(focusedKeys);
    if ([...focusedKeys].some((key) => !openKeys.has(key))) setOpenKeys(new Set([...openKeys, ...focusedKeys]));
  }
  if (groups.length === 0) return null;
  const firstFocused = groups.find((group) => focusedKeys.has(group.key))?.key;
  const toggle = (key: string, open: boolean): void => {
    setOpenKeys((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  return (
    <section aria-labelledby={headingId} className="pane-section battle-report">
      <h3 id={headingId}>Battles</h3>
      <p className="battle-summary">{battleSummary(groups)}</p>
      <ol className="battle-list">
        {groups.map((group) => (
          <li key={group.key}>
            <BattleCard
              finalState={result.finalState}
              focused={focusedKeys.has(group.key)}
              group={group}
              onToggle={(open) => { toggle(group.key, open); }}
              open={openKeys.has(group.key)}
              reveal={group.key === firstFocused}
              scenario={scenario}
              seed={seed}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
