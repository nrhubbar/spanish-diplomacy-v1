import type { UnknownAction } from "@reduxjs/toolkit";
import type { ClientCommand } from "../game/client";
import type { GameCommand } from "../game/types";
import { beginPlanning, endTurn, exitGame, type GameState, openSetup, returnHome, startGame, startNextTurn, viewReceived } from "./gameSlice";
import { submittedDraftOrders } from "./planning";
import type { InGameSession, Session } from "./session";
import { timeRanOut } from "./timeout";
import { pauseClock, resumeClock, startClock, type TimerState } from "./timerSlice";

export interface Commanding {
  readonly game: GameState;
  readonly timer: TimerState;
}

function inGame(session: InGameSession, command: GameCommand): ClientCommand {
  return { command, gameId: session.game.gameId, kind: "game" };
}

function advance(game: GameState): readonly ClientCommand[] {
  const { view } = game;
  // Nobody here plans: the player only watches, and asks for each turn.
  if (view === undefined || view.status === "ended" || Object.values(view.assignments).some((kind) => kind !== "computer")) return [];
  return [{ command: { kind: "advance", turnNumber: view.state.turnNumber }, gameId: view.gameId, kind: "game" }];
}

const draftJson = (session: Session): string => (session.phase === "planning" ? JSON.stringify(submittedDraftOrders(session.draft)) : "");

/** What one action asks of the game's host, from the state before and after it. `revision` numbers the saves. */
export function commandsFor(before: Commanding, after: Commanding, action: UnknownAction, revision: number): readonly ClientCommand[] {
  const { session } = before.game;
  if (startGame.match(action)) {
    const setup = after.game.session;
    if (session.phase !== "setup" || setup.phase !== "setup" || setup.feedback !== undefined) return [];
    const { seed } = action.payload as { readonly seed?: string };
    return [{ assignments: setup.assignments, kind: "create", scenarioId: setup.scenarioId, timerMinutes: after.timer.minutes, ...(seed === undefined ? {} : { seed }) }];
  }
  if (viewReceived.match(action)) return action.payload.report === undefined ? advance(after.game) : [];
  if (startNextTurn.match(action)) return session.phase === "resolution" ? advance(after.game) : [];
  if (exitGame.match(action) || openSetup.match(action) || returnHome.match(action)) return before.game.view === undefined ? [] : [{ gameId: before.game.view.gameId, kind: "leave" }];
  if (session.phase === "handoff") {
    return beginPlanning.match(action) ? [inGame(session, { factionId: session.factionId, kind: "open", turnNumber: session.game.state.turnNumber })] : [];
  }
  if (session.phase !== "planning") return [];
  const seat = { factionId: session.factionId, turnNumber: session.game.state.turnNumber };
  if (endTurn.match(action)) return [inGame(session, { ...seat, kind: "end-turn", orders: submittedDraftOrders(session.draft), revision })];
  if (timeRanOut.match(action)) return [inGame(session, { kind: "expire", turnNumber: seat.turnNumber })];
  if (startClock.match(action)) return [inGame(session, { ...seat, kind: "open" })];
  if (pauseClock.match(action)) return [inGame(session, { ...seat, kind: "pause" })];
  if (resumeClock.match(action)) return [inGame(session, { ...seat, kind: "resume" })];
  // Orders are saved as the player changes them, so whatever is planned when time runs out counts.
  const planned = after.game.session;
  if (planned.phase !== "planning" || planned.draft === session.draft || planned.factionId !== seat.factionId || planned.game.state.turnNumber !== seat.turnNumber) return [];
  if (draftJson(session) === draftJson(planned)) return [];
  return [inGame(planned, { ...seat, kind: "save-orders", orders: submittedDraftOrders(planned.draft), revision })];
}
