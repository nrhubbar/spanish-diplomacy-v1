import type { JSX } from "react";
import { requireFaction } from "../../engine/lookup";
import type { BattleOutcome, Scenario } from "../../engine/types";
import { affectedFaction } from "../../presentation/battle";
import { medallionMarkup } from "../../assets/outcomes/outcomeArt";
import { battleTitle, resultKeyOf } from "../../presentation/grades";
import { factionName } from "../../presentation/text";
import { BattleEffects } from "./BattleEffects";
import { BattleRoll } from "./BattleRoll";
import { BattleSides } from "./BattleSides";

interface BattleEngagementProps {
  readonly battle: BattleOutcome;
  /** True on cards with several attacks, where each attack is headed by its result. */
  readonly labelled: boolean;
  readonly scenario: Scenario;
}

/** One attack and its die: the sides, the roll, and what the result did. */
export function BattleEngagement({ battle, labelled, scenario }: BattleEngagementProps): JSX.Element {
  const ring = requireFaction(scenario, affectedFaction(battle)).color;
  const result = resultKeyOf(scenario, battle);
  return (
    <div className="battle-engagement" data-result={result}>
      {labelled ? (
        <p className="battle-engagement-heading">
          <span aria-hidden="true" className="battle-medallion" dangerouslySetInnerHTML={{ __html: medallionMarkup(result, ring) }} />
          {`${factionName(scenario, battle.attackerFactionId)} attack: ${battleTitle(scenario, battle)}`}
        </p>
      ) : null}
      <BattleSides battle={battle} scenario={scenario} />
      <BattleRoll battle={battle} scenario={scenario} />
      <BattleEffects battle={battle} scenario={scenario} />
    </div>
  );
}
