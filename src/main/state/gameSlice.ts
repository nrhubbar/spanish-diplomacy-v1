import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  TerritoryId,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "../engine/types";
import { resolveTurn } from "../engine/resolution";
import { validateMoveOrder } from "../engine/validation";
import { createInitialGameState, milestone1Scenario } from "../scenarios/milestone1Scenario";
import type { RootState } from "./store";

export type GamePhase = "idle" | "setup" | "orders" | "resolution";

type DraftAction = "move";

export interface TurnHistoryEntry {
  readonly summaryLines: readonly string[];
  readonly turnNumber: number;
}

export interface GameSliceState {
  activeFactionId: FactionId;
  control: Partial<Record<TerritoryId, FactionId>>;
  draftAction: DraftAction | undefined;
  history: readonly TurnHistoryEntry[];
  phase: GamePhase;
  resolution: TurnResolutionResult | undefined;
  selectedDestinationId: TerritoryId | undefined;
  selectedFromTerritoryId: TerritoryId | undefined;
  selectedUnitIds: readonly UnitId[];
  submittedOrders: Partial<Record<FactionId, PlayerSubmission>>;
  turnNumber: number;
  units: Record<UnitId, UnitState>;
  validationMessage: string | undefined;
}

const factionOrder = milestone1Scenario.factions.map((faction) => faction.id);
const initialEngineState = createInitialGameState();
const noTerritoryIds: readonly TerritoryId[] = [];

const initialState: GameSliceState = {
  activeFactionId: "com",
  control: initialEngineState.control,
  draftAction: undefined,
  history: [],
  phase: "idle",
  resolution: undefined,
  selectedDestinationId: undefined,
  selectedFromTerritoryId: undefined,
  selectedUnitIds: [],
  submittedOrders: {},
  turnNumber: initialEngineState.turnNumber,
  units: initialEngineState.units,
  validationMessage: undefined
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    chooseMoveAction: (state) => {
      if (state.selectedUnitIds.length === 0) {
        state.validationMessage = "Select at least one friendly unit first.";
        return;
      }

      state.draftAction = "move";
      state.selectedDestinationId = undefined;
      state.validationMessage = undefined;
    },
    chooseMoveDestination: (state, action: PayloadAction<TerritoryId>) => {
      if (state.draftAction !== "move" || state.selectedFromTerritoryId === undefined) {
        state.validationMessage = "Choose a from territory and move action first.";
        return;
      }

      const destinationId = action.payload;

      if (destinationId === state.selectedFromTerritoryId) {
        state.selectedDestinationId = undefined;
        state.validationMessage = "Choose a different territory as the destination.";
        return;
      }

      const firstOrder = buildMoveOrders(state, destinationId)[0];

      if (firstOrder === undefined) {
        state.validationMessage = "Select at least one unit before choosing a destination.";
        return;
      }

      const validation = validateMoveOrder(milestone1Scenario, toEngineState(state), firstOrder);

      if (validation.ok) {
        state.selectedDestinationId = destinationId;
        state.validationMessage = undefined;
      } else {
        state.selectedDestinationId = undefined;
        state.validationMessage = validation.reason;
      }
    },
    enterSetup: (state) => {
      state.phase = "setup";
      state.validationMessage = undefined;
    },
    selectTerritory: (state, action: PayloadAction<TerritoryId>) => {
      const territoryId = action.payload;
      const friendlyUnits = Object.values(state.units).filter(
        (unit) => unit.factionId === state.activeFactionId && unit.territoryId === territoryId
      );

      state.selectedFromTerritoryId = territoryId;
      state.selectedDestinationId = undefined;
      state.draftAction = undefined;
      state.validationMessage =
        friendlyUnits.length === 0 ? "No friendly units are available in that territory." : undefined;
      state.selectedUnitIds = friendlyUnits.map((unit) => unit.id);
    },
    selectUnit: (state, action: PayloadAction<UnitId>) => {
      const unit = state.units[action.payload];

      if (unit === undefined || unit.factionId !== state.activeFactionId) {
        state.validationMessage = "Select one of your own units.";
        return;
      }

      state.selectedFromTerritoryId = unit.territoryId;
      state.selectedDestinationId = undefined;
      state.draftAction = undefined;
      state.selectedUnitIds = [unit.id];
      state.validationMessage = undefined;
    },
    startNewGame: () => {
      const nextState = createInitialGameState();

      return {
        activeFactionId: "com",
        control: nextState.control,
        draftAction: undefined,
        history: [],
        phase: "orders",
        resolution: undefined,
        selectedDestinationId: undefined,
        selectedFromTerritoryId: undefined,
        selectedUnitIds: [],
        submittedOrders: {},
        turnNumber: nextState.turnNumber,
        units: nextState.units,
        validationMessage: undefined
      } satisfies GameSliceState;
    },
    startNextTurn: (state) => {
      if (state.resolution !== undefined) {
        state.history = [
          ...state.history,
          {
            summaryLines: state.resolution.summaryLines,
            turnNumber: state.turnNumber
          }
        ];
      }

      state.activeFactionId = "com";
      state.draftAction = undefined;
      state.phase = "orders";
      state.resolution = undefined;
      state.selectedDestinationId = undefined;
      state.selectedFromTerritoryId = undefined;
      state.selectedUnitIds = [];
      state.submittedOrders = {};
      state.turnNumber += 1;
      state.validationMessage = undefined;
    },
    submitCurrentOrder: (state) => {
      const orders =
        state.draftAction === "move" && state.selectedDestinationId !== undefined
          ? buildMoveOrders(state, state.selectedDestinationId)
          : [];

      const invalidOrder = orders.find((order) => {
        const validation = validateMoveOrder(milestone1Scenario, toEngineState(state), order);

        return !validation.ok;
      });

      if (invalidOrder !== undefined) {
        const validation = validateMoveOrder(milestone1Scenario, toEngineState(state), invalidOrder);

        state.validationMessage = validation.ok ? undefined : validation.reason;
        return;
      }

      submitAndAdvance(state, {
        factionId: state.activeFactionId,
        orders
      });
    }
  }
});

export const {
  chooseMoveAction,
  chooseMoveDestination,
  enterSetup,
  selectTerritory,
  selectUnit,
  startNewGame,
  startNextTurn,
  submitCurrentOrder
} = gameSlice.actions;
export const gameReducer = gameSlice.reducer;

function submitAndAdvance(state: GameSliceState, submission: PlayerSubmission): void {
  state.submittedOrders[state.activeFactionId] = submission;
  clearDraft(state);

  const currentIndex = factionOrder.indexOf(state.activeFactionId);
  const nextFactionId = factionOrder[currentIndex + 1];

  if (nextFactionId !== undefined) {
    state.activeFactionId = nextFactionId;
    return;
  }

  const submissions = factionOrder.map(
    (factionId) => state.submittedOrders[factionId] ?? { factionId, orders: [] }
  );
  const resolution = resolveTurn(milestone1Scenario, toEngineState(state), submissions);

  state.control = resolution.finalControl;
  state.phase = "resolution";
  state.resolution = resolution;
  state.units = resolution.finalUnits;
}

function clearDraft(state: GameSliceState): void {
  state.draftAction = undefined;
  state.selectedDestinationId = undefined;
  state.selectedFromTerritoryId = undefined;
  state.selectedUnitIds = [];
  state.validationMessage = undefined;
}

function buildMoveOrders(state: GameSliceState, to: TerritoryId): readonly MoveOrder[] {
  if (state.selectedFromTerritoryId === undefined) {
    return [];
  }

  return state.selectedUnitIds.map((unitId) => ({
    factionId: state.activeFactionId,
    from: state.selectedFromTerritoryId as TerritoryId,
    kind: "move",
    to,
    unitId
  }));
}

function toEngineState(state: GameSliceState): GameState {
  return {
    control: { ...state.control },
    turnNumber: state.turnNumber,
    units: Object.fromEntries(Object.entries(state.units).map(([unitId, unit]) => [unitId, { ...unit }]))
  };
}

const selectSubmittedOrderRecord = (state: RootState) => state.game.submittedOrders;
const selectUnitRecord = (state: RootState) => state.game.units;

export function selectActiveFaction(state: RootState) {
  return factionById(state.game.activeFactionId);
}

export function selectCanSubmit(state: RootState): boolean {
  return (
    state.game.draftAction === undefined ||
    (state.game.selectedDestinationId !== undefined && state.game.selectedUnitIds.length > 0)
  );
}

export function selectControl(state: RootState): Partial<Record<TerritoryId, FactionId>> {
  return state.game.control;
}

export function selectDraftAction(state: RootState): DraftAction | undefined {
  return state.game.draftAction;
}

export function selectGamePhase(state: RootState): GamePhase {
  return state.game.phase;
}

export function selectHistory(state: RootState): readonly TurnHistoryEntry[] {
  return state.game.history;
}

export function selectLegalDestinationIds(state: RootState): readonly TerritoryId[] {
  if (state.game.draftAction !== "move" || state.game.selectedFromTerritoryId === undefined) {
    return noTerritoryIds;
  }

  const territory = milestone1Scenario.territories.find(
    (candidate) => candidate.id === state.game.selectedFromTerritoryId
  );

  return territory?.adjacent ?? noTerritoryIds;
}

export function selectResolution(state: RootState): TurnResolutionResult | undefined {
  return state.game.resolution;
}

export function selectResolutionSummary(state: RootState): readonly string[] {
  return state.game.resolution?.summaryLines ?? [];
}

export function selectSelectedDestinationId(state: RootState): TerritoryId | undefined {
  return state.game.selectedDestinationId;
}

export function selectSelectedFromTerritoryId(state: RootState): TerritoryId | undefined {
  return state.game.selectedFromTerritoryId;
}

export function selectSelectedUnitIds(state: RootState): readonly UnitId[] {
  return state.game.selectedUnitIds;
}

export const selectSubmittedOrders = createSelector([selectSubmittedOrderRecord], (submittedOrders) =>
  factionOrder.flatMap((factionId) => {
    const submission = submittedOrders[factionId];

    if (submission === undefined) {
      return [];
    }

    return [
      {
        factionId,
        factionName: factionById(factionId).name,
        description:
          submission.orders.length === 0
            ? "No orders"
            : submission.orders.map((order) => describeOrder(order)).join(", ")
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

export function selectValidationMessage(state: RootState): string | undefined {
  return state.game.validationMessage;
}

export function selectTurnDate(state: RootState): string {
  return turnDate(state.game.turnNumber);
}

function describeOrder(order: MoveOrder): string {
  return `Move ${order.unitId} from ${territoryName(order.from)} to ${territoryName(order.to)}`;
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

function turnDate(turnNumber: number): string {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  const halfStep = turnNumber - 1;
  const year = 1930 + Math.floor(halfStep / 24);
  const month = monthNames[Math.floor((halfStep % 24) / 2)] ?? "January";
  const half = halfStep % 2 === 0 ? "early" : "late";

  return `${half} ${month} ${year}`;
}
