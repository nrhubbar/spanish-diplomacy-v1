import type {
  CityDefinition,
  FactionId,
  FormationKind,
  GameState,
  ScenarioDefinition,
  TerritoryControl,
  TerritoryId,
  UnitState
} from "../engine/types";
import { playableIberiaRegions } from "../maps/iberiaRegions";

const controlled = (factionId: FactionId): TerritoryControl => ({ kind: "controlled", factionId });
const contested = (...factionIds: FactionId[]): TerritoryControl => ({ kind: "contested", factionIds });

const initialControl: Record<TerritoryId, TerritoryControl> = {
  galicia: controlled("north"),
  asturias: contested("republic", "north"),
  cantabria: controlled("republic"),
  "pais-vasco": controlled("republic"),
  navarra: controlled("north"),
  "la-rioja": controlled("north"),
  aragon: contested("north", "republic"),
  madrid: controlled("republic"),
  "castilla-y-leon": controlled("north"),
  "castilla-la-mancha": controlled("republic"),
  extremadura: contested("republic", "south"),
  catalunya: controlled("republic"),
  valencia: controlled("republic"),
  "islas-baleares": contested("republic", "south"),
  andalucia: contested("republic", "south"),
  murcia: controlled("republic"),
  ceuta: controlled("south"),
  melilla: controlled("south"),
  canarias: controlled("south")
};

const cities: readonly CityDefinition[] = [
  city("a-coruna", "A Coruna", "galicia", 287, 558, "north"),
  city("oviedo", "Oviedo", "asturias", 321, 557, "north"),
  city("gijon", "Gijon", "asturias", 326, 553, "republic"),
  city("santander", "Santander", "cantabria", 349, 563, "republic"),
  city("bilbao", "Bilbao", "pais-vasco", 365, 570, "republic"),
  city("san-sebastian", "San Sebastian", "pais-vasco", 375, 573, "republic"),
  city("pamplona", "Pamplona", "navarra", 383, 580, "north"),
  city("burgos", "Burgos", "castilla-y-leon", 350, 588, "north"),
  city("valladolid", "Valladolid", "castilla-y-leon", 326, 599, "north"),
  city("salamanca", "Salamanca", "castilla-y-leon", 310, 610, "north"),
  city("zaragoza", "Zaragoza", "aragon", 389, 609, "north"),
  city("teruel", "Teruel", "aragon", 386, 630, "north"),
  city("barcelona", "Barcelona", "catalunya", 427, 607, "republic"),
  city("madrid", "Madrid", "madrid", 340, 622, "republic"),
  city("toledo", "Toledo", "castilla-la-mancha", 337, 635, "republic"),
  city("badajoz", "Badajoz", "extremadura", 294, 642, "republic"),
  city("valencia", "Valencia", "valencia", 392, 653, "republic"),
  city("albacete", "Albacete", "castilla-la-mancha", 362, 651, "republic"),
  city("alicante", "Alicante", "valencia", 384, 667, "republic"),
  city("cartagena", "Cartagena", "murcia", 370, 682, "republic"),
  city("seville", "Seville", "andalucia", 306, 674, "south"),
  city("cordoba", "Cordoba", "andalucia", 326, 664, "south"),
  city("granada", "Granada", "andalucia", 344, 681, "south"),
  city("malaga", "Malaga", "andalucia", 329, 690, "republic"),
  city("cadiz", "Cadiz", "andalucia", 302, 690, "south")
];

function city(
  id: string,
  name: string,
  territoryId: TerritoryId,
  x: number,
  y: number,
  _controller: FactionId
): CityDefinition {
  return { countsForVictory: true, id, name, territoryId, x, y };
}

const initialCityControl = Object.fromEntries(
  [
    ["a-coruna", "north"], ["oviedo", "north"], ["gijon", "republic"],
    ["santander", "republic"], ["bilbao", "republic"], ["san-sebastian", "republic"],
    ["pamplona", "north"], ["burgos", "north"], ["valladolid", "north"],
    ["salamanca", "north"], ["zaragoza", "north"], ["teruel", "north"],
    ["barcelona", "republic"], ["madrid", "republic"], ["toledo", "republic"],
    ["badajoz", "republic"], ["valencia", "republic"], ["albacete", "republic"],
    ["alicante", "republic"], ["cartagena", "republic"], ["seville", "south"],
    ["cordoba", "south"], ["granada", "south"], ["malaga", "republic"], ["cadiz", "south"]
  ] as const
) as Partial<Record<string, FactionId>>;

const sourceIds = ["nafziger-1936", "warwick-timeline"] as const;

function unit(
  id: string,
  displayName: string,
  factionId: FactionId,
  territoryId: TerritoryId,
  cityId: string,
  formationKind: FormationKind = "regiment",
  strength = 700
): UnitState {
  return {
    cityId,
    displayName,
    factionId,
    formationKind,
    historicalNote: "Representative formation mapped from the July 1936 garrison order of battle.",
    id,
    sourceIds: [...sourceIds],
    strength,
    territoryId,
    type: "infantry"
  };
}

const units = Object.fromEntries(
  [
    unit("rep-wad-ras-1", "Wad-Ras Infantry Regiment No. 1", "republic", "madrid", "madrid", "regiment", 740),
    unit("rep-covadonga-4", "Covadonga Infantry Regiment No. 4", "republic", "madrid", "madrid", "regiment", 740),
    unit("rep-otumba-9", "Otumba Infantry Regiment No. 9", "republic", "valencia", "valencia", "regiment", 760),
    unit("rep-guadalajara-10", "Guadalajara Infantry Regiment No. 10", "republic", "valencia", "valencia", "regiment", 760),
    unit("rep-badajoz-13", "Badajoz Infantry Regiment No. 13", "republic", "catalunya", "barcelona", "regiment", 720),
    unit("rep-alcantara-14", "Alcantara Infantry Regiment No. 14", "republic", "catalunya", "barcelona", "regiment", 720),
    unit("rep-asturian-militia", "Asturian Workers Militia", "republic", "asturias", "gijon", "column", 700),
    unit("rep-sevilla-34", "Sevilla Infantry Regiment No. 34", "republic", "murcia", "cartagena", "regiment", 730),
    unit("rep-vitoria-8", "Vitoria Infantry Regiment No. 8", "republic", "andalucia", "malaga", "regiment", 700),
    unit("north-zamora-29", "Zamora Infantry Regiment No. 29", "north", "galicia", "a-coruna", "regiment", 720),
    unit("north-san-marcial-22", "San Marcial Infantry Regiment No. 22", "north", "castilla-y-leon", "burgos", "regiment", 720),
    unit("north-san-quintin-25", "San Quintin Infantry Regiment No. 25", "north", "castilla-y-leon", "valladolid", "regiment", 720),
    unit("north-america-23", "America Infantry Regiment No. 23", "north", "navarra", "pamplona", "regiment", 720),
    unit("north-aragon-17", "Aragon Infantry Regiment No. 17", "north", "aragon", "zaragoza", "regiment", 700),
    unit("north-gerona-18", "Gerona Infantry Regiment No. 18", "north", "aragon", "zaragoza", "regiment", 700),
    unit("north-la-victoria-28", "La Victoria Infantry Regiment No. 28", "north", "castilla-y-leon", "salamanca", "regiment", 700),
    unit("north-milan-32", "Milan Infantry Regiment No. 32", "north", "asturias", "oviedo", "regiment", 700),
    unit("north-simancas-40", "Simancas Barracks Detachment", "north", "asturias", "gijon", "battalion", 650),
    unit("south-granada-6", "Granada Infantry Regiment No. 6", "south", "andalucia", "seville", "regiment", 700),
    unit("south-lepanto-5", "Lepanto Infantry Regiment No. 5", "south", "andalucia", "granada", "regiment", 700),
    unit("south-cadiz-33", "Cadiz Infantry Regiment No. 33", "south", "andalucia", "cadiz", "regiment", 700),
    unit("south-legion", "Spanish Legion Detachment", "south", "ceuta", "ceuta", "battalion", 850),
    unit("south-regulares", "Regulares Detachment", "south", "melilla", "melilla", "battalion", 850),
    unit("south-canarias-39", "Canarias Infantry Regiment No. 39", "south", "canarias", "las-palmas", "regiment", 680)
  ].map((entry) => [entry.id, entry])
);

export const milestone2Scenario: ScenarioDefinition = {
  cities,
  factions: [
    {
      abbreviation: "REP",
      color: "#b1493f",
      id: "republic",
      motivation: "Defend Madrid, Barcelona, Valencia, and the loyal northern cities.",
      name: "Republican Government",
      objectiveTerritoryIds: ["madrid", "catalunya", "valencia", "pais-vasco"]
    },
    {
      abbreviation: "NIC",
      color: "#b39232",
      id: "north",
      motivation: "Drive toward Madrid and connect the northern insurgent zone.",
      name: "Northern Insurgent Command",
      objectiveTerritoryIds: ["madrid", "asturias", "pais-vasco", "aragon"]
    },
    {
      abbreviation: "SIC",
      color: "#665089",
      id: "south",
      motivation: "Expand from Seville and the African bridgeheads toward Madrid.",
      name: "Southern Insurgent Command",
      objectiveTerritoryIds: ["extremadura", "madrid", "castilla-la-mancha", "andalucia"]
    }
  ],
  id: "spain-1936-07-31",
  initialCityControl,
  initialControl,
  snapshotLabel: "31 July 1936",
  territories: playableIberiaRegions.map((region) => ({
    adjacent: region.adjacent,
    countsForVictory: true,
    id: region.territoryId,
    name: region.name
  })),
  units
};

export function createInitialGameState(): GameState {
  return {
    cityControl: structuredClone(milestone2Scenario.initialCityControl),
    control: structuredClone(milestone2Scenario.initialControl),
    turnNumber: 1,
    units: structuredClone(milestone2Scenario.units)
  };
}
