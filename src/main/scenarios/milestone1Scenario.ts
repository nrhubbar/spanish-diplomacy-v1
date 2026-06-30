import type { GameState, ScenarioDefinition } from "../engine/types";
import { playableIberiaRegions } from "../maps/iberiaRegions";

export const milestone1Scenario: ScenarioDefinition = {
  factions: [
    { abbreviation: "COM", color: "#b85b4c", id: "com", name: "Player 1" },
    { abbreviation: "ROY", color: "#c7a642", id: "roy", name: "Player 2" },
    { abbreviation: "FAS", color: "#7b5aa6", id: "fas", name: "Player 3" }
  ],
  territories: playableIberiaRegions.map((region) => ({
    adjacent: region.adjacent,
    id: region.territoryId,
    name: region.name
  })),
  initialControl: {
    galicia: "com",
    catalunya: "roy",
    andalucia: "fas"
  },
  units: {
    "com-inf-001": {
      displayName: "1st International Infantry",
      factionId: "com",
      id: "com-inf-001",
      type: "infantry",
      territoryId: "galicia"
    },
    "roy-inf-001": {
      displayName: "1st Royal Infantry",
      factionId: "roy",
      id: "roy-inf-001",
      type: "infantry",
      territoryId: "catalunya"
    },
    "fas-inf-001": {
      displayName: "1st Falangist Infantry",
      factionId: "fas",
      id: "fas-inf-001",
      type: "infantry",
      territoryId: "andalucia"
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
