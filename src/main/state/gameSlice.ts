import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { generateComputerSubmission } from "../ai/historicallyMotivatedActor";
import { resolveTurn } from "../engine/resolution";
import { validateSubmission } from "../engine/submission";
import type {
  ActorKind,
  FactionId,
  GameState,
  MoveOrder,
  PlayerSubmission,
  TerritoryControl,
  TerritoryId,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "../engine/types";
import { validateMoveOrder } from "../engine/validation";
import { createInitialGameState, milestone2Scenario } from "../scenarios/milestone2Scenario";
import type { RootState } from "./store";

export type GamePhase = "idle" | "setup" | "handoff" | "planning" | "resolution" | "game-over";
type DraftAction = "move";

export interface TurnHistoryEntry {
  readonly summaryLines: readonly string[];
  readonly turnNumber: number;
}

export type AssignmentRecord = Record<FactionId, ActorKind>;

export interface GameSliceState {
  activeFactionId: FactionId;
  assignments: AssignmentRecord;
  cityControl: GameState["cityControl"];
  control: Record<TerritoryId, TerritoryControl>;
  draftAction: DraftAction | undefined;
  draftOrders: readonly MoveOrder[];
  handoffFromFactionId: FactionId | undefined;
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

export const defaultAssignments: AssignmentRecord = {
  republic: "local-human",
  north: "computer",
  south: "computer"
};

const factionOrder = milestone2Scenario.factions.map((faction) => faction.id);
const initialEngineState = createInitialGameState();
const noTerritoryIds: readonly TerritoryId[] = [];
const noSummaryLines: readonly string[] = [];

const initialState: GameSliceState = {
  activeFactionId: "republic",
  assignments: defaultAssignments,
  cityControl: initialEngineState.cityControl,
  control: initialEngineState.control,
  draftAction: undefined,
  draftOrders: [],
  handoffFromFactionId: undefined,
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
    addDraftMove: (state) => {
      if (state.selectedDestinationId === undefined) {
        state.validationMessage = "Choose a destination before adding the move.";
        return;
      }

      const orders = buildMoveOrders(state, state.selectedDestinationId);
      const withoutSelectedUnits = state.draftOrders.filter(
        (order) => !state.selectedUnitIds.includes(order.unitId)
      );
      state.draftOrders = [...withoutSelectedUnits, ...orders];
      clearSelection(state);
    },
    beginPlanning: (state) => {
      if (state.phase !== "handoff" || state.assignments[state.activeFactionId] !== "local-human") {
        return;
      }
      state.phase = "planning";
    },
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
        state.validationMessage = "Choose units and the move action first.";
        return;
      }

      if (action.payload === state.selectedFromTerritoryId) {
        state.selectedDestinationId = undefined;
        state.validationMessage = "Choose a different territory as the destination.";
        return;
      }

      const orders = buildMoveOrders(state, action.payload);
      const invalid = orders.find(
        (order) => !validateMoveOrder(milestone2Scenario, toEngineState(state), order).ok
      );

      if (invalid !== undefined) {
        const validation = validateMoveOrder(milestone2Scenario, toEngineState(state), invalid);
        state.selectedDestinationId = undefined;
        state.validationMessage = validation.ok ? undefined : validation.reason;
        return;
      }

      state.selectedDestinationId = action.payload;
      state.validationMessage = undefined;
    },
    enterSetup: (state) => {
      state.phase = "setup";
      state.validationMessage = undefined;
    },
    removeDraftOrder: (state, action: PayloadAction<UnitId>) => {
      state.draftOrders = state.draftOrders.filter((order) => order.unitId !== action.payload);
    },
    runComputerTurn: (state) => {
      if (state.phase !== "handoff" || hasLocalPlayer(state.assignments)) {
        return;
      }
      processActors(state);
    },
    selectTerritory: (state, action: PayloadAction<TerritoryId>) => {
      state.selectedFromTerritoryId = action.payload;
      state.selectedDestinationId = undefined;
      state.draftAction = undefined;
      state.selectedUnitIds = [];
      const hasFriendlyUnits = Object.values(state.units).some(
        (unit) => unit.factionId === state.activeFactionId && unit.territoryId === action.payload
      );
      state.validationMessage = hasFriendlyUnits
        ? undefined
        : "No friendly formations are available in that territory.";
    },
    selectUnit: (state, action: PayloadAction<UnitId>) => {
      const unit = state.units[action.payload];
      if (unit === undefined || unit.factionId !== state.activeFactionId) {
        state.validationMessage = "Select one of your own formations.";
        return;
      }

      const selectedElsewhere =
        state.selectedFromTerritoryId !== undefined && state.selectedFromTerritoryId !== unit.territoryId;
      const alreadySelected = state.selectedUnitIds.includes(unit.id);
      state.selectedFromTerritoryId = unit.territoryId;
      state.selectedDestinationId = undefined;
      state.draftAction = undefined;
      state.selectedUnitIds = alreadySelected
        ? state.selectedUnitIds.filter((unitId) => unitId !== unit.id)
        : selectedElsewhere
          ? [unit.id]
          : [...state.selectedUnitIds, unit.id];
      state.validationMessage = undefined;
    },
    setActorKind: (
      state,
      action: PayloadAction<{ readonly factionId: FactionId; readonly kind: ActorKind }>
    ) => {
      state.assignments[action.payload.factionId] = action.payload.kind;
    },
    startNewGame: (state, action: PayloadAction<AssignmentRecord | undefined>) => {
      const nextState = createInitialGameState();
      const assignments = action.payload ?? state.assignments;
      Object.assign(state, {
        activeFactionId: factionOrder[0] as FactionId,
        assignments,
        cityControl: nextState.cityControl,
        control: nextState.control,
        draftAction: undefined,
        draftOrders: [],
        handoffFromFactionId: undefined,
        history: [],
        phase: "handoff" as GamePhase,
        resolution: undefined,
        selectedDestinationId: undefined,
        selectedFromTerritoryId: undefined,
        selectedUnitIds: [],
        submittedOrders: {},
        turnNumber: 1,
        units: nextState.units,
        validationMessage: undefined
      });

      if (hasLocalPlayer(assignments)) {
        processActors(state);
      }
    },
    startNextTurn: (state) => {
      if (state.phase !== "resolution") {
        return;
      }
      archiveResolution(state);
      state.activeFactionId = factionOrder[0] as FactionId;
      state.draftOrders = [];
      state.handoffFromFactionId = undefined;
      state.phase = "handoff";
      state.resolution = undefined;
      state.submittedOrders = {};
      state.turnNumber += 1;
      clearSelection(state);

      if (hasLocalPlayer(state.assignments)) {
        processActors(state);
      }
    },
    submitCurrentOrders: (state) => {
      if (state.phase !== "planning") {
        return;
      }
      const submission = { factionId: state.activeFactionId, orders: state.draftOrders };
      const accepted = submitOrdersThroughGateway(state, submission);
      if (!accepted) {
        return;
      }
      state.handoffFromFactionId = state.activeFactionId;
      processActors(state);
    }
  }
});

export const {
  addDraftMove,
  beginPlanning,
  chooseMoveAction,
  chooseMoveDestination,
  enterSetup,
  removeDraftOrder,
  runComputerTurn,
  selectTerritory,
  selectUnit,
  setActorKind,
  startNewGame,
  startNextTurn,
  submitCurrentOrders
} = gameSlice.actions;
export const gameReducer = gameSlice.reducer;

export function submitOrdersThroughGateway(
  state: GameSliceState,
  submission: PlayerSubmission
): boolean {
  const validation = validateSubmission(
    milestone2Scenario,
    toEngineState(state),
    submission.factionId,
    submission
  );
  if (!validation.ok) {
    state.validationMessage = validation.reason;
    return false;
  }
  state.submittedOrders[submission.factionId] = submission;
  state.draftOrders = [];
  clearSelection(state);
  return true;
}

function processActors(state: GameSliceState): void {
  while (true) {
    const nextFactionId = factionOrder.find((factionId) => state.submittedOrders[factionId] === undefined);
    if (nextFactionId === undefined) {
      resolveCurrentTurn(state);
      return;
    }

    state.activeFactionId = nextFactionId;
    const kind = state.assignments[nextFactionId];
    if (kind === "local-human") {
      state.phase = "handoff";
      return;
    }
    if (kind === "online-human") {
      state.validationMessage = "Online players are not available in this milestone.";
      state.phase = "handoff";
      return;
    }

    const submission = generateComputerSubmission(
      milestone2Scenario,
      toEngineState(state),
      nextFactionId,
      () => 0
    );
    if (!submitOrdersThroughGateway(state, submission)) {
      state.phase = "handoff";
      return;
    }
  }
}

function resolveCurrentTurn(state: GameSliceState): void {
  const submissions = factionOrder.map(
    (factionId) => state.submittedOrders[factionId] as PlayerSubmission
  );
  const resolution = resolveTurn(milestone2Scenario, toEngineState(state), submissions);
  state.cityControl = resolution.cityControl;
  state.control = resolution.finalControl;
  state.resolution = resolution;
  state.units = resolution.finalUnits;
  state.phase = resolution.victory === undefined ? "resolution" : "game-over";
}

function archiveResolution(state: GameSliceState): void {
  if (state.resolution !== undefined) {
    state.history = [
      ...state.history,
      { summaryLines: state.resolution.summaryLines, turnNumber: state.turnNumber }
    ];
  }
}

function hasLocalPlayer(assignments: AssignmentRecord): boolean {
  return Object.values(assignments).includes("local-human");
}

function clearSelection(state: GameSliceState): void {
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
    cityControl: { ...state.cityControl },
    control: Object.fromEntries(
      Object.entries(state.control).map(([territoryId, control]) => [
        territoryId,
        control.kind === "controlled"
          ? { kind: "controlled", factionId: control.factionId }
          : { kind: "contested", factionIds: [...control.factionIds] }
      ])
    ) as Record<TerritoryId, TerritoryControl>,
    turnNumber: state.turnNumber,
    units: Object.fromEntries(
      Object.entries(state.units).map(([unitId, unit]) => [unitId, { ...unit, sourceIds: [...unit.sourceIds] }])
    )
  };
}

const selectSubmittedOrderRecord = (state: RootState) => state.game.submittedOrders;
const selectUnitRecord = (state: RootState) => state.game.units;

export const selectActiveFaction = (state: RootState) => factionById(state.game.activeFactionId);
export const selectActorKind = (state: RootState) => state.game.assignments[state.game.activeFactionId];
export const selectAssignments = (state: RootState) => state.game.assignments;
export const selectCanAddMove = (state: RootState) =>
  state.game.selectedDestinationId !== undefined && state.game.selectedUnitIds.length > 0;
export const selectCityControl = (state: RootState) => state.game.cityControl;
export const selectControl = (state: RootState) => state.game.control;
export const selectDraftAction = (state: RootState) => state.game.draftAction;
export const selectDraftOrders = (state: RootState) => state.game.draftOrders;
export const selectGamePhase = (state: RootState) => state.game.phase;
export const selectHandoffFromFaction = (state: RootState) =>
  state.game.handoffFromFactionId === undefined ? undefined : factionById(state.game.handoffFromFactionId);
export const selectHistory = (state: RootState) => state.game.history;
export const selectLegalDestinationIds = (state: RootState): readonly TerritoryId[] => {
  if (state.game.draftAction !== "move" || state.game.selectedFromTerritoryId === undefined) {
    return noTerritoryIds;
  }
  return milestone2Scenario.territories.find(
    (territory) => territory.id === state.game.selectedFromTerritoryId
  )?.adjacent ?? noTerritoryIds;
};
export const selectResolution = (state: RootState) => state.game.resolution;
export const selectResolutionSummary = (state: RootState) => state.game.resolution?.summaryLines ?? noSummaryLines;
export const selectSelectedDestinationId = (state: RootState) => state.game.selectedDestinationId;
export const selectSelectedFromTerritoryId = (state: RootState) => state.game.selectedFromTerritoryId;
export const selectSelectedUnitIds = (state: RootState) => state.game.selectedUnitIds;
export const selectValidationMessage = (state: RootState) => state.game.validationMessage;
export const selectTurnDate = (state: RootState) => `Turn ${state.game.turnNumber} · ${milestone2Scenario.snapshotLabel}`;

export const selectSubmissionStatus = createSelector([selectSubmittedOrderRecord], (submissions) =>
  factionOrder.map((factionId) => ({
    factionId,
    factionName: factionById(factionId).name,
    ready: submissions[factionId] !== undefined
  }))
);

export const selectRevealedOrders = createSelector([selectSubmittedOrderRecord], (submissions) =>
  factionOrder.flatMap((factionId) => {
    const submission = submissions[factionId];
    if (submission === undefined) return [];
    return [{
      factionId,
      factionName: factionById(factionId).name,
      description: submission.orders.length === 0
        ? "All formations held"
        : submission.orders.map(describeOrder).join(", ")
    }];
  })
);

export const selectUnits = createSelector([selectUnitRecord], (units): readonly UnitState[] => Object.values(units));
export const selectUnitsWithFactionNames = createSelector([selectUnitRecord], (units) =>
  Object.values(units).map((unit) => ({
    ...unit,
    factionName: factionById(unit.factionId).name,
    territoryName: territoryName(unit.territoryId)
  }))
);

function describeOrder(order: MoveOrder): string {
  return `${stateUnitName(order.unitId)}: ${territoryName(order.from)} to ${territoryName(order.to)}`;
}

function stateUnitName(unitId: UnitId): string {
  return milestone2Scenario.units[unitId]!.displayName;
}

function factionById(factionId: FactionId) {
  const faction = milestone2Scenario.factions.find((candidate) => candidate.id === factionId);
  if (faction === undefined) throw new Error(`Unknown faction: ${factionId}`);
  return faction;
}

function territoryName(territoryId: TerritoryId): string {
  return milestone2Scenario.territories.find((territory) => territory.id === territoryId)!.name;
}
