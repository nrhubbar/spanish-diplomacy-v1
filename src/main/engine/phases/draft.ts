import type { PendingBattle } from "../d20/battle";
import type { Armies } from "../board";
import type { BattleDice, RollStreams } from "../dice";
import type { FrontResolution } from "../d20/front";
import type { MeetingResolution } from "../d20/meeting";
import type { Settled } from "../retreat";
import type {
  GameState,
  InvalidOrderOutcome,
  MoveOrder,
  PlayerSubmission,
  RecoveredOutcome,
  RejectedOrderOutcome,
  Scenario,
  SubTerritoryChange,
  SystemOutcome,
  TerritoryId,
  UnitId,
  VictoryProgress,
  VictoryResult
} from "../types";

/** What a turn is resolved from. Never changes while the turn resolves. */
export interface TurnInput {
  /** M26: each battle's own seeded stream; tests may load the dice. */
  readonly dice: BattleDice;
  readonly scenario: Scenario;
  /** The start-of-turn state; orders validate against it (M1). */
  readonly start: GameState;
  /** Section 2: the seeded streams of the other roll kinds (weather, raid, general death). */
  readonly streams: RollStreams;
  readonly submissions: readonly PlayerSubmission[];
}

/** Step 1's sorting of the submitted orders (M1, M9, M11). */
export interface RevealedOrders {
  /** Valid moves that are not reinforcements. */
  readonly advances: readonly MoveOrder[];
  readonly invalid: readonly InvalidOrderOutcome[];
  /** Each validly moving unit's origin. */
  readonly origins: ReadonlyMap<UnitId, TerritoryId>;
  readonly reinforcements: readonly MoveOrder[];
  readonly rejected: readonly RejectedOrderOutcome[];
  readonly valid: readonly MoveOrder[];
}

/** The Milestone 3 part of the state, which the new phases update. */
export type SystemState = Omit<GameState, "cityControl" | "control" | "fortification" | "turnNumber" | "units">;

/**
 * A turn being resolved: each phase takes the draft and returns the next one (section 2).
 * Fields a phase has not reached yet hold their empty or start-of-turn values.
 */
export interface TurnDraft {
  /** Units where they stand now, with their men, morale and fatigue. */
  readonly armies: Armies;
  readonly control: Pick<GameState, "cityControl" | "control">;
  /** Outcomes of the Milestone 3 systems, in the order phases add them. */
  readonly events: readonly SystemOutcome[];
  readonly fortification: GameState["fortification"];
  /** Step 5's territory battles, arrivals and departures (M17-M19). */
  readonly front: FrontResolution;
  readonly input: TurnInput;
  /** Step 4's meeting battles (M20). */
  readonly meetings: MeetingResolution;
  readonly orders: RevealedOrders;
  readonly recovered: readonly RecoveredOutcome[];
  /** Each area's turn-only data (`TurnScratch`). */
  readonly scratch: TurnScratch;
  /** Returns, retreats and surrenders settled by steps 6 and 7 (M21). */
  readonly settled: readonly Settled[];
  /** Step 7's standing battles (M27). */
  readonly standing: readonly PendingBattle[];
  readonly subTerritoryChanges: readonly SubTerritoryChange[];
  readonly systems: SystemState;
  readonly victory: { readonly progress: readonly VictoryProgress[]; readonly result?: VictoryResult };
}

/**
 * Turn-only data a module passes between its own parts (bombers assigned at step 2 and read at
 * step 5, a move's rail and sea legs). Each area declares its own key in its module file by
 * declaration merging, `declare module "../phases/draft" { interface TurnScratch { ... } }`, so
 * no slice edits this file. The draft starts with no keys set.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- filled by declaration merging in engine/modules/<area>.ts
export interface TurnScratch {}

/** One step of the turn (section 2), or one module's part of it. */
export type Phase = (draft: TurnDraft) => TurnDraft;

export function startDraft(input: TurnInput): TurnDraft {
  const { start } = input;
  const { cityControl, control, fortification, units } = start;
  const { generals, raidCuts, raised, reveals, subTerritories, training, treasuries } = start;
  const systems: SystemState = {
    generals, raidCuts, raised, reveals, subTerritories, training, treasuries,
    ...(start.carry === undefined ? {} : { carry: start.carry }),
    ...(start.builtLinks === undefined ? {} : { builtLinks: start.builtLinks }),
    ...(start.weather === undefined ? {} : { weather: start.weather })
  };
  return {
    armies: units,
    control: { cityControl, control },
    events: [],
    fortification,
    front: { armies: units, arrivals: [], battles: [], leaving: [] },
    input,
    meetings: { armies: units, battles: [], bounced: [], continuing: [] },
    orders: { advances: [], invalid: [], origins: new Map(), reinforcements: [], rejected: [], valid: [] },
    recovered: [],
    scratch: {},
    settled: [],
    standing: [],
    subTerritoryChanges: [],
    systems,
    victory: { progress: [] }
  };
}

/** The state the draft has reached. After the last phase it is the turn's final state. */
export function draftState(draft: TurnDraft): GameState {
  return {
    ...draft.input.start,
    ...draft.systems,
    ...draft.control,
    fortification: draft.fortification,
    units: draft.armies
  };
}
