import { describe, expect, it } from "vitest";
import type { ClientCommand, GameClient, GameEvent } from "../main/game/client";
import type { Order } from "../main/engine/types";
import type { GameCommand } from "../main/game/types";
import { beginPlanning, clickMapTerritory, commandRefused, disbandUnit, endTurn, exitGame, openSetup, returnHome, selectAllAvailableUnits, setActorKind, startGame, startNextTurn, viewReceived } from "../main/state/gameSlice";
import { draftFrom, submittedDraftOrders } from "../main/state/planning";
import { emptyDraft } from "../main/state/session";
import { createAppStore } from "../main/state/store";
import { timeRanOut } from "../main/state/timeout";
import { chooseTimer, clockKey, pauseClock, resumeClock, startClock } from "../main/state/timerSlice";
import { faction, spainId, territory, testHost, testRegistry } from "./support";

/** A store on an in-process host, with every command it is sent. */
function playing() {
  const host = testHost();
  const sent: ClientCommand[] = [];
  const client: GameClient = { send: (command) => { sent.push(command); host.send(command); }, subscribe: host.subscribe };
  const store = createAppStore({ client, registry: testRegistry() });
  const inGame = (): GameCommand[] => sent.flatMap((command) => (command.kind === "game" ? [command.command] : []));
  return { host, inGame, sent, session: () => store.getState().game.session, store };
}

function start(kinds: Partial<Record<"north" | "republic" | "south", "computer" | "local-human">>, seed = "5") {
  const game = playing();
  game.store.dispatch(openSetup());
  for (const id of ["republic", "north", "south"] as const) game.store.dispatch(setActorKind({ factionId: faction(id), kind: kinds[id] ?? "computer" }));
  game.store.dispatch(startGame(seed));
  return game;
}

describe("what the screens ask of the game's host", () => {
  it("creates a game from the setup, and nothing from a setup that cannot start", () => {
    const { sent, session, store } = playing();
    store.dispatch(startGame("1"));
    store.dispatch(openSetup());
    store.dispatch(setActorKind({ factionId: faction("republic"), kind: "online-human" }));
    store.dispatch(startGame("1"));
    expect(sent).toEqual([]);
    expect(session()).toMatchObject({ feedback: { code: "player-needed", factionId: "republic" }, phase: "setup" });
    store.dispatch(setActorKind({ factionId: faction("republic"), kind: "local-human" }));
    store.dispatch(chooseTimer(5));
    store.dispatch(startGame());
    expect(sent).toMatchObject([{ kind: "create", scenarioId: spainId, timerMinutes: 5 }]);
    expect(sent[0]).not.toHaveProperty("seed");
    expect(session().phase).toBe("planning");
  });

  it("saves the orders each time they change, numbered upward, and not when only the selection does", () => {
    const { host, inGame, store } = start({ republic: "local-human" });
    store.dispatch(clickMapTerritory(territory("madrid")));
    store.dispatch(selectAllAvailableUnits());
    expect(inGame()).toEqual([]);
    const unit = Object.values(host.record()!.state.units).find((candidate) => candidate.factionId === faction("republic"))!;
    store.dispatch(disbandUnit(unit.id));
    const [first] = inGame();
    expect(first).toMatchObject({ factionId: "republic", kind: "save-orders", orders: [{ kind: "disband", unitId: unit.id }], turnNumber: 1 });
    expect(host.record()!.orders[faction("republic")]?.orders).toHaveLength(1);
    store.dispatch(endTurn());
    const ended = inGame().at(-1) as Extract<GameCommand, { readonly kind: "end-turn" }>;
    expect(ended).toMatchObject({ kind: "end-turn", orders: [{ kind: "disband" }] });
    expect(ended.revision).toBeGreaterThan((first as Extract<GameCommand, { readonly kind: "save-orders" }>).revision);
  });

  it("moves from planning to the report, and to the next turn when it is read", () => {
    const { session, store } = start({ republic: "local-human" });
    store.dispatch(endTurn());
    const report = session();
    if (report.phase !== "resolution") throw new Error("No report.");
    expect(report.game.state.turnNumber).toBe(1);
    expect(report.game.history).toEqual([]);
    store.dispatch(startNextTurn());
    expect(session()).toMatchObject({ draft: { orders: [] }, factionId: "republic", phase: "planning" });
    expect((session() as typeof report).game.state.turnNumber).toBe(2);
    expect((session() as typeof report).game.history.map((turn) => turn.turnNumber)).toEqual([1]);
  });

  it("hands the device over between people, opening each seat's view only when they take it", () => {
    const { inGame, session, store } = start({ north: "local-human", republic: "local-human" });
    expect(session()).toMatchObject({ factionId: "republic", game: { state: { treasuries: {} } }, phase: "handoff" });
    expect(session()).not.toHaveProperty("fromFactionId");
    store.dispatch(beginPlanning());
    expect(session()).toMatchObject({ factionId: "republic", phase: "planning" });
    store.dispatch(endTurn());
    expect(session()).toMatchObject({ factionId: "north", fromFactionId: "republic", game: { state: { treasuries: {} } }, phase: "handoff" });
    store.dispatch(beginPlanning());
    store.dispatch(endTurn());
    expect(session()).toMatchObject({ phase: "resolution", result: { finalState: { treasuries: {} } } });
    store.dispatch(startNextTurn());
    expect(session()).toMatchObject({ factionId: "republic", phase: "handoff" });
    expect(inGame().map((command) => command.kind)).toEqual(["open", "end-turn", "open", "end-turn"]);
  });

  it("asks for each turn of a game nobody here plays, to its end, and stops there", () => {
    const { inGame, session, store } = start({}, "1234");
    expect(session().phase).toBe("resolution");
    for (let turn = 0; turn < 20 && session().phase === "resolution"; turn += 1) store.dispatch(startNextTurn());
    expect(session().phase).toBe("game-over");
    expect(store.getState().game.view).toMatchObject({ seed: "1234", seedChosen: true, status: "ended" });
    const asked = inGame().length;
    store.dispatch(startNextTurn());
    expect(inGame()).toHaveLength(asked);
  });

  it("starts, pauses and resumes the host's clock, and lets it decide when time is up", () => {
    const { host, inGame, session, store } = playing();
    store.dispatch(openSetup());
    for (const id of ["republic", "north", "south"] as const) store.dispatch(setActorKind({ factionId: faction(id), kind: id === "republic" ? "local-human" : "computer" }));
    store.dispatch(chooseTimer(1));
    store.dispatch(startGame("5"));
    const { gameId } = host.record()!;
    store.dispatch(startClock({ budgetMs: 120_000, key: clockKey(gameId, 1, "republic"), now: Date.now() }));
    store.dispatch(pauseClock({ now: Date.now() }));
    store.dispatch(resumeClock({ now: Date.now() }));
    store.dispatch(timeRanOut());
    expect(inGame().map((command) => command.kind)).toEqual(["open", "pause", "resume", "expire"]);
    // The host's own clock has nearly two minutes left.
    expect(session().phase).toBe("planning");
    expect(store.getState().timer.clock).toMatchObject({ budgetMs: 120_000, warned: [] });
  });

  it("leaves the game when the player goes home, exits or sets up another, and ignores a late view", () => {
    for (const leave of [exitGame, returnHome, openSetup]) {
      const { host, sent, store } = start({ republic: "local-human" });
      const view = store.getState().game.view!;
      store.dispatch(leave());
      expect(sent.at(-1)).toEqual({ gameId: view.gameId, kind: "leave" });
      expect(host.record()).toBeUndefined();
      expect(store.getState().game.view).toBeUndefined();
    }
    const idle = playing();
    let emit: (event: GameEvent) => void = () => undefined;
    const store = createAppStore({ client: { send: () => undefined, subscribe: (listener) => { emit = listener; return () => undefined; } }, registry: testRegistry() });
    const { view } = start({ republic: "local-human" }).store.getState().game;
    emit({ kind: "view", view: view! });
    expect(store.getState().game.session.phase).toBe("idle");
    idle.store.dispatch(exitGame());
    expect(idle.sent).toEqual([]);
  });

  it("shows why the host refused orders, and keeps the plan", () => {
    const { session, store } = start({ republic: "local-human" });
    store.dispatch(commandRefused({ refusal: { code: "wrong-turn" } }));
    expect(session()).not.toMatchObject({ draft: { feedback: expect.anything() as unknown } });
        store.dispatch(commandRefused({ refusal: { code: "bad-orders", refusal: { code: "one-order-per-unit" } }, turnNumber: 7 }));
    expect(session()).not.toMatchObject({ draft: { feedback: expect.anything() as unknown } });
    store.dispatch(commandRefused({ refusal: { code: "bad-orders", refusal: { code: "one-order-per-unit" } }, turnNumber: 1 }));
    expect(session()).toMatchObject({ draft: { feedback: { code: "refused", refusals: [{ code: "one-order-per-unit" }] } } });
  });

  it("ignores a view that another overtook, and takes up the orders last saved when a seat is opened afresh", () => {
    const { host, session, store } = start({ republic: "local-human" });
    const older = store.getState().game.view!;
    const unit = Object.values(host.record()!.state.units).find((candidate) => candidate.factionId === faction("republic"))!;
    store.dispatch(disbandUnit(unit.id));
    store.dispatch(endTurn());
    expect(session().phase).toBe("resolution");
    store.dispatch(viewReceived(older));
    expect(session().phase).toBe("resolution");

    const orders = [{ factionId: faction("republic"), kind: "disband" as const, unitId: unit.id }];
    const reloaded = start({ republic: "local-human" });
    const view = reloaded.store.getState().game.view!;
    reloaded.store.dispatch(openSetup());
    reloaded.store.dispatch(viewReceived({ ...view, saved: { ended: false, orders, revision: 4 } }));
    expect(reloaded.session()).toMatchObject({ draft: { disbands: orders }, phase: "planning" });
    // Nothing is saved by looking, and the next save is numbered after the one it found.
    reloaded.store.dispatch(endTurn());
    expect(reloaded.inGame().at(-1)).toMatchObject({ kind: "end-turn", orders });
  });
});

describe("drafts from saved orders", () => {
  it("is submittedDraftOrders the other way round, for every kind", () => {
    const id = faction("republic");
    const orders = [
      { factionId: id, from: "a", kind: "move", to: "b", unitId: "1" },
      { factionId: id, from: "a", kind: "withdraw", to: "b", unitId: "2" },
      { factionId: id, kind: "disband", unitId: "3" },
      { factionId: id, kind: "replenish", unitId: "4" },
      { factionId: id, kind: "recruit", territoryId: "a", unitTypeId: "t" },
      { factionId: id, kind: "build", project: { buildingId: "x", kind: "building" }, subTerritoryId: "s" },
      { factionId: id, kind: "air-mission", mission: { kind: "recon", territoryId: "a" }, unitId: "5" },
      { factionId: id, kind: "sack", unitId: "6" }
    ] as unknown as readonly Order[];
    expect(submittedDraftOrders(draftFrom(orders))).toEqual(orders);
    expect(draftFrom([])).toBe(emptyDraft);
  });
});
