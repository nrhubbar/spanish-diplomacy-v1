import type { Scenario } from "../../../engine/types";
import type { PaneView } from "../../../state/paneSlice";
import type { PlanningSession } from "../../../state/planning";

/** What every pane view is given (U3). A view owned by a later stream narrows `view` to its kind. */
export interface PaneViewProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly view: PaneView;
}
