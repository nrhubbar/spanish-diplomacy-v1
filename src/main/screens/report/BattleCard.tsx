import type { JSX } from "react";
import type { GameState, Scenario } from "../../engine/types";
import { type BattleGroup, type BattleKind, decisiveBattle } from "../../presentation/battle";
import { cardFlavor, flavorSeed, occupationLine, placeName } from "../../presentation/battleText";
import { emblemMarkup } from "../../presentation/outcomeArt";
import { outcomeText } from "../../presentation/outcomeText";
import { BattleEngagement } from "./BattleEngagement";
import { BattleRule } from "./BattleRule";

interface BattleCardProps {
  readonly defaultOpen: boolean;
  readonly finalState: GameState;
  readonly group: BattleGroup;
  readonly scenario: Scenario;
  readonly seed: number;
}

const kindLabels: Readonly<Record<BattleKind, string>> = {
  assault: "Battle for",
  entry: "Contested entry into",
  meeting: "Meeting on",
  standing: "Standing battle in"
};

/**
 * One fought-over place. The summary row names the place, the result, and who holds it now; it
 * opens onto each attack's sides, roll, and effects, and the rule note when one applies.
 */
export function BattleCard({ defaultOpen, finalState, group, scenario, seed }: BattleCardProps): JSX.Element {
  const lead = decisiveBattle(group);
  const { result } = lead.battle;
  const several = group.battles.length > 1;
  const line = cardFlavor(scenario, lead.battle, flavorSeed(seed, finalState.turnNumber, lead.index));
  return (
    <details className="battle-card" data-battle-kind={group.kind} data-result={result} data-sides={several ? group.battles.length + 1 : 2} open={defaultOpen}>
      <summary className="battle-card-summary">
        <span aria-hidden="true" className="battle-emblem" dangerouslySetInnerHTML={{ __html: emblemMarkup(result) }} />
        <span className="battle-card-heading">
          <span className="battle-kicker">{`${kindLabels[group.kind]} ${placeName(scenario, lead.battle)}`}</span>
          <span className="battle-title">{outcomeText[result].title}</span>
          <span className="battle-occupation">{occupationLine(scenario, lead.battle)}</span>
        </span>
      </summary>
      <div className="battle-card-body">
        <p className="battle-flavor">{line}</p>
        {group.battles.map((entry) => <BattleEngagement battle={entry.battle} key={entry.index} labelled={several} scenario={scenario} />)}
        <BattleRule finalState={finalState} group={group} scenario={scenario} />
      </div>
    </details>
  );
}
