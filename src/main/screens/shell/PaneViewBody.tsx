import type { JSX } from "react";
import { BuildingView } from "./views/BuildingView";
import { BuildView } from "./views/BuildView";
import { InvadeView } from "./views/InvadeView";
import { LastTurnView } from "./views/LastTurnView";
import { RecruitmentView } from "./views/RecruitmentView";
import { RecruitView } from "./views/RecruitView";
import { ReinforceView } from "./views/ReinforceView";
import { TerritoryView } from "./views/TerritoryView";
import { ThisTurnView } from "./views/ThisTurnView";
import type { PaneViewProps } from "./views/types";

/**
 * U3: the body of the view on top of the pane stack. The views of later work (Invade,
 * Reinforce, Build, Recruit, Recruitment, Building) each live in their own file under `views/`.
 */
export function PaneViewBody(props: PaneViewProps): JSX.Element {
  const { view } = props;
  switch (view.kind) {
    case "thisTurn":
      return <ThisTurnView {...props} />;
    case "territory":
      return <TerritoryView scenario={props.scenario} session={props.session} tab={view.tab} territoryId={view.id} />;
    case "lastTurn":
      return <LastTurnView {...props} />;
    case "invade":
      return <InvadeView scenario={props.scenario} session={props.session} view={view} />;
    case "reinforce":
      return <ReinforceView scenario={props.scenario} session={props.session} view={view} />;
    case "build":
      return <BuildView scenario={props.scenario} session={props.session} view={view} />;
    case "recruit":
      return <RecruitView scenario={props.scenario} session={props.session} view={view} />;
    case "recruitment":
      return <RecruitmentView {...props} />;
    case "building":
      return <BuildingView {...props} />;
  }
}
