import type { GameState, ScenarioDefinition } from "../engine/types";

export const milestone1Scenario: ScenarioDefinition = {
  factions: [
    { id: "player-1", name: "Player 1" },
    { id: "player-2", name: "Player 2" },
    { id: "player-3", name: "Player 3" }
  ],
  territories: [
    {
      id: "north",
      name: "North",
      adjacent: ["center", "southwest", "eastern-port"]
    },
    {
      id: "center",
      name: "Center",
      adjacent: ["north", "southwest", "eastern-port"]
    },
    {
      id: "southwest",
      name: "Southwest",
      adjacent: ["north", "center", "eastern-port"]
    },
    {
      id: "eastern-port",
      name: "Eastern Port",
      adjacent: ["north", "center", "southwest"]
    }
  ],
  units: {
    "soldier-1": {
      id: "soldier-1",
      factionId: "player-1",
      type: "soldier",
      territoryId: "north"
    },
    "soldier-2": {
      id: "soldier-2",
      factionId: "player-2",
      type: "soldier",
      territoryId: "southwest"
    },
    "soldier-3": {
      id: "soldier-3",
      factionId: "player-3",
      type: "soldier",
      territoryId: "eastern-port"
    }
  }
};

export function createInitialGameState(): GameState {
  return {
    turnNumber: 1,
    units: structuredClone(milestone1Scenario.units)
  };
}
