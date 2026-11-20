import { type JSX, type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { subTerritoriesOf } from "../../engine/partition/holders";
import { isAircraft, plannedBuilds } from "../../state/planning";
import type { Scenario, TerritoryId } from "../../engine/types";
import type { PlanningSession } from "../../state/planning";
import { BuildTab } from "./BuildTab";
import { RecruitTab } from "./RecruitTab";
import { TerritoryHeading } from "./TerritoryHeading";

type TabId = "units" | "build" | "recruit";

export interface TerritoryTabProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly territoryId: TerritoryId;
}

const labels: Readonly<Record<TabId, string>> = { build: "Build", recruit: "Recruit", units: "Units" };

/**
 * M6 (`ux-pane-a-units`): the count on a tab, or undefined for none. Units: the viewer's units
 * here (aircraft are in the air pane). Build: the viewer's sub-territories here with work queued,
 * this turn's plans included.
 */
export function tabCount(tab: TabId, { scenario, session, territoryId }: TerritoryTabProps): number | undefined {
  const viewer = session.factionId;
  if (tab === "units") {
    const { state } = session.game;
    return Object.values(state.units).filter((unit) => unit.factionId === viewer && unit.territoryId === territoryId && !isAircraft(scenario, state, unit.id)).length;
  }
  if (tab === "build") {
    // Cheap on every render: the board's queues and this turn's planned builds, not a full preview.
    const planned = new Set(plannedBuilds(session).map((order) => order.subTerritoryId));
    const sites = session.game.state.subTerritories;
    return subTerritoriesOf(scenario, territoryId).filter((sub) => {
      const site = sites[sub.id];
      return site?.holder === viewer && (site.queue.length > 0 || planned.has(sub.id));
    }).length;
  }
  return undefined;
}

/** m2, the WAI-ARIA tabs pattern: the arrow keys, Home and End move between tabs and open them. */
function nextTab(tabs: readonly TabId[], current: TabId, key: string): TabId | undefined {
  const index = tabs.indexOf(current);
  if (key === "ArrowRight") return tabs[(index + 1) % tabs.length];
  if (key === "ArrowLeft") return tabs[(index - 1 + tabs.length) % tabs.length];
  if (key === "Home") return tabs[0];
  if (key === "End") return tabs[tabs.length - 1];
  return undefined;
}

/**
 * X3: the territory pane's tabs, opening on Units. Build is offered when the scenario has an
 * economy module and Recruit when it has a recruitment module; with neither, the pane shows the
 * units alone, as in Milestone 2. The territory's heading and meta row (`TerritoryHeading`) sit
 * above the tab list, so they show on every tab. Remount it (key) per territory so each opens on
 * Units.
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
  const list = useRef<HTMLDivElement>(null);
  if (tabs.length === 1) {
    return (
      <>
        <TerritoryHeading {...props} />
        {children}
      </>
    );
  }
  return (
    <div className="pane-tabs">
      <div className="territory-heading">
        <TerritoryHeading {...props} />
      </div>
      <div
        aria-label="Territory"
        className="pane-tab-list"
        onKeyDown={(event: KeyboardEvent) => {
          const next = nextTab(tabs, open, event.key);
          if (next === undefined) return;
          event.preventDefault();
          setOpen(next);
          list.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus();
        }}
        ref={list}
        role="tablist"
      >
        {tabs.map((tab) => {
          const count = tabCount(tab, props);
          return (
            <button
              aria-controls={`${id}-${tab}`}
              aria-selected={open === tab}
              className="pane-tab"
              data-tab={tab}
              id={`${id}-${tab}-tab`}
              key={tab}
              onClick={() => { setOpen(tab); }}
              role="tab"
              tabIndex={open === tab ? 0 : -1}
              type="button"
            >
              {labels[tab]}
              {count === undefined || count === 0 ? null : <>{" "}<span className="pane-tab-count">{count}</span></>}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div aria-labelledby={`${id}-${tab}-tab`} className="pane-tab-panel" hidden={open !== tab} id={`${id}-${tab}`} key={tab} role="tabpanel">
          {tab === "units" ? children : null}
          {tab === "build" && open === "build" ? <BuildTab {...props} /> : null}
          {tab === "recruit" ? <RecruitTab {...props} /> : null}
        </div>
      ))}
    </div>
  );
}
