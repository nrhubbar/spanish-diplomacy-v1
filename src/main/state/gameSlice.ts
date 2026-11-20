import { createAction, createReducer } from "@reduxjs/toolkit";
import { initialGameState } from "../engine/resolution";
import type { ActorKind, AirMission, FactionId, Scenario, ScenarioId, SubTerritoryId, TerritoryId, UnitId } from "../engine/types";
import type { ScenarioRegistry } from "../scenarios/registry";
import { advance, lockSubmission, nextTurn } from "./coordinator";
import {
  cancelOrder,
  chooseOrder,
  clearSelection,
  clickTerritory,
  clickUnit,
  closeAircraft,
  focusOn,
  removeOrder,
  airDraftOrders,
  selectAllAvailable,
  setAirMission,
  toggleOrderChoice,
  toggleSack,
  toggleUnit,
  type PlanningSession,
  unfocus
} from "./planning";
import { type Assignments, emptyDraft, type OrderKind, type Session } from "./session";

export interface GameState {
  readonly session: Session;
}

export interface GameReducerDependencies {
  readonly registry: Pick<ScenarioRegistry, "list" | "require">;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x100000000);
}

export const openSetup = createAction("game/openSetup");
export const chooseScenario = createAction<ScenarioId>("game/chooseScenario");
export const setActorKind = createAction<{ readonly factionId: FactionId; readonly kind: ActorKind }>("game/setActorKind");
export const returnHome = createAction("game/returnHome");
export const exitGame = createAction("game/exitGame");
/** The seed is created here, outside the reducer, so reducers stay pure and games replay. */
export const startGame = createAction("game/startGame", (seed?: number) => ({ payload: { seed: seed ?? randomSeed() } }));
export const beginPlanning = createAction("game/beginPlanning");
export const clickMapTerritory = createAction<TerritoryId>("game/clickMapTerritory");
export const clickMapUnit = createAction<UnitId>("game/clickMapUnit");
export const toggleUnitSelection = createAction<UnitId>("game/toggleUnitSelection");
export const selectAllAvailableUnits = createAction("game/selectAllAvailableUnits");
export const clearUnitSelection = createAction("game/clearUnitSelection");
export const toggleOrderMenu = createAction("game/toggleOrderMenu");
export const chooseOrderKind = createAction<OrderKind>("game/chooseOrderKind");
export const cancelOrderStage = createAction("game/cancelOrderStage");
export const removePlannedOrder = createAction<UnitId>("game/removePlannedOrder");
export const endTurn = createAction("game/endTurn");
/** X3: focus the pane on a sub-territory, or (undefined) back to its territory. */
export const focusSubTerritory = createAction<SubTerritoryId | undefined>("game/focusSubTerritory");
export const startNextTurn = createAction("game/startNextTurn");
/** U2: plan an aircraft's mission, or with none stand it down (m3r1-air-generals). */
export const planAirMission = createAction<{ readonly mission?: AirMission; readonly unitId: UnitId }>("game/planAirMission");
/** U2: close the selected aircraft's missions. */
export const closeAircraftPane = createAction("game/closeAircraftPane");
/** U5: plan, or withdraw, a Sack order for a general. */
export const toggleSackOrder = createAction<UnitId>("game/toggleSackOrder");

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
  const inPlanning = (session: Session, transition: (scenario: Scenario, planning: PlanningSession) => Session): Session =>
    session.phase === "planning" ? transition(scenarioOf(session.game.scenarioId), session) : session;
  const set = (session: Session): GameState => ({ session });
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
      .addCase(startGame, (state, { payload }) => {
        const session = state.session;
        if (session.phase !== "setup") return state;
        const scenario = scenarioOf(session.scenarioId);
        const unsupported = scenario.factions.find((faction) => {
          const kind = session.assignments[faction.id];
          return kind !== "local-human" && kind !== "computer";
        });
        if (unsupported !== undefined) {
          return set({ ...session, feedback: `Choose a local or computer player for ${unsupported.name}. Online play is coming later.` });
        }
        return set(advance(scenario, {
          assignments: session.assignments,
          history: [],
          locked: {},
          scenarioId: scenario.id,
          seed: payload.seed,
          state: initialGameState(scenario)
        }));
      })
      .addCase(beginPlanning, (state) => {
        const session = state.session;
        return session.phase === "handoff"
          ? set({ draft: emptyDraft, factionId: session.factionId, game: session.game, phase: "planning" })
          : state;
      })
      .addCase(clickMapTerritory, (state, { payload }) =>
        set(inPlanning(state.session, (scenario, planning) => clickTerritory(scenario, planning, payload))))
      .addCase(clickMapUnit, (state, { payload }) =>
        set(inPlanning(state.session, (scenario, planning) => clickUnit(scenario, planning, payload))))
      .addCase(toggleUnitSelection, (state, { payload }) =>
        set(inPlanning(state.session, (_scenario, planning) => toggleUnit(planning, payload))))
      .addCase(selectAllAvailableUnits, (state) =>
        set(inPlanning(state.session, (scenario, planning) => selectAllAvailable(planning, scenario))))
      .addCase(clearUnitSelection, (state) =>
        set(inPlanning(state.session, (_scenario, planning) => clearSelection(planning))))
      .addCase(toggleOrderMenu, (state) =>
        set(inPlanning(state.session, (_scenario, planning) => toggleOrderChoice(planning))))
      .addCase(focusSubTerritory, (state, { payload }) =>
        set(inPlanning(state.session, (scenario, planning) => (payload === undefined ? unfocus(planning) : focusOn(scenario, planning, payload)))))
      .addCase(chooseOrderKind, (state, { payload }) =>
        set(inPlanning(state.session, (scenario, planning) => chooseOrder(scenario, planning, payload))))
      .addCase(cancelOrderStage, (state) =>
        set(inPlanning(state.session, (_scenario, planning) => cancelOrder(planning))))
      .addCase(removePlannedOrder, (state, { payload }) =>
        set(inPlanning(state.session, (_scenario, planning) => removeOrder(planning, payload))))
      .addCase(planAirMission, (state, { payload }) =>
        set(inPlanning(state.session, (scenario, planning) => setAirMission(scenario, planning, payload.unitId, payload.mission))))
      .addCase(closeAircraftPane, (state) =>
        set(inPlanning(state.session, (_scenario, planning) => closeAircraft(planning))))
      .addCase(toggleSackOrder, (state, { payload }) =>
        set(inPlanning(state.session, (scenario, planning) => toggleSack(scenario, planning, payload))))
      .addCase(endTurn, (state) =>
        set(inPlanning(state.session, (scenario, planning) => advance(
          scenario,
          lockSubmission(scenario, planning.game, { factionId: planning.factionId, orders: [...planning.draft.orders, ...airDraftOrders(planning.draft)] }),
          planning.factionId
        ))))
      .addCase(startNextTurn, (state) => {
        const session = state.session;
        return session.phase === "resolution"
          ? set(nextTurn(scenarioOf(session.game.scenarioId), session.game, session.result.outcomes))
          : state;
      });
  });
}
