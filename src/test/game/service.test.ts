import { describe, expect, it } from "vitest";
import type { FactionId, MoveOrder, Order, UnitId } from "../../main/engine/types";
import { legalDestinations } from "../../main/engine/validation";
import { expiryGraceMs } from "../../main/game/clock";
import { playerView, seatsOf } from "../../main/game/projection";
import { applyCommand, createGame, expire, rollsOf, turnRecord } from "../../main/game/service";
import type { GameCommand, GameId, GameRecord, PlayerId, Seat } from "../../main/game/types";
import { faction, spainWithAir } from "../support";

const scenario = spainWithAir();
const [republic, north, south] = [faction("republic"), faction("north"), faction("south")];
const ana = "ana" as PlayerId;
const ben = "ben" as PlayerId;
const human = (playerId: PlayerId): Seat => ({ kind: "human", playerId });
const computer: Seat = { kind: "computer" };

function game(seats: Partial<Record<string, Seat>>, extra: Partial<Parameters<typeof createGame>[1]> = {}, now = 0): GameRecord {
  return createGame(scenario, {
    gameId: "g" as GameId,
    rollScheme: "keyed-1",
    scenarioVersion: "v",
    seats: { [republic]: computer, [north]: computer, [south]: computer, ...seats } as GameRecord["seats"],
    seed: "the secret seed",
    seedChosen: false,
    timerMinutes: 0,
    ...extra
  }, now);
}

const twoPlayers = (extra = {}, now = 0): GameRecord => game({ [north]: human(ben), [republic]: human(ana) }, extra, now);

function moveOf(record: GameRecord, factionId: FactionId): MoveOrder {
  for (const unit of Object.values(record.state.units)) {
    if (unit.factionId !== factionId) continue;
    const [to] = legalDestinations(scenario, record.state, factionId, [unit.id]);
    if (to !== undefined) return { factionId, from: unit.territoryId, kind: "move", to, unitId: unit.id };
  }
  throw new Error("No legal move.");
}

const save = (record: GameRecord, factionId: FactionId, orders: readonly Order[], revision = 1): GameCommand => ({ factionId, kind: "save-orders", orders, revision, turnNumber: record.state.turnNumber });
const end = (record: GameRecord, factionId: FactionId, orders: readonly Order[] = [], revision = 99): GameCommand => ({ factionId, kind: "end-turn", orders, revision, turnNumber: record.state.turnNumber });

function play(record: GameRecord, playerId: PlayerId, command: GameCommand, now = 0): GameRecord {
  const result = applyCommand(scenario, record, playerId, command, now);
  if (!result.ok) throw new Error(`Refused: ${JSON.stringify(result.refusal)}`);
  return result.record;
}

function refusal(record: GameRecord, playerId: PlayerId, command: GameCommand): string {
  const result = applyCommand(scenario, record, playerId, command, 0);
  return result.ok ? "accepted" : result.refusal.code;
}

describe("who may order what", () => {
  it("refuses another faction's order inside a player's own submission (a forged move, Disband or duplicate)", () => {
    const record = twoPlayers();
    const theirs = moveOf(record, north);
    for (const order of [theirs, { factionId: north, kind: "disband", unitId: theirs.unitId }, { ...theirs, factionId: republic }] as const) {
      expect(refusal(record, ana, save(record, republic, [order]))).toBe("bad-orders");
      expect(refusal(record, ana, end(record, republic, [order]))).toBe("bad-orders");
    }
  });

  it("refuses a seat that is not the player's: another's, a computer's, or none at all", () => {
    const record = twoPlayers();
    for (const seat of [north, south, "nobody" as FactionId, "constructor" as FactionId]) {
      expect(refusal(record, ana, save(record, seat, []))).toBe("not-your-seat");
      expect(refusal(record, ana, { factionId: seat, kind: "open", turnNumber: 1 })).toBe("not-your-seat");
    }
    expect(refusal(record, "stranger" as PlayerId, end(record, republic))).toBe("not-your-seat");
    expect(refusal(record, ana, { kind: "advance", turnNumber: 1 })).toBe("not-your-seat");
  });

  it("refuses two orders for one unit, and an impossible move, so no army is lost to one", () => {
    const record = twoPlayers();
    const order = moveOf(record, republic);
    expect(refusal(record, ana, save(record, republic, [order, order]))).toBe("bad-orders");
    expect(refusal(record, ana, save(record, republic, [{ ...order, to: order.from }]))).toBe("bad-orders");
    expect(refusal(record, ana, save(record, republic, [{ ...order, unitId: "ghost" as UnitId }]))).toBe("bad-orders");
    expect(record.orders[republic]?.orders).toEqual([]);
  });

  it("refuses commands for another turn", () => {
    const record = twoPlayers();
    expect(refusal(record, ana, { ...save(record, republic, []), turnNumber: 2 })).toBe("wrong-turn");
  });
});

describe("saving orders and ending the turn", () => {
  it("replaces the whole set on each save and ignores one that arrives late", () => {
    let record = twoPlayers();
    const order = moveOf(record, republic);
    record = play(record, ana, save(record, republic, [order], 2));
    expect(record.orders[republic]).toEqual({ ended: false, orders: [order], revision: 2 });
    expect(play(record, ana, save(record, republic, [], 1))).toBe(record);
    expect(play(record, ana, save(record, republic, [], 3)).orders[republic]?.orders).toEqual([]);
  });

  it("resolves only when everyone has ended, on the orders they ended with", () => {
    let record = twoPlayers();
    const order = moveOf(record, republic);
    record = play(record, ana, end(record, republic, [order]));
    expect(record.state.turnNumber).toBe(1);
    expect(refusal(record, ana, save(record, republic, [], 100))).toBe("turn-ended");
    // A retried End Turn changes nothing.
    expect(play(record, ana, end(record, republic))).toBe(record);
    record = play(record, ben, end(record, north));
    expect(record.state.turnNumber).toBe(2);
    expect(record.report?.turnNumber).toBe(1);
    expect(record.report?.submittedOrders).toContainEqual(order);
    expect(record.orders[republic]).toEqual({ ended: false, orders: [], revision: 0 });
    expect(record.orders[south]?.ended).toBe(true);
    // The retry of an End Turn that resolved the turn.
    expect(refusal(record, ben, { ...end(record, north), turnNumber: 1 })).toBe("wrong-turn");
  });

  it("plays computer seats inside the service, with no human seat needing to ask", () => {
    const record = game({ [republic]: human(ana) });
    expect(record.orders[north]?.ended).toBe(true);
    expect(record.orders[north]?.orders.every((order) => order.factionId === north)).toBe(true);
    expect(play(record, ana, end(record, republic)).state.turnNumber).toBe(2);
  });

  it("advances a game of computers on request, to its end, and refuses anything after it", () => {
    let record = game({}, { rollScheme: "numeric-1", seed: "7" });
    for (let turn = 0; turn < 20 && record.status === "planning"; turn += 1) record = play(record, ana, { kind: "advance", turnNumber: record.state.turnNumber });
    expect(record.status).toBe("ended");
    expect(refusal(record, ana, { kind: "advance", turnNumber: record.state.turnNumber })).toBe("game-ended");
    expect(expire(scenario, record, 0)).toBe(record);
  });
});

describe("the clock", () => {
  const minutes = 1;
  it("runs every player's clock at once from the turn's opening, and ends turns with what was last saved", () => {
    let record = twoPlayers({ timerMinutes: minutes }, 1000);
    const order = moveOf(record, republic);
    record = play(record, ana, save(record, republic, [order]), 2000);
    expect(applyCommand(scenario, record, ana, { factionId: republic, kind: "pause", turnNumber: 1 }, 0)).toEqual({ ok: false, refusal: { code: "cannot-pause" } });
    // Turn 1 has double time.
    expect(play(record, ana, { kind: "expire", turnNumber: 1 }, 1000 + 119_000 - expiryGraceMs)).toBe(record);
    const after = play(record, ana, { kind: "expire", turnNumber: 1 }, 121_000);
    expect(after.state.turnNumber).toBe(2);
    expect(after.report?.submittedOrders).toContainEqual(order);
    expect(after.report?.outcomes.filter((outcome) => outcome.kind === "time-ran-out").map((outcome) => outcome.factionId)).toEqual([republic, north]);
    expect(after.clocks[republic]).toEqual({ budgetMs: 60_000, runningSince: 121_000, spentMs: 0 });
  });

  it("starts one player's clocks as each seat is opened, and lets them pause", () => {
    let record = game({ [north]: human(ana), [republic]: human(ana) }, { timerMinutes: minutes });
    expect(record.clocks[republic]?.runningSince).toBeUndefined();
    record = play(record, ana, { factionId: republic, kind: "open", turnNumber: 1 }, 5000);
    expect(record.clocks[republic]?.runningSince).toBe(5000);
    expect(play(record, ana, { factionId: republic, kind: "open", turnNumber: 1 }, 9000).clocks[republic]?.runningSince).toBe(5000);
    record = play(record, ana, { factionId: republic, kind: "pause", turnNumber: 1 }, 15_000);
    expect(record.clocks[republic]).toEqual({ budgetMs: 120_000, spentMs: 10_000 });
    expect(play(record, ana, { factionId: republic, kind: "pause", turnNumber: 1 }, 20_000).clocks[republic]?.spentMs).toBe(10_000);
    expect(expire(scenario, record, 9_999_999)).toBe(record);
    record = play(record, ana, { factionId: republic, kind: "resume", turnNumber: 1 }, 30_000);
    const out = expire(scenario, record, 30_000 + 110_000);
    expect(out.orders[republic]).toMatchObject({ ended: true, timedOut: true });
    expect(out.orders[north]?.ended).toBe(false);
  });

  it("closes a seat whose turn has ended: it cannot be opened, paused or resumed", () => {
    const record = play(game({ [north]: human(ana), [republic]: human(ana) }, { timerMinutes: minutes }), ana, { factionId: republic, kind: "end-turn", orders: [], revision: 1, turnNumber: 1 });
    for (const kind of ["open", "pause", "resume"] as const) expect(refusal(record, ana, { factionId: republic, kind, turnNumber: 1 })).toBe("turn-ended");
    expect(refusal(record, ana, { factionId: north, kind: "open", turnNumber: 1 })).toBe("accepted");
  });

  it("has no clocks without a timer", () => {
    const record = twoPlayers();
    expect(record.clocks).toEqual({});
    expect(play(record, ana, { factionId: republic, kind: "open", turnNumber: 1 })).toBe(record);
  });
});

describe("what a player is sent", () => {
  it("never holds the seed, another faction's orders or balances, before the end", () => {
    let record = twoPlayers();
    const order = moveOf(record, republic);
    record = play(record, ana, save(record, republic, [order]));
    const sent = JSON.stringify(playerView(scenario, record, ben));
    expect(sent).not.toContain("the secret seed");
    expect(sent).not.toContain(JSON.stringify(order));
    const view = playerView(scenario, record, ben);
    expect(view.viewer).toBe(north);
    expect(Object.keys(view.state.treasuries)).toEqual([north]);
    expect(view.saved).toEqual({ ended: false, orders: [], revision: 0 });
    expect(view.assignments).toEqual({ [north]: "local-human", [republic]: "online-human", [south]: "computer" });
    expect(view.ready).toEqual([south]);
    expect(playerView(scenario, record, ana).saved?.orders).toEqual([order]);
  });

  it("is built from named fields only: an unknown field of the record or its state is not sent", () => {
    const record = { ...twoPlayers(), hidden: "leak-record" } as unknown as GameRecord;
    const leaky = { ...record, state: { ...record.state, plans: "leak-state" } } as unknown as GameRecord;
    const sent = JSON.stringify(playerView(scenario, leaky, ana));
    expect(sent).not.toContain("leak-record");
    expect(sent).not.toContain("leak-state");
  });

  it("gives the seed once the game has ended", () => {
    const record = twoPlayers();
    expect(playerView(scenario, record, ana).seed).toBeUndefined();
    expect(playerView(scenario, { ...record, status: "ended" }, ana).seed).toBe("the secret seed");
  });

  it("shows a player with several seats only the one opened, and a stranger only what is public", () => {
    const record = game({ [north]: human(ana), [republic]: human(ana) });
    expect(seatsOf(scenario, record, ana)).toEqual(scenario.factions.map((entry) => entry.id).filter((id) => id !== south));
    expect(playerView(scenario, record, ana).viewer).toBeUndefined();
    expect(playerView(scenario, record, ana).state.treasuries).toEqual({});
    expect(playerView(scenario, record, ana, north).viewer).toBe(north);
    expect(playerView(scenario, record, ana, south).viewer).toBeUndefined();
    expect(playerView(scenario, record, "stranger" as PlayerId, north)).toMatchObject({ seats: [], state: { treasuries: {} } });
  });
});

describe("records", () => {
  it("rise in version with each change, and only then", () => {
    const record = twoPlayers();
    const changed = play(record, ana, save(record, republic, []));
    expect([record.version, changed.version, playerView(scenario, changed, ana).version]).toEqual([1, 2, 2]);
    expect(play(changed, ana, save(changed, republic, [])).version).toBe(2);
  });

  it("survive a trip through JSON every turn without changing the game", () => {
    let kept = game({}, { seed: "round trip" });
    let sent = kept;
    for (let turn = 0; turn < 5; turn += 1) {
      const command: GameCommand = { kind: "advance", turnNumber: kept.state.turnNumber };
      kept = play(kept, ana, command);
      sent = play(JSON.parse(JSON.stringify(sent)) as GameRecord, ana, command);
      expect(JSON.stringify(sent)).toBe(JSON.stringify(kept));
    }
  });

  it("play different games on different text seeds, and the harness's on numeric ones", () => {
    const roll = (seed: string) => rollsOf({ rollScheme: "keyed-1", seed }).stream("battle", 1, 0)();
    expect(roll("a")).not.toBe(roll("b"));
    expect(rollsOf({ rollScheme: "numeric-1", seed: "7" }).stream("battle", 1, 0)()).toBe(rollsOf({ rollScheme: "numeric-1", seed: "7" }).stream("battle", 1, 0)());
  });

  it("keep each outcome once", () => {
    let record = game({});
    record = play(record, ana, { kind: "advance", turnNumber: 1 });
    const [turn] = record.turns;
    expect(turn?.seen.byFaction[republic]?.every((index) => Number.isInteger(index))).toBe(true);
    expect(turnRecord(scenario, record.report!.finalState, record.report!.outcomes)).toEqual(turn);
  });
});
