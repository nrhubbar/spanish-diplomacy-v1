import type { UnknownAction } from "@reduxjs/toolkit";
import { modeOf, validateRoute } from "../engine/movement/routes";
import type { MoveMode } from "../engine/network/reach";
import type { MoveOrder, Scenario, ScenarioId } from "../engine/types";
import { isBattle } from "../presentation/grades";
import { chooseOrderKind, clickMapTerritory, disbandUnit, endTurn, orderFromMuster, planAirMission, queueBuildOrder, changeRecruitQuantity, toggleSackOrder } from "../state/gameSlice";
import { type Draft, localPlayerCount, type Session } from "../state/session";
import { timeRanOut } from "../state/timeout";
import { clockWarned } from "../state/timerSlice";
import type { TimerState } from "../state/timerSlice";
import type { CueId } from "./sounds";

/** What sounds depend on: the session as its viewer may see it, so no sound tells what a screen hides. */
export interface HeardState {
  readonly session: Session;
  readonly timer: TimerState;
}

type Planning = Extract<Session, { readonly phase: "planning" }>;

/** The seconds left at which the timer is heard as well as seen. */
const warningSeconds = 10;

/** Actions that give an order, so a refusal of one is worth a sound. */
const orderActions: ReadonlySet<string> = new Set(
  [changeRecruitQuantity, chooseOrderKind, clickMapTerritory, disbandUnit, orderFromMuster, planAirMission, queueBuildOrder, toggleSackOrder].map((action) => action.type)
);

/** Every list in a draft that an order of some kind is kept in. */
const orderLists = ["airOrders", "builds", "disbands", "orderedToStay", "orders", "recruits", "replenishments"] as const satisfies readonly (keyof Draft)[];

/** When one action gives orders of several kinds, the rarest is heard. */
const modePrecedence: readonly MoveMode[] = ["rail", "motor", "march", "sea"];

const modeCues: Readonly<Record<MoveMode, CueId>> = { march: "march", motor: "truck", rail: "rail", sea: "order" };

/** The mode a planned move goes by: the engine's own reading of its legs. */
export function moveModeOf(scenario: Scenario, session: Planning, order: MoveOrder): MoveMode {
  const check = validateRoute(scenario, session.game.state, order);
  return check.ok ? modeOf(check.route.shape) : "march";
}

/** The one sound for a set of modes given in one action; undefined for none. */
export function moveCue(modes: readonly MoveMode[], withAircraft: boolean): CueId | undefined {
  if (modes.includes("rail")) return "rail";
  if (withAircraft) return "air";
  const rarest = modePrecedence.find((mode) => modes.includes(mode));
  return rarest === undefined ? undefined : modeCues[rarest];
}

/** Entries of `after` that `before` does not have, by value, counting repeats. */
function added<T>(before: readonly T[] = [], after: readonly T[] = []): readonly T[] {
  const left = before.map((entry) => JSON.stringify(entry));
  return after.filter((entry) => {
    const at = left.indexOf(JSON.stringify(entry));
    if (at === -1) return true;
    left.splice(at, 1);
    return false;
  });
}

/** What the player's own plan gained, as a sound; undefined when it gained nothing. */
function gained(scenario: Scenario, before: Planning, after: Planning): CueId | undefined {
  const was = before.draft;
  const is = after.draft;
  const orders = added(was.orders, is.orders);
  const moves = orders.filter((order) => order.kind === "move");
  const flights = added(was.airOrders, is.airOrders);
  const move = moveCue(moves.map((order) => moveModeOf(scenario, after, order)), flights.some((order) => order.kind === "air-mission"));
  if (move !== undefined) return move;
  if (added(was.builds, is.builds).length > 0) return "build";
  const recruits = added(was.recruits, is.recruits);
  if (recruits.length > 0) {
    const first = recruits.some((order) => !(was.recruits ?? []).some((other) => other.territoryId === order.territoryId && other.unitTypeId === order.unitTypeId));
    return first ? "recruit" : "order";
  }
  return orderLists.some((list) => added<unknown>(was[list], is[list]).length > 0) ? "order" : undefined;
}

function planningCue(scenario: Scenario, before: Planning, after: Planning, action: UnknownAction): CueId | undefined {
  const secret = localPlayerCount(after.game.assignments) > 1;
  const gain = gained(scenario, before, after);
  // Hot seat: another player can hear, so every order sounds the same, refused or not.
  if (gain !== undefined) return secret ? "order" : gain;
  if (orderLists.some((list) => added<unknown>(after.draft[list], before.draft[list]).length > 0)) return secret ? "order" : "cancel";
  // Nothing was touched, and the game said why not. An order given again is a new list, and silent.
  const untouched = orderLists.every((list) => before.draft[list] === after.draft[list]);
  const told = after.draft.feedback !== undefined && after.draft !== before.draft;
  const giving = action.type !== clickMapTerritory.type || before.draft.stage !== undefined;
  if (!untouched || !told || !giving || !orderActions.has(action.type)) return undefined;
  return secret ? "order" : "refused";
}

function reportHasBattles(session: Session): boolean {
  return session.phase === "resolution" && session.result.outcomes.some(isBattle);
}

/**
 * The sounds of one action, from the state before and after it. An action the game ignored changes
 * nothing, so it makes no sound. Computer players plan inside the turn's own action, so their
 * orders never sound. Pure: no clock, no randomness, nothing played.
 */
export function cuesFor(scenarioOf: (id: ScenarioId) => Scenario, before: HeardState, after: HeardState, action: UnknownAction): readonly CueId[] {
  if (clockWarned.match(action)) return action.payload === warningSeconds && before.timer !== after.timer ? ["time-warning"] : [];
  const was = before.session;
  const is = after.session;
  if (was === is || was.phase !== "planning") return [];
  if (endTurn.match(action) || timeRanOut.match(action)) return reportHasBattles(is) ? ["end-turn", "battle"] : ["end-turn"];
  if (is.phase !== "planning" || is.factionId !== was.factionId) return [];
  const cue = planningCue(scenarioOf(was.game.scenarioId), was, is, action);
  return cue === undefined ? [] : [cue];
}
