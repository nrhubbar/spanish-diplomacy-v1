import type { BattleDice } from "./dice";
import { initialSystems } from "./initialSystems";
import { startDraft, type TurnInput } from "./phases/draft";
import { runTurnSteps } from "./phases/pipeline";
import { turnResult } from "./phases/result";
import { type Rolls, rollSource } from "./rolls";
import type {
  CityId,
  FactionId,
  GameState,
  PlayerSubmission,
  Scenario,
  TerritoryControl,
  TerritoryId,
  TurnResolutionResult,
  UnitId,
  UnitState
} from "./types";

/**
 * Resolves one turn as the ordered steps of section 2 (`phases/`), each made of the engine's
 * own part and the selected rule modules' parts. Rule ids refer to
 * `project/specs/scenario-package.md`. Pure: the same scenario, state, orders, and rolls always
 * give the same result. `dice` stands in for the battle streams in tests only.
 */
export function resolveTurn(
  scenario: Scenario,
  state: GameState,
  submissions: readonly PlayerSubmission[],
  rolls: Rolls,
  dice?: BattleDice
): TurnResolutionResult {
  const { turnNumber } = state;
  const source = rollSource(rolls);
  const input: TurnInput = {
    dice: dice ?? ((battleIndex) => source.stream("battle", turnNumber, battleIndex)),
    scenario,
    start: state,
    streams: (kind, index) => source.stream(kind, turnNumber, index),
    submissions
  };
  return turnResult(runTurnSteps(scenario, startDraft(input)));
}

export function initialGameState(scenario: Scenario): GameState {
  const control: Record<TerritoryId, TerritoryControl> = {};
  for (const territory of scenario.territories) {
    control[territory.id] = territory.initialControl;
  }
  const cityControl: Record<CityId, FactionId> = {};
  for (const city of scenario.cities) {
    if (city.initialController !== undefined) {
      cityControl[city.id] = city.initialController;
    }
  }
  const units: Record<UnitId, UnitState> = {};
  for (const unit of scenario.units) {
    units[unit.id] = {
      factionId: unit.factionId,
      fatigue: 0,
      id: unit.id,
      morale: { demoralized: false, quietTurns: 0 },
      strength: unit.strength,
      territoryId: unit.territoryId,
      ...(unit.cityId === undefined ? {} : { cityId: unit.cityId })
    };
  }
  return { ...initialSystems(scenario), cityControl, control, fortification: {}, turnNumber: 1, units };
}
