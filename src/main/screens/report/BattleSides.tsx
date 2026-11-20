import type { JSX } from "react";
import { requireFaction } from "../../engine/lookup";
import type { D6BattleOutcome, BattleSide, Scenario, TerritoryId } from "../../engine/types";
import { sideFactions } from "../../presentation/battle";
import { glyphs } from "../../presentation/glyphs";
import { cssVariables } from "../../presentation/style";
import { factionName, listNames, territoryName, unitName } from "../../presentation/text";

/** Both sides of one battle: factions, each army with its value, and the side totals. */
export function BattleSides({ battle, scenario }: { readonly battle: D6BattleOutcome; readonly scenario: Scenario }): JSX.Element {
  const site = battle.site.kind === "meeting" ? undefined : battle.site.territoryId;
  return (
    <div className="battle-sides">
      <SideBlock role="Attacker" scenario={scenario} side={battle.attacker} site={site} value="attack" />
      <SideBlock role="Defender" scenario={scenario} side={battle.defender} site={site} value="defence" />
    </div>
  );
}

interface SideBlockProps {
  readonly role: string;
  readonly scenario: Scenario;
  readonly side: BattleSide;
  /** The battle territory; armies that fought from elsewhere name their origin. */
  readonly site: TerritoryId | undefined;
  readonly value: string;
}

function SideBlock({ role, scenario, side, site, value }: SideBlockProps): JSX.Element {
  const factions = sideFactions(side);
  const color = factions[0] === undefined ? "#5b4d40" : requireFaction(scenario, factions[0]).color;
  return (
    <div className="battle-side" style={cssVariables({ "--faction-color": color })}>
      <p className="battle-side-head">
        <span className="battle-side-role">{role}</span>
        <span className="battle-side-faction">{listNames(factions.map((id) => factionName(scenario, id)))}</span>
        <span className="battle-side-value">
          <span className="visually-hidden">{`total ${value} `}</span>
          {String(side.value)}
        </span>
      </p>
      <ul className="battle-armies">
        {side.armies.map((army) => (
          <li key={army.unitId}>
            <span>
              {unitName(scenario, army.unitId)}
              {army.from === site ? null : <span className="battle-army-from">{` ${glyphs.dot} from ${territoryName(scenario, army.from)}`}</span>}
            </span>
            <span className="battle-army-value">
              <span className="visually-hidden">{`${value} `}</span>
              {String(army.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
