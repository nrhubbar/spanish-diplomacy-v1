import type { UnknownAction } from "@reduxjs/toolkit";
import { type JSX, useCallback, useMemo, useState } from "react";
import { reachFor } from "../../engine/network/reach";
import type { Scenario, TerritoryId } from "../../engine/types";
import type { MapView, PointerInput } from "../../map/view";
import { quickActions, type QuickActionKind, type QuickActionMenu as Menu } from "../../presentation/quickActions";
import { reachNote } from "../../presentation/reachNote";
import type { MapPoint } from "../../scenarios/loader";
import { cancelOrderStage } from "../../state/gameSlice";
import { type PaneView, pushView } from "../../state/paneSlice";
import { airDraftOrders, type PlanningSession } from "../../state/planning";
import { QuickActionMenu } from "./QuickActionMenu";
import { ReachHoverCard, ReachModal } from "./ReachCard";

/** U5: the pane view each quick action opens. */
export function quickActionView(kind: QuickActionKind, territoryId: TerritoryId): PaneView {
  switch (kind) {
    case "invade":
    case "reinforce":
      return { kind, target: territoryId };
    case "recruit":
      return { kind: "recruit", territory: territoryId };
    case "build":
      return { kind: "build", territory: territoryId };
    case "info":
      return { id: territoryId, kind: "territory" };
  }
}

export interface MapActions {
  /** The map's right-click, long-press and hover callbacks (hover only while a Move is being given). */
  readonly handlers: Pick<MapView, "onTerritoryHover" | "onTerritoryMenu">;
  /** U7: a tap while giving a Move; on a phone, an unreachable territory's reasons open in a card. */
  readonly onTap: (territoryId: TerritoryId, input?: PointerInput) => void;
  /** The menu, the hover card or the phone's reach card, drawn over the map. */
  readonly overlay: JSX.Element | null;
}

/**
 * U5, U7 on the planning map: the quick-action menu (right-click or long-press), and while a Move
 * is being given, why a territory is out of reach (on hover, or in a card when tapped on a phone).
 */
export function useMapActions(scenario: Scenario, session: PlanningSession, dispatch: (action: UnknownAction) => unknown): MapActions {
  const { draft, factionId, game } = session;
  const [menu, setMenu] = useState<{ readonly at: MapPoint; readonly input: PointerInput; readonly menu: Menu } | undefined>(undefined);
  const [hover, setHover] = useState<{ readonly at: MapPoint; readonly territoryId: TerritoryId } | undefined>(undefined);
  const [tapped, setTapped] = useState<TerritoryId | undefined>(undefined);
  const moving = draft.stage?.orderKind === "move" && draft.selectedUnitIds.length > 0;
  const reach = useMemo(
    () => (moving ? reachFor(scenario, game.state, factionId, draft.selectedUnitIds) : undefined),
    [draft.selectedUnitIds, factionId, game.state, moving, scenario]
  );
  const noteFor = useCallback((territoryId: TerritoryId) => reachNote(scenario, territoryId, reach?.get(territoryId)), [reach, scenario]);

  const onTerritoryMenu = useCallback((territoryId: TerritoryId, at: MapPoint, input: PointerInput) => {
    setHover(undefined);
    setMenu({ at, input, menu: quickActions(scenario, game.state, factionId, territoryId, { airOrders: airDraftOrders(draft), orders: draft.orders }) });
  }, [draft, factionId, game.state, scenario]);
  const onTerritoryHover = useCallback((territoryId: TerritoryId | undefined, at: MapPoint) => {
    setHover(territoryId === undefined || noteFor(territoryId) === undefined ? undefined : { at, territoryId });
  }, [noteFor]);
  const onTap = useCallback((territoryId: TerritoryId, input?: PointerInput) => {
    if (input === "touch" && noteFor(territoryId) !== undefined) setTapped(territoryId);
  }, [noteFor]);
  const closeMenu = useCallback(() => { setMenu(undefined); }, []);
  const closeTapped = useCallback(() => { setTapped(undefined); }, []);
  const choose = useCallback((kind: QuickActionKind, territoryId: TerritoryId) => {
    if (draft.stage !== undefined) dispatch(cancelOrderStage());
    dispatch(pushView(quickActionView(kind, territoryId)));
    setMenu(undefined);
  }, [dispatch, draft.stage]);

  const hoverNote = moving && hover !== undefined ? noteFor(hover.territoryId) : undefined;
  const tappedNote = moving && tapped !== undefined ? noteFor(tapped) : undefined;
  const overlay = menu !== undefined
    ? <QuickActionMenu at={menu.at} input={menu.input} menu={menu.menu} onChoose={(kind) => { choose(kind, menu.menu.territoryId); }} onClose={closeMenu} />
    : tappedNote !== undefined
      ? <ReachModal note={tappedNote} onClose={closeTapped} />
      : hoverNote !== undefined && hover !== undefined
        ? <ReachHoverCard at={hover.at} note={hoverNote} />
        : null;
  const handlers = useMemo(() => (moving ? { onTerritoryHover, onTerritoryMenu } : { onTerritoryMenu }), [moving, onTerritoryHover, onTerritoryMenu]);
  return {
    handlers,
    onTap,
    overlay
  };
}
