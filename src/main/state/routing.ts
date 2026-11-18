import type { Phase, Session } from "./session";

export const paths = {
  gameOver: "/game-over",
  handoff: "/handoff",
  home: "/",
  orders: "/orders",
  resolution: "/resolution",
  reveal: "/reveal",
  settings: "/settings",
  setup: "/setup"
} as const;

const phaseRoutes: Readonly<Record<Phase, string>> = {
  "game-over": paths.gameOver,
  handoff: paths.handoff,
  idle: paths.home,
  planning: paths.orders,
  "ready-to-resolve": paths.reveal,
  resolution: paths.resolution,
  setup: paths.setup
};

/** The one place that maps session state to a screen (R5). */
export function routeForSession(session: Session): string {
  return phaseRoutes[session.phase];
}

/** Settings is reachable outside a game; every other path must match the session. */
export function isPathAllowed(session: Session, pathname: string): boolean {
  if (pathname === paths.settings) {
    return session.phase === "idle" || session.phase === "setup";
  }
  return pathname === routeForSession(session);
}
