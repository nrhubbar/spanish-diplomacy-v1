import type { BuildingDefinition, DevelopmentDefinition, FactionModifier, GameState, Resources, Scenario, SubTerritoryDefinition, UnitTypeDefinition } from "../main/engine/types";

/**
 * A scenario with prices, values and road rules of its own, for tests whose sums use them as a
 * fixture. The shipped numbers are the owner's to change, and these tests do not move with them;
 * the tests that state the shipped numbers read the scenario as it is.
 */

/** A price in the Spain scenario's resources; resource ids are branded, so this is the one place that names them. */
const price = (funds: number, manpower?: number): Resources => ({ funds, ...(manpower === undefined ? {} : { manpower }) }) as Resources;

type UnitNumbers = Pick<UnitTypeDefinition, "attack" | "defence"> & { readonly funds: number; readonly manpower: number; readonly trainingTurns: number };

const units: Readonly<Record<string, UnitNumbers>> = {
  "colonial-veterans": { attack: 6, defence: 5, funds: 8, manpower: 2, trainingTurns: 2 },
  "infantry-regiment": { attack: 4, defence: 6, funds: 6, manpower: 1, trainingTurns: 2 },
  "militia-column": { attack: 3, defence: 4, funds: 2, manpower: 3, trainingTurns: 1 },
  "security-forces": { attack: 3, defence: 5, funds: 6, manpower: 2, trainingTurns: 2 }
};

const buildings: Readonly<Record<string, { readonly funds: number; readonly turns: number }>> = {
  barracks: { funds: 6, turns: 2 },
  depot: { funds: 8, turns: 2 },
  fortifications: { funds: 6, turns: 2 },
  hospital: { funds: 6, turns: 2 }
};

const tracks: Readonly<Record<string, { readonly funds: number; readonly turns: number }>> = { farms: { funds: 6, turns: 3 }, mines: { funds: 8, turns: 3 } };

function pinnedUnit(type: UnitTypeDefinition): UnitTypeDefinition {
  const numbers = units[type.id];
  if (numbers === undefined || type.recruit === undefined) return type;
  const { attack, defence, funds, manpower, trainingTurns } = numbers;
  return { ...type, attack, defence, recruit: { ...type.recruit, cost: price(funds, manpower), trainingTurns } };
}

function pinnedBuilding(building: BuildingDefinition): BuildingDefinition {
  const numbers = buildings[building.id];
  return numbers === undefined ? building : { ...building, cost: price(numbers.funds), turns: numbers.turns };
}

function pinnedTrack(track: DevelopmentDefinition): DevelopmentDefinition {
  const numbers = tracks[track.id];
  return numbers === undefined ? track : { ...track, upgrade: { cost: price(numbers.funds), turns: numbers.turns } };
}

const byId = <T extends { readonly id: string }>(items: readonly T[]): ReadonlyMap<T["id"], T> => new Map(items.map((item) => [item.id, item]));

/** Rev 4 Funds prices; the Rev 5 ones are a quarter dearer and each unit also costs Funds a turn. */
const revFourFunds: Readonly<Record<string, number>> = {
  "anti-air-battery": 5,
  "artillery-group": 6,
  "bomber-squadron": 7,
  "cavalry-regiment": 4,
  "colonial-veterans": 7,
  "fighter-squadron": 6,
  "infantry-regiment": 5,
  "militia-column": 3,
  "recon-flight": 5,
  "security-forces": 4,
  "tank-company": 8,
  "truck-column": 3
};

/** Spain with units that cost no Funds a turn, for tests of a resource that no upkeep takes. */
export function withoutFundsUpkeep(scenario: Scenario): Scenario {
  const unitTypes = scenario.unitTypes.map((type) => ({ ...type, upkeep: Object.fromEntries(Object.entries(type.upkeep).filter(([id]) => id !== "funds")) as Resources }));
  return { ...scenario, index: { ...scenario.index, unitTypes: byId(unitTypes) }, unitTypes };
}

/** Rev 4 prices and yields of the development tracks. */
const revFourTracks: Readonly<Record<string, { readonly funds: number; readonly yieldPerLevel: number }>> = {
  factory: { funds: 6, yieldPerLevel: 1.5 },
  farms: { funds: 3, yieldPerLevel: 0.6 },
  mines: { funds: 5, yieldPerLevel: 1 }
};

/** Spain with the Rev 4 unit and development numbers and no Funds upkeep, for tests of how the computer ranks units, which were written against those numbers. */
export function revFourNumbers(scenario: Scenario): Scenario {
  const plain = withoutFundsUpkeep(scenario);
  const development = plain.development.map((track) => {
    const numbers = revFourTracks[track.id];
    return numbers === undefined ? track : { ...track, upgrade: { ...track.upgrade, cost: { ...track.upgrade.cost, funds: numbers.funds } as Resources }, yieldPerLevel: numbers.yieldPerLevel };
  });
  const unitTypes = plain.unitTypes.map((type) => {
    const funds = revFourFunds[type.id];
    return type.recruit === undefined || funds === undefined ? type : { ...type, recruit: { ...type.recruit, cost: { ...type.recruit.cost, funds } as Resources } };
  });
  return { ...plain, development, index: { ...plain.index, development: byId(development), unitTypes: byId(unitTypes) }, unitTypes };
}

/** Trucks need main roads, so a track stops them and a road upgrade opens a route. */
export function mainRoadsOnly(scenario: Scenario): Scenario {
  const { road } = scenario.linkModifiers;
  return road === undefined ? scenario : { ...scenario, linkModifiers: { ...scenario.linkModifiers, road: { ...road, motorLevel: "main" } } };
}

const works = "fortifications";

/** A state with no fortifications standing, for tests that count a battle's modifiers or build them. */
export function unfortified(state: GameState): GameState {
  return { ...state, subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, { ...site, buildings: site.buildings.filter((building) => building !== works) }])) };
}

/** A state with fortifications standing in these sub-territories, for tests that need a garrison behind them. */
export function fortified(state: GameState, ...ids: readonly string[]): GameState {
  return { ...state, subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, ids.includes(id) && !site.buildings.includes(works as never) ? { ...site, buildings: [...site.buildings, works as never] } : site])) };
}

/** Spain with a faction's own die modifier, a mechanism its data does not use now. */
export function popularResistance(scenario: Scenario): Scenario {
  const modifier: FactionModifier = { attack: 0, defence: 3, factionId: "republic" as FactionModifier["factionId"], id: "popular-resistance", name: "Popular resistance", when: "holds-controlled-city" };
  return { ...scenario, d20: { ...scenario.d20, factionModifiers: [modifier] } };
}

function pinnedSite(sub: SubTerritoryDefinition): SubTerritoryDefinition {
  return { ...sub, buildings: sub.buildings.filter((building) => building !== works) };
}

/** Barricades worth 1, whatever they ship at. */
export function lightBarricades(scenario: Scenario): Scenario {
  return { ...scenario, d20: { ...scenario.d20, modifiers: { ...scenario.d20.modifiers, barricades: 1 } } };
}

export function pinned(scenario: Scenario): Scenario {
  const unitTypes = scenario.unitTypes.map(pinnedUnit);
  const pinnedBuildings = scenario.buildings.map(pinnedBuilding);
  const development = scenario.development.map(pinnedTrack);
  const subTerritories = scenario.subTerritories.map(pinnedSite);
  return {
    ...mainRoadsOnly(scenario),
    buildings: pinnedBuildings,
    development,
    index: { ...scenario.index, buildings: byId(pinnedBuildings), development: byId(development), subTerritories: byId(subTerritories), unitTypes: byId(unitTypes) },
    linkProjects: { "new-rail": { cost: price(24), turns: 8 }, "rail-upgrade": { cost: price(10), turns: 4 }, "road-upgrade": { cost: price(6), turns: 2 } },
    subTerritories,
    unitTypes
  };
}
