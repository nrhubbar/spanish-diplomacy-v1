import type { FactionId, Scenario, ScenarioId } from "../engine/types";
import type { ClientCommand, CreateGame, GameClient, GameEvent } from "./client";
import { givenSeed } from "./client";
import { parseCommand } from "./commandSchema";
import { playerView } from "./projection";
import { applyCommand, createGame } from "./service";
import type { GameCommand, GameId, GameRecord, PlayerId, RollScheme, Seat } from "./types";

/**
 * Runs the game service in this process behind the same `GameClient` a remote one will have:
 * what the cloud's functions do with a record, this does with a variable. Every command crosses
 * as plain JSON and is parsed, so nothing works here that would not work over a network.
 */

export interface LocalHostOptions {
  readonly now?: () => number;
  /** A fresh secret seed, unguessable in the app. */
  readonly randomSeed: () => string;
  readonly rollScheme?: RollScheme;
  readonly scenario: (id: ScenarioId) => { readonly scenario: Scenario; readonly version: string };
}

export interface LocalHost extends GameClient {
  /** Takes over a record made elsewhere, and says who sees it. */
  readonly adopt: (record: GameRecord, opened?: FactionId) => void;
  readonly record: () => GameRecord | undefined;
}

const device = "this-device" as PlayerId;

export function createLocalHost({ now = Date.now, randomSeed, rollScheme = "keyed-1", scenario }: LocalHostOptions): LocalHost {
  const listeners = new Set<(event: GameEvent) => void>();
  let record: GameRecord | undefined;
  let opened: FactionId | undefined;
  let made = 0;

  const emit = (event: GameEvent): void => {
    const sent = JSON.parse(JSON.stringify(event)) as GameEvent;
    for (const listener of [...listeners]) listener(sent);
  };
  const push = (): void => {
    if (record !== undefined) emit({ kind: "view", view: playerView(scenario(record.scenarioId).scenario, record, device, opened) });
  };

  const create = (command: CreateGame): void => {
    const { scenario: rules, version } = scenario(command.scenarioId);
    const chosen = givenSeed(command.seed);
    const seats = Object.fromEntries(rules.factions.map((faction): [FactionId, Seat] =>
      [faction.id, command.assignments[faction.id] === "computer" ? { kind: "computer" } : { kind: "human", playerId: device }]));
    made += 1;
    opened = undefined;
    record = createGame(rules, {
      gameId: `local-${String(made)}` as GameId,
      rollScheme,
      scenarioVersion: version,
      seats,
      seed: chosen ?? randomSeed(),
      seedChosen: chosen !== undefined,
      timerMinutes: command.timerMinutes
    }, now());
    push();
  };

  const play = (gameId: GameId, input: GameCommand): void => {
    if (record?.gameId !== gameId) { emit({ kind: "refused", refusal: { code: "unknown-game" } }); return; }
    const parsed = parseCommand(JSON.parse(JSON.stringify(input)));
    if (!parsed.ok) { emit({ kind: "refused", refusal: parsed.refusal }); return; }
    const { command } = parsed;
    const result = applyCommand(scenario(record.scenarioId).scenario, record, device, command, now());
    if (!result.ok) {
      emit({ kind: "refused", refusal: result.refusal, turnNumber: command.turnNumber });
      // The player is behind the game, so they are sent where it is now.
      if (result.refusal.code !== "bad-orders") push();
      return;
    }
    const moved = result.record.state.turnNumber !== record.state.turnNumber || result.record.status !== record.status;
    if (command.kind === "open") opened = command.factionId;
    // Between people on one device, the last player's view closes with their turn.
    else if (command.kind === "end-turn" || moved || result.record.orders[opened ?? ("" as FactionId)]?.ended === true) opened = undefined;
    // Asked for the time, the host always answers: a client whose clock ran ahead learns by how much.
    if (result.record === record && command.kind !== "open" && command.kind !== "expire") return;
    record = result.record;
    // A save changes nothing anyone can see; it is not pushed back over the player's own edits.
    if (command.kind !== "save-orders") push();
  };

  return {
    adopt: (taken, seat) => { record = taken; opened = seat; },
    record: () => record,
    send: (command: ClientCommand) => {
      switch (command.kind) {
        case "create":
          create(command);
          return;
        case "game":
          play(command.gameId, command.command);
          return;
        case "leave":
          if (record?.gameId === command.gameId) record = undefined;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}

/** A 128-bit seed from the platform's secure source, in hex. */
export function secureSeed(random: Pick<Crypto, "getRandomValues">): string {
  return [...random.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
