import { recoverMorale } from "../morale";
import { digIn } from "../works";
import type { Phase } from "./draft";

/** Step 9 (M22, M23): morale recovery and digging in. The d6 preset's part (`modules/dice.ts`). */
export const updateMorale: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const moved = draft.orders.origins.keys();
  const retreated = draft.settled.flatMap((entry) => (entry.kind === "retreated" ? [entry.leaving.unitId] : []));
  const pending = [...draft.front.battles, ...draft.standing];
  const demoralized = [...draft.meetings.battles.flatMap((battle) => battle.demoralizedUnitIds), ...pending.flatMap((battle) => battle.report.demoralizedUnitIds)];
  const morale = recoverMorale(scenario, draft.armies, new Set([...moved, ...retreated, ...demoralized]));
  const foughtIn = new Set(pending.map((battle) => battle.site.territoryId));
  const fortification = digIn(scenario, start, { armies: morale.armies, control: draft.control.control }, foughtIn, new Set(draft.orders.origins.keys()));
  return { ...draft, armies: morale.armies, fortification, recovered: morale.recovered };
};
