import { type JSX, type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";
import { subTerritoriesIn } from "../../presentation/holdings";
import type { Scenario, SubTerritoryId, TerritoryId } from "../../engine/types";
import type { TerritoryTab } from "../../state/paneSlice";
import { isAircraft, plannedBuilds } from "../../state/planning";
import type { PlanningSession } from "../../state/planning";
import { BuildingsTab } from "./BuildingsTab";
import { ProductionTab } from "./ProductionTab";
import { RecruitTab } from "./RecruitTab";
import { TerritoryHeading } from "./TerritoryHeading";

export interface TerritoryTabProps {
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly territoryId: TerritoryId;
}

const labels: Readonly<Record<TerritoryTab, string>> = { buildings: "Buildings", production: "Production", recruit: "Recruit", units: "Units" };

/**
 * M6: the count on a tab, or undefined for none. Units: the viewer's units here (aircraft are in
 * the air pane). Buildings: the viewer's sub-territories here with work queued, this turn's
 * plans included. Recruit: the viewer's units training here and this turn's Recruit orders.
 */
export function tabCount(tab: TerritoryTab, { scenario, session, territoryId }: TerritoryTabProps): number | undefined {
  const viewer = session.factionId;
  const { state } = session.game;
  switch (tab) {
    case "units":
      return Object.values(state.units).filter((unit) => unit.factionId === viewer && unit.territoryId === territoryId && !isAircraft(scenario, state, unit.id)).length;
    case "buildings": {
      // Cheap on every render: the board's queues and this turn's planned builds, not a full preview.
      const planned = new Set(plannedBuilds(session).map((order) => order.subTerritoryId));
      return subTerritoriesIn(scenario, territoryId).filter((sub) => {
        const site = state.subTerritories[sub.id];
        return site?.holder === viewer && (site.queue.some((item) => item.factionId === viewer) || planned.has(sub.id));
      }).length;
    }
    case "recruit":
      return state.training.filter((item) => item.factionId === viewer && item.territoryId === territoryId).length
        + (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId).length;
    case "production":
      return undefined;
  }
}

/** m2, the WAI-ARIA tabs pattern: the arrow keys, Home and End move between tabs and open them. */
function nextTab(tabs: readonly TerritoryTab[], current: TerritoryTab, key: string): TerritoryTab | undefined {
  const index = tabs.indexOf(current);
  if (key === "ArrowRight") return tabs[(index + 1) % tabs.length];
  if (key === "ArrowLeft") return tabs[(index - 1 + tabs.length) % tabs.length];
  if (key === "Home") return tabs[0];
  if (key === "End") return tabs[tabs.length - 1];
  return undefined;
}

/** The tabs a scenario offers: Buildings and Production with an economy, Recruit with recruitment. */
function territoryTabs(scenario: Scenario): readonly TerritoryTab[] {
  const { rules } = scenario;
  return [
    "units",
    ...(rules.economy === "none" ? [] : ["buildings" as const]),
    ...(rules.recruitment === "none" ? [] : ["recruit" as const]),
    ...(rules.economy === "none" ? [] : ["production" as const])
  ];
}

interface TerritoryTabsProps extends TerritoryTabProps {
  readonly children: ReactNode;
  /** The sub-territory focused on the map, here: Buildings opens with its card open, whenever it changes. */
  readonly focusedSite: SubTerritoryId | undefined;
  /** The sub-territory a Build view names: Buildings opens with its card open. */
  readonly initialSite: SubTerritoryId | undefined;
  /** The tab to open on (U9): the view's `tab`, else Units. An open sub-territory opens Buildings. */
  readonly tab: TerritoryTab | undefined;
}

/**
 * U9, X3: Territory Info's tabs: Units, Buildings, Recruit and Production. Buildings and
 * Production are offered when the scenario has an economy module and Recruit when it has a
 * recruitment module; with neither, the pane shows the units alone, as in Milestone 2. The
 * territory's heading (`TerritoryHeading`) sits above the tab list, so it shows on every tab.
 * The parent remounts it (key) per territory and view.
 */
export function TerritoryTabs({ children, focusedSite, initialSite, tab, ...props }: TerritoryTabsProps): JSX.Element {
  const tabs = territoryTabs(props.scenario);
  const site = focusedSite ?? initialSite;
  const wanted = site === undefined ? tab : "buildings";
  const [open, setOpen] = useState<TerritoryTab>(wanted !== undefined && tabs.includes(wanted) ? wanted : "units");
  // The open card lives here, not in Buildings, so leaving the tab and coming back keeps a closed card closed.
  const [card, setCard] = useState(site);
  const [seen, setSeen] = useState(focusedSite);
  // A sub-territory newly focused on the map opens Buildings and its card (React's "adjust state on a prop change").
  if (seen !== focusedSite) {
    setSeen(focusedSite);
    if (focusedSite !== undefined) setCard(focusedSite);
    if (focusedSite !== undefined && tabs.includes("buildings")) setOpen("buildings");
  }
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
        {tabs.map((entry) => {
          const count = tabCount(entry, props);
          return (
            <button
              aria-controls={`${id}-${entry}`}
              aria-selected={open === entry}
              className="pane-tab"
              data-tab={entry}
              id={`${id}-${entry}-tab`}
              key={entry}
              onClick={() => { setOpen(entry); }}
              role="tab"
              tabIndex={open === entry ? 0 : -1}
              type="button"
            >
              {labels[entry]}
              {count === undefined || (count === 0 && entry !== "recruit") ? null : <>{count === 0 ? "" : " "}<span className="pane-tab-count" data-empty={count === 0}>{count === 0 ? null : count}</span></>}
            </button>
          );
        })}
      </div>
      {tabs.map((entry) => (
        <div aria-labelledby={`${id}-${entry}-tab`} className="pane-tab-panel" hidden={open !== entry} id={`${id}-${entry}`} key={entry} role="tabpanel">
          {entry === "units" ? children : null}
          {entry === "buildings" && open === "buildings" ? <BuildingsTab {...props} expanded={card} onExpand={setCard} /> : null}
          {entry === "recruit" ? <RecruitTab {...props} /> : null}
          {entry === "production" && open === "production" ? <ProductionTab {...props} /> : null}
        </div>
      ))}
    </div>
  );
}
