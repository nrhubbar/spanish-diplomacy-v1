import type { PlayerView } from "../game/types";
import type { GameState } from "./gameSlice";
import { draftFrom } from "./planning";
import type { Session } from "./session";

/**
 * The screen a player's view calls for: a report they have not read, a seat of theirs still to
 * plan (behind a handoff when its view is not open yet), or, with nothing to do, the screen they
 * were on. A view of the turn already being planned keeps the player's draft; one
 * opened afresh (after a reload, or on another device) takes up the orders last saved.
 */
export function sessionFromView({ readTurn, session: previous }: GameState, view: PlayerView): Session {
  const { report } = view;
  if (report !== undefined && (report.turnNumber !== readTurn || view.status === "ended")) {
    const game = { ...view, history: view.history.filter((turn) => turn.turnNumber !== report.turnNumber), state: report.finalState };
    return { game, phase: view.status === "ended" ? "game-over" : "resolution", result: report };
  }
  const next = view.seats.find((seat) => !view.ready.includes(seat));
  if (next === undefined) return previous.phase === "planning" ? { ...previous, game: view } : previous;
  const planning = previous.phase === "planning" && previous.game.gameId === view.gameId && previous.game.state.turnNumber === view.state.turnNumber ? previous : undefined;
  if (view.viewer === next) return planning?.factionId === next ? { ...planning, game: view } : { draft: draftFrom(view.saved?.orders ?? []), factionId: next, game: view, phase: "planning" };
  return { factionId: next, game: view, phase: "handoff", ...(planning === undefined ? {} : { fromFactionId: planning.factionId }) };
}
