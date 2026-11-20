import tinyMap from "./fixtures/scenarios/tiny-front/map.json";
import tinyScenario from "./fixtures/scenarios/tiny-front/scenario.json";

/**
 * An `m3-modular` variant of the tiny-front fixture with every Milestone 3 block filled, for
 * loader and contract tests. Built in code so each test starts from a fresh copy.
 */
export type Json = Record<string, unknown>;

const grades = [
  ["attacker-destroyed", 100, "none", 0, "none", 0],
  ["attack-checked", 10, "none", 0, "none", 0],
  ["stalemate", 10, "none", 10, "none", 0],
  ["gives-ground", 10, "none", 10, "none", 1],
  ["driven-out", 10, "none", 20, "half", "all"]
] as const;

/** Column k uses grades k-shifted along the catalogue, so better odds give better grades. */
function d20Table(): string[][] {
  return Array.from({ length: 7 }, (_, column) =>
    Array.from({ length: 21 }, (_, score) => grades[Math.min(grades.length - 1, Math.floor((score + 3 * column) / 6))]?.[0] ?? "stalemate"));
}

const sub = (id: string, territoryId: string, startHolder: string, extra: Json = {}): Json => ({
  id, name: id, territoryId, terrain: "open", startHolder, rail: 1, port: 0, note: "Invented for tests.", ...extra
});

export function modularScenario(): Json {
  const base = structuredClone(tinyScenario) as unknown as Json;
  const factions = (base["factions"] as Json[]).map((faction) => ({ ...faction, startingStock: { funds: 10, manpower: 5 }, seatTerritoryId: faction["id"] === "red" ? "westfold" : "harbor" }));
  const ai = base["ai"] as Json;
  const profiles = Object.fromEntries(Object.entries(ai["profiles"] as Record<string, Json>).map(([id, profile]) => [id, { ...profile, builds: { spendShare: 0.6, maxOrdersPerTurn: 3, itemsPerEmptyQueue: 1 } }]));
  const capitals: Record<string, string> = { westfold: "west-town-quarter", highlands: "highlands", harbor: "port-quarter", lowlands: "lowlands", isle: "isle" };
  return {
    ...base,
    ruleset: "m3-modular",
    ai: { ...ai, profiles },
    rules: { dice: "d20-graded", economy: "development", recruitment: "buildings", weather: "seasonal-zones", movement: "allowance", partition: "provinces", air: "missions" },
    factions,
    territories: (base["territories"] as Json[]).map((territory) => ({ ...territory, capitalSubTerritoryId: capitals[territory["id"] as string], weatherZone: "plains" })),
    connections: (base["connections"] as Json[]).map((connection) => ({ ...connection, entry: (connection["between"] as string[]).map((id) => capitals[id]) })),
    cities: (base["cities"] as Json[]).map((city) => ({ ...city, subTerritoryId: capitals[city["territoryId"] as string] })),
    units: [
      ...(base["units"] as Json[]),
      { id: "red-staff", name: "Red Staff", factionId: "red", type: "staff", formationKind: "other", strength: 50, fullStrength: 50, territoryId: "westfold", generalId: "red-1", sources: [{ sourceId: "fixture" }] }
    ],
    unitTypes: [
      { id: "foot", name: "Foot", attack: 4, defence: 5, kind: "ground", symbol: "infantry", orders: ["move", "withdraw", "replenish"], recruit: { cost: { funds: 4, manpower: 2 }, establishment: 400, trainingTurns: 2, requires: ["barracks"] } },
      { id: "guns", name: "Guns", attack: 3, defence: 2, kind: "ground", symbol: "artillery", orders: ["move"], effects: [{ kind: "roll-bonus-per-points", role: "attack", per: 3, bonus: 1, max: 3, exceptWeather: ["mud"] }, { kind: "cannot-attack-alone" }] },
      { id: "wing", name: "Wing", attack: 0, defence: 1, kind: "air", symbol: "fixed-wing", orders: ["air-mission"], air: { range: 2, missions: ["raid", "recon"] } },
      { id: "staff", name: "Staff", attack: 0, defence: 0, kind: "general", symbol: "headquarters", orders: ["move", "sack"], effects: [{ kind: "command-bonus", roll: 1 }, { kind: "rally" }] }
    ],
    subTerritories: [
      sub("west-town-quarter", "westfold", "red", { development: { farms: 1, industry: 1 }, buildings: ["barracks"], rail: 2 }),
      sub("west-hills", "westfold", "red", { terrain: "mountain", development: { farms: 2 } }),
      sub("highlands", "highlands", "red", { terrain: "mountain" }),
      sub("port-quarter", "harbor", "blue", { port: 2, buildings: ["barracks"], development: { industry: 2 } }),
      sub("lowlands", "lowlands", "blue"),
      sub("isle", "isle", "blue", { port: 1, rail: 0, sources: [{ sourceId: "fixture" }] }),
      // The isle starts contested (red and blue), so red holds a cove there (L26).
      sub("isle-cove", "isle", "red", { rail: 0 })
    ],
    subTerritoryBorders: [["isle", "isle-cove"], ["west-town-quarter", "west-hills"], ["west-hills", "highlands"], ["highlands", "port-quarter"], ["port-quarter", "lowlands"], ["lowlands", "west-town-quarter"]],
    resources: [{ id: "funds", name: "Funds" }, { id: "manpower", name: "Manpower" }],
    development: [
      { id: "farms", name: "Farms", resource: "manpower", yieldPerLevel: 1, maxLevel: 3, upgrade: { cost: { funds: 3 }, turns: 2 } },
      { id: "industry", name: "Industry", resource: "funds", yieldPerLevel: 2, maxLevel: 3, cityOnly: true, upgrade: { cost: { funds: 6 }, turns: 3 } }
    ],
    buildings: [
      { id: "barracks", name: "Barracks", cost: { funds: 4 }, turns: 2 },
      { id: "airfield", name: "Airfield", cost: { funds: 6 }, turns: 3, effects: [{ kind: "airbase" }] },
      { id: "paved-airfield", name: "Paved airfield", cost: { funds: 4 }, turns: 2, upgradeOf: "airfield", effects: [{ kind: "all-weather-airbase" }] },
      { id: "palace", name: "Palace", cost: { funds: 9 }, turns: 4, capitalOnly: true, cityOnly: true }
    ],
    improvements: { rail: { cost: { funds: 3 }, turns: 2, maxLevel: 3 }, port: { cost: { funds: 4 }, turns: 3, maxLevel: 2 }, railDamageOnContest: 1 },
    recruitment: { maxPerTerritory: 2, replenishCostShare: 0.5, replenishShare: 0.5 },
    movement: { landingsPerPortLevel: 1, railRangePerLevel: 2 },
    d20: {
      grades: grades.map(([id, attackerLoss, attackerMorale, defenderLoss, defenderMorale, ground]) => ({
        id, name: id, attacker: { lossPercent: attackerLoss, demoralized: attackerMorale }, defender: { lossPercent: defenderLoss, demoralized: defenderMorale }, ground
      })),
      table: d20Table(),
      modifiers: { worksPerTurn: 3, worksMax: 9, belowOneToOnePenalty: 3, barricades: 1, fatigued: -2, amphibious: -4 },
      fatigue: { fatiguedLevel: 2, demoralizedLevel: 3 },
      breakUpShare: 0.1,
      factionModifiers: [{ id: "harbor-batteries", name: "Harbor batteries", factionId: "blue", when: "holds-controlled-city", defence: 3 }]
    },
    weather: {
      outcomes: [
        { id: "clear", name: "Clear", attackRoll: 0 },
        { id: "mud", name: "Mud", attackRoll: -3, effects: [{ kind: "movement-penalty", amount: 1 }, { kind: "grounds-aircraft" }] },
        { id: "snow", name: "Snow", attackRoll: -3, effects: [{ kind: "blocks-digging-in" }, { kind: "closes-sea", months: [12, 1, 2] }] }
      ],
      seasons: [{ id: "summer", name: "Summer", months: [4, 5, 6, 7, 8, 9] }, { id: "winter", name: "Winter", months: [10, 11, 12, 1, 2, 3] }],
      zones: [{ id: "plains", name: "Plains", coastal: true, tables: { summer: [{ outcome: "clear", upTo: 20 }], winter: [{ outcome: "clear", upTo: 10 }, { outcome: "mud", upTo: 16 }, { outcome: "snow", upTo: 20 }] } }]
    },
    calendar: { start: { year: 1936, month: 7, half: "late" }, turnsPerYear: 24 },
    air: { raidTable: [{ outcome: "air-eliminated", upTo: 2 }, { outcome: "nothing-hit", upTo: 10 }, { outcome: "income-cut", upTo: 17 }, { outcome: "building-hit", upTo: 20 }], interceptRoll: -2, reconTurns: 1 },
    generals: {
      traits: [{ id: "bold", name: "Bold", effects: [{ kind: "roll-modifier", role: "attack", roll: 1 }] }, { id: "timid", name: "Timid", effects: [{ kind: "no-rally" }] }],
      roster: ["red-1", "red-2", "red-3", "blue-1", "blue-2", "blue-3"].map((id) => ({ id, name: id, factionId: id.split("-")[0], trait: id.endsWith("1") ? "bold" : "timid", sources: [{ sourceId: "fixture" }] }))
    }
  };
}

/** The tiny map, with symbols for the modular fixture's extra unit types. */
export function modularMap(): Json {
  const map = structuredClone(tinyMap) as unknown as Json;
  const symbol = "src/test/fixtures/scenarios/tiny-front/foot.svg";
  map["unitSymbols"] = { foot: symbol, guns: symbol, wing: symbol, staff: symbol };
  return map;
}
