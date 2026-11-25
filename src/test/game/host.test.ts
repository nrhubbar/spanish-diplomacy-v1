import { describe, expect, it } from "vitest";
import { givenSeed, type GameEvent, maxSeedLength } from "../../main/game/client";
import { parseCommand, submissionLimits } from "../../main/game/commandSchema";
import { createLocalHost, secureSeed } from "../../main/game/localHost";
import type { GameCommand, GameId } from "../../main/game/types";
import { loadRules, PackageValidationError } from "../../main/scenarios/loader";
import spain from "../../scenarios/spanish-civil-war-1936/scenario.json";
import { faction, shippedRegistry, spainId } from "../support";

const republic = faction("republic");

describe("parsing what players send", () => {
  const base = { factionId: republic, kind: "save-orders", orders: [], revision: 1, turnNumber: 1 };
  const move = { factionId: republic, from: "a", kind: "move", to: "b", unitId: "u" };
  it("accepts every kind of order and drops keys it does not know", () => {
    const orders = [
      move,
      { ...move, legs: [{ kind: "rail", to: "b" }] },
      { ...move, kind: "withdraw" },
      { factionId: republic, kind: "replenish", unitId: "u" },
      { factionId: republic, kind: "disband", unitId: "u" },
      { factionId: republic, kind: "sack", unitId: "u" },
      { factionId: republic, kind: "air-mission", mission: { kind: "recon", territoryId: "a" }, unitId: "u" },
      { factionId: republic, kind: "recruit", territoryId: "a", unitTypeId: "t" },
      { factionId: republic, kind: "build", project: { a: "a", b: "b", kind: "link", work: "new-rail" }, subTerritoryId: "s" }
    ];
    expect(parseCommand({ ...base, orders })).toEqual({ command: { ...base, orders }, ok: true });
    expect(parseCommand({ ...base, extra: 1, orders: [{ ...move, timedOut: true }] })).toEqual({ command: { ...base, orders: [move] }, ok: true });
  });

  it.each([
    ["nothing", null],
    ["an unknown command", { kind: "win" }],
    ["a null order", { ...base, orders: [null] }],
    ["an order kind every object has", { ...base, orders: [{ kind: "constructor" }] }],
    ["legs that are not a list", { ...base, orders: [{ ...move, legs: "x" }] }],
    ["a null leg", { ...base, orders: [{ ...move, legs: [null] }] }],
    ["too many legs", { ...base, orders: [{ ...move, legs: Array.from({ length: submissionLimits.legs + 1 }, () => ({ kind: "land", to: "b" })) }] }],
    ["too many orders", { ...base, orders: Array.from({ length: submissionLimits.orders + 1 }, () => move) }],
    ["an id that is too long", { ...base, orders: [{ ...move, to: "x".repeat(submissionLimits.id + 1) }] }],
    ["a mission without a target", { ...base, orders: [{ factionId: republic, kind: "air-mission", unitId: "u" }] }],
    ["a null project", { ...base, orders: [{ factionId: republic, kind: "build", project: null, subTerritoryId: "s" }] }],
    ["an id every object has", { ...base, orders: [{ ...move, unitId: "__proto__" }] }],
    ["a turn that is not a number", { ...base, turnNumber: "1" }]
  ])("refuses %s", (_name, input) => {
    expect(parseCommand(input)).toEqual({ ok: false, refusal: { code: "malformed" } });
  });
});

function host() {
  const events: GameEvent[] = [];
  let seeds = 0;
  const client = createLocalHost({ randomSeed: () => { seeds += 1; return `secret-${String(seeds)}`; }, scenario: (id) => shippedRegistry().require(id) });
  const stop = client.subscribe((event) => events.push(event));
  const views = () => events.flatMap((event) => (event.kind === "view" ? [event.view] : []));
  const create = (assignments: Record<string, string>, seed?: string) => {
    client.send({ assignments: { north: "computer", republic: "computer", south: "computer", ...assignments } as never, kind: "create", scenarioId: spainId, timerMinutes: 0, ...(seed === undefined ? {} : { seed }) });
    return views().at(-1)!;
  };
  const game = (gameId: GameId, command: GameCommand) => { client.send({ command, gameId, kind: "game" }); };
  return { client, create, events, game, stop, views };
}

describe("the in-process host", () => {
  it("draws a secret seed, or takes the player's own and says it was chosen", () => {
    const { client, create } = host();
    expect(create({ republic: "local-human" }).seedChosen).toBe(false);
    expect(client.record()?.seed).toMatch(/^secret-/);
    expect(create({ republic: "local-human" }, "  my seed ").seedChosen).toBe(true);
    expect(client.record()?.seed).toBe("my seed");
    expect(givenSeed("   ")).toBeUndefined();
    expect(givenSeed("x".repeat(100))).toHaveLength(maxSeedLength);
  });

  it("sends plain copies: nothing a player holds is the host's own record", () => {
    const { client, create } = host();
    const view = create({ republic: "local-human" });
    expect(view.state).not.toBe(client.record()?.state);
    expect(view.scenarioId).toBe(spainId);
    expect(client.record()?.scenarioVersion).toBe(shippedRegistry().require(spainId).version);
  });

  it("closes a seat's view when its turn ends, so the next person at the device sees nothing of it", () => {
    const { create, game, views } = host();
    const { gameId, seats } = create({ north: "local-human", republic: "local-human" });
    const [first, second] = seats;
    game(gameId, { factionId: first!, kind: "open", turnNumber: 1 });
    expect(views().at(-1)?.viewer).toBe(first);
    const count = views().length;
    game(gameId, { factionId: first!, kind: "save-orders", orders: [], revision: 1, turnNumber: 1 });
    expect(views()).toHaveLength(count);
    game(gameId, { factionId: first!, kind: "end-turn", orders: [], revision: 2, turnNumber: 1 });
    expect(views().at(-1)?.viewer).toBeUndefined();
    game(gameId, { factionId: second!, kind: "open", turnNumber: 1 });
    game(gameId, { factionId: second!, kind: "end-turn", orders: [], revision: 3, turnNumber: 1 });
    expect(views().at(-1)).toMatchObject({ report: { turnNumber: 1 }, state: { treasuries: {}, turnNumber: 2 } });
  });

  it("refuses unknown games, malformed commands and bad orders, and forgets a game that is left", () => {
    const { client, create, events, game, stop } = host();
    const { gameId } = create({ republic: "local-human" });
    game("other" as GameId, { kind: "expire", turnNumber: 1 });
    game(gameId, { kind: "nonsense" } as never);
    game(gameId, { factionId: republic, kind: "end-turn", orders: [{ factionId: republic, kind: "disband", unitId: "ghost" as never }], revision: 1, turnNumber: 1 });
    expect(events.flatMap((event) => (event.kind === "refused" ? [event.refusal.code] : []))).toEqual(["unknown-game", "malformed", "bad-orders"]);
    client.send({ gameId: "other" as GameId, kind: "leave" });
    expect(client.record()).toBeDefined();
    client.send({ gameId, kind: "leave" });
    expect(client.record()).toBeUndefined();
    const heard = events.length;
    stop();
    game(gameId, { kind: "expire", turnNumber: 1 });
    expect(events).toHaveLength(heard);
  });

  it("always answers when asked for the time, and sends a player who is behind where the game is", () => {
    const { create, events, game, views } = host();
    const { gameId } = create({ republic: "local-human" });
    const before = views().length;
    game(gameId, { kind: "expire", turnNumber: 1 });
    expect(views()).toHaveLength(before + 1);
    game(gameId, { factionId: republic, kind: "save-orders", orders: [], revision: 1, turnNumber: 9 });
    expect(events.at(-2)).toEqual({ kind: "refused", refusal: { code: "wrong-turn" }, turnNumber: 9 });
    expect(views()).toHaveLength(before + 2);
  });

  it("makes 128-bit seeds", () => {
    expect(secureSeed(globalThis.crypto)).toMatch(/^[0-9a-f]{32}$/);
    expect(secureSeed(globalThis.crypto)).not.toBe(secureSeed(globalThis.crypto));
  });
});

describe("loading rules without a map", () => {
  it("gives the same scenario and version as the whole package, and the same problems", () => {
    const rules = loadRules({ scenarioDocument: spain, scenarioPath: "scenario.json" });
    expect(rules.version).toBe(shippedRegistry().require(spainId).version);
    expect(rules.scenario.territories).toEqual(shippedRegistry().require(spainId).scenario.territories);
    expect(loadRules({ scenarioDocument: { ...spain, name: "Other" }, scenarioPath: "s" }).version).not.toBe(rules.version);
    expect(() => loadRules({ scenarioDocument: {}, scenarioPath: "s" })).toThrow(PackageValidationError);
    expect(() => loadRules({ scenarioDocument: { ...spain, victory: { ...spain.victory, territoryShare: 0.01 } }, scenarioPath: "s" })).toThrow(PackageValidationError);
  });
});
