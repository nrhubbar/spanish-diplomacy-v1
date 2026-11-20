import { describe, expect, it } from "vitest";
import { planAirMissions } from "../main/ai/orders/air-mission";
import { planBuilds } from "../main/ai/orders/build";
import type { PlanningContext } from "../main/ai/orders/planner";
import { planSackings } from "../main/ai/orders/sack";
import { planWithdrawals } from "../main/ai/orders/withdraw";
import { seededRandom } from "../main/engine/random";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, QueueItem, SubTerritoryId, TrainingItem, UnitId, UnitTypeId } from "../main/engine/types";
import { viewFor } from "../main/engine/visibility";
import { loadPackage } from "../main/scenarios/loader";
import { modularMap, modularScenario } from "./modularFixture";
import { faction, territory, tiny } from "./support";

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
const scenario = loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "m", scenarioDocument: modularScenario(), scenarioPath: "s" }).scenario;

const queued = (factionId: string): QueueItem => ({ factionId: faction(factionId), paid: { ["funds" as never]: 4 }, progress: 0, project: { buildingId: "airfield" as never, kind: "building" } });
const training = (factionId: string, territoryId: string): TrainingItem => ({
  factionId: faction(factionId), paid: {}, paused: false, territoryId: territory(territoryId), turnsLeft: 1, typeId: "foot" as UnitTypeId, unitId: `${factionId}-recruit` as UnitId
});

function busyState(): GameState {
  const start = initialGameState(scenario);
  const port = "port-quarter" as SubTerritoryId;
  const west = "west-town-quarter" as SubTerritoryId;
  return {
    ...start,
    subTerritories: {
      ...start.subTerritories,
      [port]: { ...start.subTerritories[port]!, queue: [queued("blue")] },
      [west]: { ...start.subTerritories[west]!, queue: [queued("red")] }
    },
    training: [training("red", "westfold"), training("blue", "harbor")]
  };
}

describe("per-viewer state ($6, U4)", () => {
  it("hides other factions' balances, queues and training", () => {
    const view = viewFor(scenario, busyState(), faction("red"));
    expect(Object.keys(view.treasuries)).toEqual(["red"]);
    expect(view.subTerritories["port-quarter" as SubTerritoryId]?.queue).toEqual([]);
    expect(view.subTerritories["west-town-quarter" as SubTerritoryId]?.queue).toHaveLength(1);
    expect(view.training.map((item) => item.factionId)).toEqual(["red"]);
  });

  it("shows a recon-revealed territory's holder balances, queues and training, for this turn only", () => {
    const state: GameState = {
      ...busyState(),
      reveals: [
        { territoryId: territory("harbor"), untilTurn: 1, viewerFactionId: faction("red") },
        { territoryId: territory("westfold"), untilTurn: 1, viewerFactionId: faction("blue") },
        { territoryId: territory("lowlands"), untilTurn: 0, viewerFactionId: faction("red") },
        { territoryId: territory("isle"), untilTurn: 2, viewerFactionId: faction("red") }
      ]
    };
    const view = viewFor(scenario, state, faction("red"));
    expect(Object.keys(view.treasuries).sort()).toEqual(["blue", "red"]);
    expect(view.subTerritories["port-quarter" as SubTerritoryId]?.queue).toHaveLength(1);
    expect(view.training).toHaveLength(2);
    expect(view.reveals).toEqual([state.reveals[0], state.reveals[3]]);
  });

  it("changes nothing under m2-strength", () => {
    const state = initialGameState(tiny());
    expect(viewFor(tiny(), state, faction("red"))).toEqual(state);
  });
});

describe("order planner stubs (H5)", () => {
  it("plan no orders until their slices land", () => {
    const context: PlanningContext = { factionId: faction("red"), memory: {}, planned: [], random: seededRandom(1), scenario, state: initialGameState(scenario) };
    // Recruit and Replenish planners are tested in recruitmentAi.test.ts.
    for (const planner of [planWithdrawals, planBuilds, planAirMissions, planSackings]) {
      expect(planner(context)).toEqual([]);
    }
  });
});
