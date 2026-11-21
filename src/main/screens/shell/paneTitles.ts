import type { Scenario, TerritoryId } from "../../engine/types";
import type { PaneView } from "../../state/paneSlice";
import { subTerritoryName } from "../../presentation/movement";
import { territoryName } from "../../presentation/text";

/** U3: each pane view's title, which the back link of the view above it also reads. */
export function paneViewTitle(scenario: Scenario, view: PaneView): string {
  const named = (prefix: string, id: TerritoryId): string => `${prefix} ${territoryName(scenario, id)}`;
  switch (view.kind) {
    case "thisTurn":
      return "This turn";
    case "territory":
      // The territory's own heading sits right below, in the view (`TerritoryHeading`).
      return "Territory info";
    case "invade":
      return named("Invade", view.target);
    case "reinforce":
      return named("Reinforce", view.target);
    case "build":
      return view.subTerritory === undefined ? named("Build in", view.territory) : `Build in ${subTerritoryName(scenario, view.subTerritory)}`;
    case "recruit":
      return named("Recruit in", view.territory);
    case "recruitment":
      return "Recruitment";
    case "building":
      return "Building";
    case "lastTurn":
      return "Last turn";
  }
}
