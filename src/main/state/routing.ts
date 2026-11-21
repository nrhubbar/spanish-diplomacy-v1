import type { Phase, Session } from "./session";

export const paths = {
  gameOver: "/game-over",
  handoff: "/handoff",
  home: "/",
  orders: "/orders",
  resolution: "/resolution",
  settings: "/settings",
  setup: "/setup"
} as const;

const phaseRoutes: Readonly<Record<Phase, string>> = {
  "game-over": paths.gameOver,
  handoff: paths.handoff,
  idle: paths.home,
  planning: paths.orders,
  resolution: paths.resolution,
  setup: paths.setup
};

/** The one place that maps session state to a screen (R5). */
export function routeForSession(session: Session): string {
  return phaseRoutes[session.phase];
}

/** Settings is reachable at any time (U1: from the game's menu too); every other path must match the session. */
export function isPathAllowed(session: Session, pathname: string): boolean {
  return pathname === paths.settings || pathname === routeForSession(session);
}
