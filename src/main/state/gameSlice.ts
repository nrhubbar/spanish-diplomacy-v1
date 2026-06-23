import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  FactionId,
  GameState,
  Order,
  TerritoryId,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "../engine/types";
import { resolveTurn } from "../engine/resolution";
import { validateOrder } from "../engine/validation";
import { createInitialGameState, milestone1Scenario } from "../scenarios/milestone1Scenario";
import type { RootState } from "./store";

export type GamePhase = "idle" | "setup" | "orders" | "resolution";

export interface GameSliceState {
  activeFactionId: FactionId;
  phase: GamePhase;
  resolution: TurnResolutionResult | undefined;
  selectedDestinationId: TerritoryId | undefined;
  selectedTerritoryId: TerritoryId | undefined;
  submittedOrders: Partial<Record<FactionId, Order>>;
  turnNumber: number;
  units: Record<UnitId, UnitState>;
  validationMessage: string | undefined;
}

const factionOrder = milestone1Scenario.factions.map((faction) => faction.id);

const initialEngineState = createInitialGameState();

const initialState: GameSliceState = {
  activeFactionId: "player-1",
  phase: "idle",
  resolution: undefined,
  selectedDestinationId: undefined,
  selectedTerritoryId: undefined,
  submittedOrders: {},
  turnNumber: initialEngineState.turnNumber,
  units: initialEngineState.units,
  validationMessage: undefined
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    enterSetup: (state) => {
      state.phase = "setup";
      state.validationMessage = undefined;
    },
    startNewGame: () => {
      const nextState = createInitialGameState();

      return {
        activeFactionId: "player-1",
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: undefined,
        selectedTerritoryId: undefined,
        submittedOrders: {},
        turnNumber: nextState.turnNumber,
        units: nextState.units,
        validationMessage: undefined
      } satisfies GameSliceState;
    },
    chooseMoveDestination: (state, action: PayloadAction<TerritoryId>) => {
      const activeUnit = findActiveUnit(state);
      const selectedTerritoryId = action.payload;

      state.selectedTerritoryId = selectedTerritoryId;
      state.validationMessage = undefined;

      if (selectedTerritoryId === activeUnit.territoryId) {
        state.selectedDestinationId = undefined;
        return;
      }

      const order = {
        kind: "move",
        factionId: state.activeFactionId,
        unitId: activeUnit.id,
        from: activeUnit.territoryId,
        to: selectedTerritoryId
      } satisfies Order;
      const validation = validateOrder(milestone1Scenario, toEngineState(state), order);

      if (validation.ok) {
        state.selectedDestinationId = selectedTerritoryId;
      } else {
        state.selectedDestinationId = undefined;
        state.validationMessage = validation.reason;
      }
    },
    submitMove: (state) => {
      const activeUnit = findActiveUnit(state);

      if (state.selectedDestinationId === undefined) {
        state.validationMessage = "Choose a legal move destination first.";
        return;
      }

      const order = {
        kind: "move",
        factionId: state.activeFactionId,
        unitId: activeUnit.id,
        from: activeUnit.territoryId,
        to: state.selectedDestinationId
      } satisfies Order;
      const validation = validateOrder(milestone1Scenario, toEngineState(state), order);

      if (!validation.ok) {
        state.validationMessage = validation.reason;
        return;
      }

      submitOrderAndAdvance(state, order);
    },
    submitNoMove: (state) => {
      const activeUnit = findActiveUnit(state);

      submitOrderAndAdvance(state, {
        kind: "no-move",
        factionId: state.activeFactionId,
        unitId: activeUnit.id
      });
    },
    startNextTurn: (state) => {
      state.activeFactionId = "player-1";
      state.phase = "orders";
      state.resolution = undefined;
      state.selectedDestinationId = undefined;
      state.selectedTerritoryId = undefined;
      state.submittedOrders = {};
      state.turnNumber += 1;
      state.validationMessage = undefined;
    }
  }
});

export const { chooseMoveDestination, enterSetup, startNewGame, startNextTurn, submitMove, submitNoMove } =
  gameSlice.actions;
export const gameReducer = gameSlice.reducer;

function submitOrderAndAdvance(state: GameSliceState, order: Order): void {
  state.submittedOrders[state.activeFactionId] = order;
  state.selectedDestinationId = undefined;
  state.selectedTerritoryId = undefined;
  state.validationMessage = undefined;

  const currentIndex = factionOrder.indexOf(state.activeFactionId);
  const nextFactionId = factionOrder[currentIndex + 1];

  if (nextFactionId !== undefined) {
    state.activeFactionId = nextFactionId;
    return;
  }

  const submittedOrders = factionOrder.map((factionId) => state.submittedOrders[factionId]);

  if (submittedOrders.every((submittedOrder): submittedOrder is Order => submittedOrder !== undefined)) {
    const resolution = resolveTurn(milestone1Scenario, toEngineState(state), submittedOrders);
    state.phase = "resolution";
    state.resolution = resolution;
    state.units = resolution.finalUnits;
  }
}

function findActiveUnit(state: GameSliceState): UnitState {
  const activeUnit = Object.values(state.units).find((unit) => unit.factionId === state.activeFactionId);

  if (activeUnit === undefined) {
    throw new Error("Active faction has no unit.");
  }

  return activeUnit;
}

function toEngineState(state: GameSliceState): GameState {
  return {
    turnNumber: state.turnNumber,
    units: {
      "soldier-1": { ...state.units["soldier-1"] },
      "soldier-2": { ...state.units["soldier-2"] },
      "soldier-3": { ...state.units["soldier-3"] }
    }
  };
}

export function selectGamePhase(state: RootState): GamePhase {
  return state.game.phase;
}

export function selectActiveFaction(state: RootState) {
  return factionById(state.game.activeFactionId);
}

export function selectActiveUnit(state: RootState): UnitState {
  return findActiveUnit(state.game);
}

export function selectLegalDestinationIds(state: RootState): readonly TerritoryId[] {
  const activeUnit = selectActiveUnit(state);
  const territory = milestone1Scenario.territories.find(
    (candidate) => candidate.id === activeUnit.territoryId
  );

  return territory?.adjacent ?? [];
}

export function selectSelectedDestinationId(state: RootState): TerritoryId | undefined {
  return state.game.selectedDestinationId;
}

export function selectSelectedTerritoryId(state: RootState): TerritoryId | undefined {
  return state.game.selectedTerritoryId ?? selectActiveUnit(state).territoryId;
}

const selectSubmittedOrderRecord = (state: RootState) => state.game.submittedOrders;
const selectUnitRecord = (state: RootState) => state.game.units;

export const selectSubmittedOrders = createSelector([selectSubmittedOrderRecord], (submittedOrders) =>
  factionOrder.flatMap((factionId) => {
    const order = submittedOrders[factionId];

    if (order === undefined) {
      return [];
    }

    return [
      {
        factionId,
        factionName: factionById(factionId).name,
        description: describeOrder(order)
      }
    ];
  })
);

export const selectUnits = createSelector([selectUnitRecord], (units): readonly UnitState[] =>
  Object.values(units)
);

export const selectUnitsWithFactionNames = createSelector([selectUnitRecord], (units) =>
  Object.values(units).map((unit) => ({
    ...unit,
    factionName: factionById(unit.factionId).name,
    territoryName: territoryName(unit.territoryId)
  }))
);

export function selectResolutionSummary(state: RootState): readonly string[] {
  return state.game.resolution?.summaryLines ?? [];
}

export function selectValidationMessage(state: RootState): string | undefined {
  return state.game.validationMessage;
}

function describeOrder(order: Order): string {
  if (order.kind === "no-move") {
    return "No move";
  }

  return `Move from ${territoryName(order.from)} to ${territoryName(order.to)}`;
}

function factionById(factionId: FactionId) {
  const faction = milestone1Scenario.factions.find((candidate) => candidate.id === factionId);

  if (faction === undefined) {
    throw new Error(`Unknown faction: ${factionId}`);
  }

  return faction;
}

function territoryName(territoryId: TerritoryId): string {
  const territory = milestone1Scenario.territories.find((candidate) => candidate.id === territoryId);

  return territory?.name ?? territoryId;
}
