import type { GameState, ScenarioDefinition } from "../engine/types";

export const milestone1Scenario: ScenarioDefinition = {
  factions: [
    { abbreviation: "COM", color: "#b85b4c", id: "com", name: "Player 1" },
    { abbreviation: "ROY", color: "#c7a642", id: "roy", name: "Player 2" },
    { abbreviation: "FAS", color: "#7b5aa6", id: "fas", name: "Player 3" }
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
  initialControl: {
    north: "com",
    southwest: "roy",
    "eastern-port": "fas"
  },
  units: {
    "com-inf-001": {
      displayName: "1st International Infantry",
      factionId: "com",
      id: "com-inf-001",
      type: "infantry",
      territoryId: "north"
    },
    "roy-inf-001": {
      displayName: "1st Royal Infantry",
      factionId: "roy",
      id: "roy-inf-001",
      type: "infantry",
      territoryId: "southwest"
    },
    "fas-inf-001": {
      displayName: "1st Falangist Infantry",
      factionId: "fas",
      id: "fas-inf-001",
      type: "infantry",
      territoryId: "eastern-port"
    }
  }
};

export function createInitialGameState(): GameState {
  return {
    control: structuredClone(milestone1Scenario.initialControl),
    turnNumber: 1,
    units: structuredClone(milestone1Scenario.units)
  };
}
