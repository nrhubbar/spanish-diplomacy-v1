import { generateComputerSubmission } from "../ai/computerPlayer";
import { initialGameState, resolveTurn } from "../engine/resolution";
import { keyedRolls, numericRolls, type RollSource } from "../engine/rolls";
import type { FactionId, GameState, PlayerSubmission, Scenario } from "../engine/types";
import { validateSubmission } from "../engine/validation";
import { outcomesFor } from "../engine/visibility";
import { beforePlanning } from "../engine/weather";
import { isSpent, openingClocks, pausedClock, playersOf, runningClock } from "./clock";
import { type CommandResult, type FactionOrders, type GameCommand, type GameRecord, type GameRefusal, type NewGame, type PlayerId, recordSchemaVersion, type TurnRecord } from "./types";

/**
 * The authoritative game: every rule of who may do what, when a turn resolves, and what is kept.
 * Pure: a record, a command and the time in, the next record or a refusal out. The host that calls
 * it loads and stores records, checks who the player is, and parses what they sent (`commandSchema`).
 */

export function rollsOf(record: Pick<GameRecord, "rollScheme" | "seed">): RollSource {
  return record.rollScheme === "numeric-1" ? numericRolls(Number(record.seed)) : keyedRolls(record.seed);
}

export function createGame(scenario: Scenario, game: NewGame, now: number): GameRecord {
  return openTurn(scenario, {
    ...game,
    clocks: {},
    orders: {},
    scenarioId: scenario.id,
    schemaVersion: recordSchemaVersion,
    state: initialGameState(scenario),
    status: "planning",
    turns: [],
    version: 1
  }, now);
}

/** What a viewer saw of a turn: its faction's view, or the shared one with no viewer. */
export function outcomesSeen(turn: TurnRecord, viewer: FactionId | undefined): TurnRecord["outcomes"] {
  const seen = (viewer === undefined ? undefined : turn.seen.byFaction[viewer]) ?? turn.seen.shared;
  return seen.flatMap((index) => turn.outcomes[index] ?? []);
}

/**
 * $6, U4 (CT-37, CT-38): a turn's entry, filtered once for every faction and for a shared screen
 * when the turn is written, against that turn's own final board and reveals. A later reveal
 * never opens an earlier turn, and a reveal lasts its one turn (D7).
 */
export function turnRecord(scenario: Scenario, finalState: GameState, outcomes: TurnRecord["outcomes"]): TurnRecord {
  const seenBy = (viewer: FactionId | undefined): readonly number[] => {
    const visible = new Set(outcomesFor(scenario, finalState, outcomes, viewer));
    return outcomes.flatMap((outcome, index) => (visible.has(outcome) ? [index] : []));
  };
  return {
    outcomes,
    seen: { byFaction: Object.fromEntries(scenario.factions.map((faction) => [faction.id, seenBy(faction.id)])), shared: seenBy(undefined) },
    turnNumber: finalState.turnNumber
  };
}

/** Opens a turn for planning: its weather, every computer player's orders, and the clocks. */
function openTurn(scenario: Scenario, record: GameRecord, now: number): GameRecord {
  // Step 0 (T2, T3): the turn's weather is in the state before anyone plans.
  const rolls = rollsOf(record);
  const state = beforePlanning(scenario, record.state, rolls);
  const orders = Object.fromEntries(scenario.factions.map((faction, index): [FactionId, FactionOrders] => {
    if (seatOf(record, faction.id).kind === "human") return [faction.id, { ended: false, orders: [], revision: 0 }];
    // $6, U4: a computer player remembers only the outcomes its faction saw on each turn.
    const history = record.turns.map((turn) => outcomesSeen(turn, faction.id));
    const previousOutcomes = history.at(-1);
    const submission = generateComputerSubmission(scenario, state, faction.id, rolls.computer(state.turnNumber, index), {
      history,
      ...(previousOutcomes === undefined ? {} : { previousOutcomes })
    });
    const verdict = validateSubmission(scenario, state, faction.id, submission);
    if (!verdict.ok) throw new Error(`Rejected submission for "${faction.id}": ${verdict.refusal.code}`);
    return [faction.id, { ended: true, orders: submission.orders, revision: 1 }];
  }));
  return { ...record, clocks: openingClocks(record, state.turnNumber, now), orders, state };
}

function seatOf(record: GameRecord, factionId: FactionId): GameRecord["seats"][FactionId] {
  const seat = (record.seats as Readonly<Partial<GameRecord["seats"]>>)[factionId];
  if (seat === undefined) throw new Error(`Faction "${factionId}" has no seat.`);
  return seat;
}

/** Resolves the turn from every faction's saved orders, then opens the next one unless the game is won. */
function resolve(scenario: Scenario, record: GameRecord, now: number): GameRecord {
  const submissions = scenario.factions.map((faction): PlayerSubmission => {
    const saved = record.orders[faction.id];
    return { factionId: faction.id, orders: saved?.orders ?? [], ...(saved?.timedOut === undefined ? {} : { timedOut: true }) };
  });
  const result = resolveTurn(scenario, record.state, submissions, rollsOf(record));
  const { turnNumber } = record.state;
  const next: GameRecord = {
    ...record,
    report: { ...result, turnNumber },
    turns: [...record.turns, turnRecord(scenario, result.finalState, result.outcomes)]
  };
  if (result.victory !== undefined) return { ...next, clocks: {}, orders: {}, state: result.finalState, status: "ended" };
  return openTurn(scenario, { ...next, state: { ...result.finalState, turnNumber: turnNumber + 1 } }, now);
}

const everyoneEnded = (record: GameRecord): boolean => (Object.values(record.orders) as readonly FactionOrders[]).every((saved) => saved.ended);

function resolveWhenReady(scenario: Scenario, record: GameRecord, now: number): GameRecord {
  return everyoneEnded(record) ? resolve(scenario, record, now) : record;
}

function refused(refusal: GameRefusal): CommandResult {
  return { ok: false, refusal };
}

const accepted = (record: GameRecord): CommandResult => ({ ok: true, record });

export function applyCommand(scenario: Scenario, record: GameRecord, playerId: PlayerId, command: GameCommand, now: number): CommandResult {
  const result = judge(scenario, record, playerId, command, now);
  return result.ok && result.record !== record ? accepted({ ...result.record, version: record.version + 1 }) : result;
}

function judge(scenario: Scenario, record: GameRecord, playerId: PlayerId, command: GameCommand, now: number): CommandResult {
  if (record.status === "ended") return refused({ code: "game-ended" });
  if (command.turnNumber !== record.state.turnNumber) return refused({ code: "wrong-turn" });
  switch (command.kind) {
    case "advance":
      return playersOf(record.seats).length === 0 ? accepted(resolve(scenario, record, now)) : refused({ code: "not-your-seat" });
    case "expire":
      return accepted(expire(scenario, record, now));
    default:
      return applySeatCommand(scenario, record, playerId, command, now);
  }
}

type SeatCommand = Extract<GameCommand, { readonly factionId: FactionId }>;

function applySeatCommand(scenario: Scenario, record: GameRecord, playerId: PlayerId, command: SeatCommand, now: number): CommandResult {
  const { factionId } = command;
  // Own keys only: the faction comes from the player.
  const seat = Object.hasOwn(record.seats, factionId) ? record.seats[factionId] : undefined;
  const saved = record.orders[factionId];
  if (seat?.kind !== "human" || seat.playerId !== playerId || saved === undefined) return refused({ code: "not-your-seat" });
  switch (command.kind) {
    case "open":
      // A seat whose turn has ended is closed: the next person at the device must not see it.
      if (saved.ended) return refused({ code: "turn-ended" });
      return accepted(withClock(record, factionId, (clock) => runningClock(clock, now)));
    case "pause":
    case "resume":
      if (saved.ended) return refused({ code: "turn-ended" });
      if (playersOf(record.seats).length > 1) return refused({ code: "cannot-pause" });
      return accepted(withClock(record, factionId, (clock) => (command.kind === "pause" ? pausedClock(clock, now) : runningClock(clock, now))));
    case "save-orders":
    case "end-turn":
      return applyOrders(scenario, record, saved, command, now);
  }
}

/** Saves a faction's orders whole, after checking every one against the board being planned on. */
function applyOrders(scenario: Scenario, record: GameRecord, saved: FactionOrders, command: Extract<GameCommand, { readonly orders: unknown }>, now: number): CommandResult {
  const ending = command.kind === "end-turn";
  // A repeated End Turn (a retry of one that arrived) is already done.
  if (saved.ended) return ending ? accepted(record) : refused({ code: "turn-ended" });
  // An older save arriving late changes nothing; End Turn always carries the latest orders.
  if (!ending && command.revision <= saved.revision) return accepted(record);
  const verdict = validateSubmission(scenario, record.state, command.factionId, { factionId: command.factionId, orders: command.orders });
  if (!verdict.ok) return refused({ code: "bad-orders", refusal: verdict.refusal });
  const next: FactionOrders = { ended: ending, orders: command.orders, revision: Math.max(command.revision, saved.revision) };
  return accepted(resolveWhenReady(scenario, { ...record, orders: { ...record.orders, [command.factionId]: next } }, now));
}

function withClock(record: GameRecord, factionId: FactionId, change: (clock: NonNullable<GameRecord["clocks"][FactionId]>) => NonNullable<GameRecord["clocks"][FactionId]>): GameRecord {
  const clock = record.clocks[factionId];
  return clock === undefined ? record : { ...record, clocks: { ...record.clocks, [factionId]: change(clock) } };
}

/**
 * T5: ends the turn of every faction whose time is up, with the orders it last saved, and
 * resolves the turn when nobody is left planning. Safe to call at any time.
 */
export function expire(scenario: Scenario, record: GameRecord, now: number): GameRecord {
  if (record.status === "ended") return record;
  const out = (Object.entries(record.orders) as [FactionId, FactionOrders][]).filter(([id, saved]) => !saved.ended && isSpent(record.clocks[id], now));
  if (out.length === 0) return record;
  const ended = Object.fromEntries(out.map(([id, saved]): [string, FactionOrders] => [id, { ...saved, ended: true, timedOut: true }]));
  return resolveWhenReady(scenario, { ...record, orders: { ...record.orders, ...ended } }, now);
}
