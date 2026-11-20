import { type JSX, type ReactNode, useId, useState } from "react";
import type { Scenario, TerritoryId } from "../../engine/types";
import type { PlanningSession } from "../../state/planning";
import { BuildTab } from "./BuildTab";
import { RecruitTab } from "./RecruitTab";

type TabId = "units" | "build" | "recruit";

export interface TerritoryTabProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly territoryId: TerritoryId;
}

const labels: Readonly<Record<TabId, string>> = { build: "Build", recruit: "Recruit", units: "Units" };

/**
 * X3: the territory pane's tabs, opening on Units. Build is offered when the scenario has an
 * economy module and Recruit when it has a recruitment module; with neither, the pane shows the
 * units alone, as in Milestone 2. Remount it (key) per territory so each opens on Units.
 */
export function TerritoryTabs({ children, ...props }: TerritoryTabProps & { readonly children: ReactNode }): JSX.Element {
  const { rules } = props.scenario;
  const tabs: readonly TabId[] = [
    "units",
    ...(rules.economy === "none" ? [] : ["build" as const]),
    ...(rules.recruitment === "none" ? [] : ["recruit" as const])
  ];
  const [open, setOpen] = useState<TabId>("units");
  const id = useId();
  if (tabs.length === 1) return <>{children}</>;
  return (
    <div className="pane-tabs">
      <div aria-label="Territory" className="pane-tab-list" role="tablist">
        {tabs.map((tab) => (
          <button
            aria-controls={`${id}-${tab}`}
            aria-selected={open === tab}
            className="pane-tab"
            id={`${id}-${tab}-tab`}
            key={tab}
            onClick={() => { setOpen(tab); }}
            role="tab"
            type="button"
          >
            {labels[tab]}
          </button>
        ))}
      </div>
      <div aria-labelledby={`${id}-${open}-tab`} className="pane-tab-panel" id={`${id}-${open}`} role="tabpanel">
        {open === "units" ? children : null}
        {open === "build" ? <BuildTab {...props} /> : null}
        {open === "recruit" ? <RecruitTab {...props} /> : null}
      </div>
    </div>
  );
}
