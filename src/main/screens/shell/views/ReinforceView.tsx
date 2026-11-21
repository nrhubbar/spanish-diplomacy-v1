import type { JSX } from "react";
import type { PaneView } from "../../../state/paneSlice";
import { MusterView } from "../../actions/MusterView";
import type { PaneViewProps } from "./types";

/** U3, U6: the pane's "reinforce" view, the Reinforce pane. A new target starts with fresh ticks. */
export function ReinforceView({ scenario, session, view }: Omit<PaneViewProps, "view"> & { readonly view: Extract<PaneView, { readonly kind: "reinforce" }> }): JSX.Element {
  return <MusterView key={view.target} kind="reinforce" scenario={scenario} session={session} target={view.target} />;
}
