import { Fragment, type JSX, useEffect, useRef } from "react";
import type { GameState, Scenario } from "../../engine/types";
import { type BattleGroup, type BattleKind, decisiveBattle } from "../../presentation/battle";
import { cardFlavor, flavorSeed, occupationLine, placeName } from "../../presentation/battleText";
import { emblemMarkup } from "../../presentation/outcomeArt";
import { battleTitle, resultKeyOf } from "../../presentation/grades";
import { BattleAir } from "./BattleAir";
import { BattleEngagement } from "./BattleEngagement";
import { BattleRule } from "./BattleRule";
import { revealInPane } from "./focus";

interface BattleCardProps {
  readonly finalState: GameState;
  /** F1: the card is about the place the player focused on the map. */
  readonly focused: boolean;
  readonly group: BattleGroup;
  /** Controlled, so focusing a place can open a collapsed card. */
  readonly open: boolean;
  readonly onToggle: (open: boolean) => void;
  /** Scroll the card into the pane's view: the first card of a newly focused place. */
  readonly reveal: boolean;
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
export function BattleCard({ finalState, focused, group, onToggle, open, reveal, scenario, seed }: BattleCardProps): JSX.Element {
  const card = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (reveal && card.current !== null) revealInPane(card.current);
  }, [reveal]);
  const lead = decisiveBattle(group);
  const result = resultKeyOf(scenario, lead.battle);
  const several = group.battles.length > 1;
  const line = cardFlavor(scenario, lead.battle, flavorSeed(seed, finalState.turnNumber, lead.index));
  return (
    <details
      className="battle-card"
      data-battle-kind={group.kind}
      data-focused={focused}
      data-places={placesOf(group).join(" ")}
      data-dice={lead.battle.dice}
      data-result={result}
      data-sides={several ? group.battles.length + 1 : 2}
      // Read the element, not a flipped flag: the event also fires when React sets `open`.
      onToggle={(event) => { onToggle(event.currentTarget.open); }}
      open={open}
      ref={card}
    >
      <summary className="battle-card-summary">
        <span aria-hidden="true" className="battle-emblem" dangerouslySetInnerHTML={{ __html: emblemMarkup(result) }} />
        <span className="battle-card-heading">
          <span className="battle-kicker">{`${kindLabels[group.kind]} ${placeName(scenario, lead.battle)}`}</span>
          <span className="battle-title">{battleTitle(scenario, lead.battle)}</span>
          <span className="battle-occupation">{occupationLine(scenario, lead.battle)}</span>
        </span>
      </summary>
      <div className="battle-card-body">
        <p className="battle-flavor">{line}</p>
        {group.battles.map((entry) => (
          <Fragment key={entry.index}>
            {entry.air === undefined ? null : <BattleAir air={entry.air} scenario={scenario} />}
            <BattleEngagement battle={entry.battle} labelled={several} scenario={scenario} />
          </Fragment>
        ))}
        <BattleRule finalState={finalState} group={group} scenario={scenario} />
      </div>
    </details>
  );
}

/** The territories a card is about, for focusing from the map: its territory, or both ends of a road. */
function placesOf(group: BattleGroup): readonly string[] {
  const site = group.battles[0]?.battle.site;
  if (site === undefined) return [];
  return site.kind === "meeting" ? site.between : [site.territoryId];
}
