import { createAction, createReducer } from "@reduxjs/toolkit";
import type { ActorKind, AirMission, AirMissionKind, BuildOrder, FactionId, Scenario, ScenarioId, SubTerritoryId, TerritoryId, UnitId, UnitTypeId } from "../engine/types";
import type { GameRefusal, PlayerView } from "../game/types";
import { refusedFeedback } from "../presentation/feedback";
import type { ScenarioRegistry } from "../scenarios/registry";
import {
  cancelBuild,
  cancelIdleSupport,
  cancelOrder,
  chooseOrder,
  clearSelection,
  clickTerritory,
  clickUnit,
  closeAircraft,
  focusOn,
  type MusterOrder,
  orderMuster,
  planBuild,
  planDisband,
  removeOrder,
  selectAllAvailable,
  setAirMission,
  chooseMission,
  chooseTargetSite,
  setRecruitQuantity,
  takeBackRecruit,
  toggleSack,
  toggleUnit,
  type PlanningSession,
  unfocus
} from "./planning";
import type { Assignments, OrderKind, Session } from "./session";
import { sessionFromView } from "./sessionView";

export interface GameState {
  /** The turn whose report the player has read and moved on from. */
  readonly readTurn?: number;
  readonly session: Session;
  /** The last view the game's host sent; the session is drawn from it. Absent outside a game. */
  readonly view?: PlayerView;
}

export interface GameReducerDependencies {
  readonly registry: Pick<ScenarioRegistry, "list" | "require">;
}

export const openSetup = createAction("game/openSetup");
export const chooseScenario = createAction<ScenarioId>("game/chooseScenario");
export const setActorKind = createAction<{ readonly factionId: FactionId; readonly kind: ActorKind }>("game/setActorKind");
export const returnHome = createAction("game/returnHome");
export const exitGame = createAction("game/exitGame");
/** Asks the host for a game, on the player's own seed when they gave one (`clientMiddleware`). */
export const startGame = createAction("game/startGame", (seed?: string) => ({ payload: seed === undefined ? {} : { seed } }));
/** A view from the game's host. */
export const viewReceived = createAction<PlayerView>("game/viewReceived");
/** The host refused a command, and why. */
export const commandRefused = createAction<{ readonly refusal: GameRefusal; readonly turnNumber?: number }>("game/commandRefused");
export const beginPlanning = createAction("game/beginPlanning");
export const clickMapTerritory = createAction<TerritoryId>("game/clickMapTerritory");
export const clickMapUnit = createAction<UnitId>("game/clickMapUnit");
export const toggleUnitSelection = createAction<UnitId>("game/toggleUnitSelection");
export const selectAllAvailableUnits = createAction("game/selectAllAvailableUnits");
export const clearUnitSelection = createAction("game/clearUnitSelection");
export const chooseOrderKind = createAction<OrderKind>("game/chooseOrderKind");
/** D1: sends one unit home at the end of the turn; cleared with `removePlannedOrder`. */
export const disbandUnit = createAction<UnitId>("game/disbandUnit");
/** N6: an aircraft's mission starts choosing its target on the map. */
export const chooseAirMission = createAction<{ readonly mission: AirMissionKind; readonly unitId: UnitId }>("game/chooseAirMission");
/** N6: the sub-territory under a click, or named in the list, while a raid chooses its target. */
export const chooseRaidSite = createAction<SubTerritoryId>("game/chooseRaidSite");
export const cancelOrderStage = createAction("game/cancelOrderStage");
export const removePlannedOrder = createAction<UnitId>("game/removePlannedOrder");
export const endTurn = createAction("game/endTurn");
/** U6: the Invade or Reinforce pane's orders, given in one go. */
export const orderFromMuster = createAction<MusterOrder>("game/orderFromMuster");
/** X3: focus the pane on a sub-territory, or (undefined) back to its territory. */
export const focusSubTerritory = createAction<SubTerritoryId | undefined>("game/focusSubTerritory");
/** X4: how many units of a type the draft recruits at a territory (m3r1-recruit-replenish). */
export const changeRecruitQuantity = createAction<{ readonly quantity: number; readonly territoryId: TerritoryId; readonly unitTypeId: UnitTypeId }>("game/changeRecruitQuantity");
/** Takes back one of a territory's Recruit orders, by its place among them. */
export const cancelRecruitOrder = createAction<{ readonly at: number; readonly territoryId: TerritoryId }>("game/cancelRecruitOrder");
export const startNextTurn = createAction("game/startNextTurn");
/** U2: plan an aircraft's mission, or with none stand it down (m3r1-air-generals). */
export const planAirMission = createAction<{ readonly mission?: AirMission; readonly unitId: UnitId }>("game/planAirMission");
/** U2: close the selected aircraft's missions. */
export const closeAircraftPane = createAction("game/closeAircraftPane");
/** U5: plan, or withdraw, a Sack order for a general. */
export const toggleSackOrder = createAction<UnitId>("game/toggleSackOrder");
/** $5: plan a Build order for this turn, or cancel the one at an index. */
export const queueBuildOrder = createAction<BuildOrder>("game/queueBuildOrder");
export const cancelBuildOrder = createAction<number>("game/cancelBuildOrder");

function setupFor(scenario: Scenario): Session {
  const assignments: Record<FactionId, ActorKind> = {};
  for (const faction of scenario.factions) assignments[faction.id] = faction.defaultActor;
  return { assignments, phase: "setup", scenarioId: scenario.id };
}

/**
 * Game reducer built around an injected scenario registry (R6). Every case is a pure
 * Session -> Session transition; no case mutates state.
 */
export function createGameReducer(dependencies: GameReducerDependencies) {
  const scenarioOf = (id: ScenarioId): Scenario => dependencies.registry.require(id).scenario;
  const inPlanning = (session: Session, transition: (scenario: Scenario, planning: PlanningSession) => Session): Session => {
    if (session.phase !== "planning") return session;
    const scenario = scenarioOf(session.game.scenarioId);
    const after = transition(scenario, session);
    return after.phase === "planning" ? cancelIdleSupport(scenario, session, after) : after;
  };
  const set = (session: Session): GameState => ({ session });
  const planned = (state: GameState, transition: (scenario: Scenario, planning: PlanningSession) => Session): GameState => {
    const session = inPlanning(state.session, transition);
    return session === state.session ? state : { ...state, session };
  };
  const initialState: GameState = { session: { phase: "idle" } };

  return createReducer<GameState>(initialState, (builder) => {
    builder
      .addCase(openSetup, () => {
        const [first] = dependencies.registry.list();
        return set(first === undefined ? { phase: "idle" } : setupFor(scenarioOf(first.id)));
      })
      .addCase(chooseScenario, (state, { payload }) =>
        set(state.session.phase === "setup" ? setupFor(scenarioOf(payload)) : state.session)
      )
      .addCase(setActorKind, (state, { payload }) => {
        const session = state.session;
        if (session.phase !== "setup") return state;
        const assignments: Assignments = { ...session.assignments, [payload.factionId]: payload.kind };
        return set({ assignments, phase: "setup", scenarioId: session.scenarioId });
      })
      .addCase(returnHome, () => set({ phase: "idle" }))
      .addCase(exitGame, () => set({ phase: "idle" }))
      .addCase(startGame, (state) => {
        const session = state.session;
        if (session.phase !== "setup") return state;
        const scenario = scenarioOf(session.scenarioId);
        const unsupported = scenario.factions.find((faction) => {
          const kind = session.assignments[faction.id];
          return kind !== "local-human" && kind !== "computer";
        });
        if (unsupported !== undefined) {
          return set({ ...session, feedback: { code: "player-needed", factionId: unsupported.id } });
        }
        return { ...state, session: { assignments: session.assignments, phase: "setup", scenarioId: session.scenarioId } };
      })
      .addCase(clickMapTerritory, (state, { payload }) =>
        planned(state, (scenario, planning) => clickTerritory(scenario, planning, payload)))
      .addCase(clickMapUnit, (state, { payload }) =>
        planned(state, (scenario, planning) => clickUnit(scenario, planning, payload)))
      .addCase(toggleUnitSelection, (state, { payload }) =>
        planned(state, (_scenario, planning) => toggleUnit(planning, payload)))
      .addCase(selectAllAvailableUnits, (state) =>
        planned(state, (scenario, planning) => selectAllAvailable(planning, scenario)))
      .addCase(clearUnitSelection, (state) =>
        planned(state, (_scenario, planning) => clearSelection(planning)))
      .addCase(focusSubTerritory, (state, { payload }) =>
        planned(state, (scenario, planning) => (payload === undefined ? unfocus(planning) : focusOn(scenario, planning, payload))))
      .addCase(queueBuildOrder, (state, { payload }) =>
        planned(state, (scenario, planning) => planBuild(scenario, planning, payload)))
      .addCase(cancelBuildOrder, (state, { payload }) =>
        planned(state, (scenario, planning) => cancelBuild(scenario, planning, payload)))
      .addCase(chooseOrderKind, (state, { payload }) =>
        planned(state, (scenario, planning) => chooseOrder(scenario, planning, payload)))
      .addCase(cancelOrderStage, (state) =>
        planned(state, (_scenario, planning) => cancelOrder(planning)))
      .addCase(orderFromMuster, (state, { payload }) =>
        planned(state, (scenario, planning) => orderMuster(scenario, planning, payload)))
      .addCase(disbandUnit, (state, { payload }) =>
        planned(state, (scenario, planning) => planDisband(scenario, planning, [payload])))
      .addCase(removePlannedOrder, (state, { payload }) =>
        planned(state, (_scenario, planning) => removeOrder(planning, payload)))
      .addCase(planAirMission, (state, { payload }) =>
        planned(state, (scenario, planning) => setAirMission(scenario, planning, payload.unitId, payload.mission)))
      .addCase(chooseAirMission, (state, { payload }) =>
        planned(state, (scenario, planning) => chooseMission(scenario, planning, payload.unitId, payload.mission)))
      .addCase(chooseRaidSite, (state, { payload }) =>
        planned(state, (scenario, planning) => chooseTargetSite(scenario, planning, payload)))
      .addCase(closeAircraftPane, (state) =>
        planned(state, (_scenario, planning) => closeAircraft(planning)))
      .addCase(toggleSackOrder, (state, { payload }) =>
        planned(state, (scenario, planning) => toggleSack(scenario, planning, payload)))
      .addCase(changeRecruitQuantity, (state, { payload }) =>
        planned(state, (scenario, planning) => setRecruitQuantity(scenario, planning, payload.territoryId, payload.unitTypeId, payload.quantity)))
      .addCase(cancelRecruitOrder, (state, { payload }) =>
        planned(state, (_scenario, planning) => takeBackRecruit(planning, payload.territoryId, payload.at)))
      .addCase(startNextTurn, (state) => {
        const { session, view } = state;
        if (session.phase !== "resolution" || view === undefined) return state;
        const read: GameState = { ...state, readTurn: session.result.turnNumber };
        return { ...read, session: sessionFromView(read, view) };
      })
      .addCase(viewReceived, (state, { payload: view }) => {
        // The player left while the host was answering.
        if (state.session.phase === "idle") return state;
        const same = state.view?.gameId === view.gameId;
        // Answers can overtake each other; an older one never undoes a newer.
        if (same && (state.view?.version ?? 0) > view.version) return state;
        const next: GameState = { session: state.session, view, ...(same && state.readTurn !== undefined ? { readTurn: state.readTurn } : {}) };
        return { ...next, session: sessionFromView(next, view) };
      })
      .addCase(commandRefused, (state, { payload: { refusal, turnNumber } }) => planned(state, (_scenario, planning) =>
        (refusal.code === "bad-orders" && (turnNumber ?? planning.game.state.turnNumber) === planning.game.state.turnNumber ? { ...planning, draft: { ...planning.draft, feedback: refusedFeedback(refusal.refusal) } } : planning)));
  });
}
