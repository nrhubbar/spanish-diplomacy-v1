import type { FactionId } from "../engine/types";
import { type InGameSession, localPlayerCount } from "./session";

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
