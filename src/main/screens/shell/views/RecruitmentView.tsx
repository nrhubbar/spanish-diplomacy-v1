import type { JSX } from "react";
import { GlobalRecruitment } from "../../queues/GlobalRecruitment";
import type { PaneViewProps } from "./types";

/** U3, U9: the pane's "recruitment" view, Global Recruitment. */
export function RecruitmentView({ scenario, session }: PaneViewProps): JSX.Element {
  return <GlobalRecruitment scenario={scenario} session={session} />;
}
