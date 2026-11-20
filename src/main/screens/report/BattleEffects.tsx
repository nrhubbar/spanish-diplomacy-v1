import type { JSX } from "react";
import type { D6BattleOutcome, Scenario } from "../../engine/types";
import { formatMen } from "../../presentation/battleText";
import { territoryName, unitName } from "../../presentation/text";

type EffectKind = "loss" | "destroyed" | "demoralized" | "retreat" | "surrendered";

interface Effect {
  readonly kind: EffectKind;
  readonly text: string;
}

function effect(kind: EffectKind, text: string): Effect {
  return { kind, text };
}

/** What the result did to each army: men lost, destroyed, demoralized, retreated, surrendered. */
export function BattleEffects({ battle, scenario }: { readonly battle: D6BattleOutcome; readonly scenario: Scenario }): JSX.Element {
  const effects: readonly Effect[] = [
    ...battle.losses.map((loss) => loss.destroyed
      ? effect("destroyed", `${unitName(scenario, loss.unitId)} was destroyed, losing ${formatMen(loss.men)} men.`)
      : effect("loss", `${unitName(scenario, loss.unitId)} lost ${formatMen(loss.men)} men.`)),
    ...battle.demoralizedUnitIds.map((id) => effect("demoralized", `${unitName(scenario, id)} was demoralized.`)),
    ...battle.retreats.map((retreat) => effect("retreat", `${unitName(scenario, retreat.unitId)} fell back to ${territoryName(scenario, retreat.to)}.`)),
    ...battle.surrenderedUnitIds.map((id) => effect("surrendered", `${unitName(scenario, id)} had nowhere to fall back and surrendered.`))
  ];
  return effects.length === 0 ? (
    <p className="battle-effects-none">No army lost men or morale.</p>
  ) : (
    <ul className="battle-effects">
      {effects.map((effect, index) => <li data-effect={effect.kind} key={`${effect.kind}-${String(index)}`}>{effect.text}</li>)}
    </ul>
  );
}
