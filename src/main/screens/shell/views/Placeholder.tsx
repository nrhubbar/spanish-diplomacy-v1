import type { JSX } from "react";
import { paneViewTitle } from "../paneTitles";
import type { PaneViewProps } from "./types";

/** A view whose screen is still being built: its title and a short note. */
export function PlaceholderView({ scenario, view }: PaneViewProps): JSX.Element {
  return (
    <section className="pane-section" data-placeholder={view.kind}>
      <p className="pane-hint">{`${paneViewTitle(scenario, view)} is not ready yet.`}</p>
    </section>
  );
}
