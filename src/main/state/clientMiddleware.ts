import type { Middleware } from "@reduxjs/toolkit";
import type { GameClient } from "../game/client";
import { type Commanding, commandsFor } from "./commands";

/** Sends the game's host what each action asks of it. The answer comes back as `viewReceived`. */
export function createClientMiddleware(client: GameClient | undefined): Middleware {
  let revision = 0;
  return (api) => (next) => (action) => {
    const before = api.getState() as Commanding;
    const result = next(action);
    const after = api.getState() as Commanding;
    revision = Math.max(revision, after.game.view?.saved?.revision ?? 0) + 1;
    for (const command of commandsFor(before, after, action as Parameters<typeof commandsFor>[2], revision)) client?.send(command);
    return result;
  };
}
