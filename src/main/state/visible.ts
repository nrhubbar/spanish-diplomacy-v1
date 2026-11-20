import type { FactionId, Scenario } from "../engine/types";
import { ordersFor, outcomesFor, viewFor } from "../engine/visibility";
import { type InGameSession, isInGame, localPlayerCount, type Session } from "./session";

/**
 * Who is looking at an in-game screen. In hot-seat play it is the faction whose turn it is;
 * a turn report goes to the one local player, and with several local players (or none) it
 * shows only public information.
 */
export function sessionViewer(session: InGameSession): FactionId | undefined {
  if (session.phase === "planning" || session.phase === "handoff") return session.factionId;
  const locals = Object.entries(session.game.assignments).filter(([, kind]) => kind === "local-human").map(([id]) => id as FactionId);
  return localPlayerCount(session.game.assignments) === 1 ? locals[0] : undefined;
}

/**
 * $6, U4: the session as its viewer may see it, the one source every screen reads. The game
 * state and the report's final state go through `viewFor`, outcomes through `outcomesFor`,
 * submitted orders through `ordersFor`, and other factions' locked submissions keep only their
 * readiness until the turn reveals them.
 */
export function visibleSession<S extends Session>(scenario: Scenario, session: S): S {
  if (!isInGame(session)) return session;
  const viewer = sessionViewer(session);
  const { game } = session;
  const state = viewFor(scenario, game.state, viewer);
  const visibleGame = {
    ...game,
    history: game.history.map((entry) => ({ ...entry, outcomes: outcomesFor(scenario, game.state, entry.outcomes, viewer) })),
    // Readiness is public; the orders stay private until the turn reveals them.
    locked: Object.fromEntries(Object.entries(game.locked).map(([factionId, submission]) =>
      [factionId, factionId === viewer ? submission : { factionId: submission.factionId, orders: [] }])),
    state
  };
  if (session.phase === "resolution" || session.phase === "game-over") {
    const { result } = session;
    const visibleResult = {
      ...result,
      finalState: viewFor(scenario, result.finalState, viewer),
      outcomes: outcomesFor(scenario, result.finalState, result.outcomes, viewer),
      submittedOrders: ordersFor(scenario, game.state, result.submittedOrders, viewer)
    };
    return { ...session, game: visibleGame, result: visibleResult };
  }
  return { ...session, game: visibleGame };
}
