// Source data for the `europe-1805` map package: projection, extents, art direction, water, and the
// sea crossings. The territories and sub-territories themselves (names, chief towns, and the modern
// provinces each is made of) are in `europe-1805-areas.json`. `scripts/build-europe-map.ts` reads both.

import type { LambertConformalConic } from "./projection.ts";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type LonLat = readonly [number, number];
type Rgb = readonly [number, number, number];

/** Lambert conformal conic centred on 50N 15E, standard parallels 40N and 60N. Map units are kilometres. */
export const projection: LambertConformalConic = { centralMeridian: 15, originLatitude: 50, radius: 6371.0088, standardParallels: [40, 60] };

/** Morocco to the North Cape, the Atlantic to the Caucasus. The camera never pans its centre outside it. */
export const viewBox: Rect = { x: -2700, y: -2500, width: 5300, height: 4800 };

/** Framed when a game starts: Lisbon to Kiev, Stockholm to Naples. The rest of the map is a pan away. */
export const focus: Rect = { x: -2050, y: -1150, width: 3200, height: 2500 };

/** Relief layers. Every side stays under 4096 texels, the size any WebGL device takes. */
export const terrain = {
  demZoom: 6,
  overview: { bounds: { x: -4200, y: -4000, width: 8200, height: 7800 } satisfies Rect, texelsPerUnit: 0.2, fade: 700 },
  detail: { bounds: viewBox, texelsPerUnit: 0.75, feather: 60 }
} as const;

/** The vendored inputs, and what the build checks them against. */
export const sources = {
  elevation: "scripts/sources/dem/terrarium-europe-z6.tif",
  geometry: "scripts/sources/naturalearth/europe-1805.topo.json",
  lakes: "scripts/sources/naturalearth/europe-lakes.geojson",
  manifest: "scripts/sources/europe-manifest.json",
  rivers: "scripts/sources/naturalearth/europe-rivers.geojson"
} as const;

export const areas = "scripts/map/europe-1805-areas.json";
export const scenarioPackage = "src/scenarios/third-coalition-1805/";
export const mapDocument = `${scenarioPackage}map.json`;
export const topologyDocument = `${scenarioPackage}sub-territory-topology.json`;

export const outputs = {
  detail: "assets/maps/europe-relief-detail.webp",
  geometry: "assets/maps/europe-regions.svg",
  overview: "assets/maps/europe-relief-overview.webp",
  subTerritories: "assets/maps/europe-sub-territories.svg"
} as const;

/** Places too small for a region of their own, drawn as a circle of this radius (km). */
export const enclaves: Readonly<Record<string, { readonly labelOffset: { readonly x: number; readonly y: number }; readonly radius: number }>> = {
  gibraltar: { labelOffset: { x: 0, y: 34 }, radius: 14 },
  malta: { labelOffset: { x: 0, y: 34 }, radius: 16 }
};

/** Land borders the simplified geometry is too coarse to show. */
export const handBorders: readonly (readonly [string, string])[] = [["gibraltar", "cadiz"]];

/** Sea crossings inside one territory, so that its sub-territories form one connected whole. */
export const seaLinks: readonly (readonly [string, string])[] = [["candia", "rhodes"], ["norrkoping", "visby"]];

/** Sea connections between territories, named by the sub-territory whose port is used at each end. */
export const seaCrossings: readonly (readonly [string, string])[] = [
  // The Channel, the North Sea and the Atlantic
  ["boulogne", "london"], ["brest", "plymouth"], ["brest", "cork"], ["antwerp", "london"], ["amsterdam", "london"],
  ["amsterdam", "york"], ["bremen", "norwich"], ["kiel", "norwich"], ["copenhagen", "norwich"], ["dublin", "york"],
  ["belfast", "edinburgh"], ["edinburgh", "christiansand"], ["plymouth", "corunna"], ["plymouth", "lisbon"],
  ["plymouth", "gibraltar"], ["bordeaux", "corunna"], ["la-rochelle", "bilbao"], ["lisbon", "cadiz"], ["lisbon", "tangier"],
  // The Baltic
  ["kiel", "copenhagen"], ["aarhus", "christiansand"], ["aarhus", "gothenburg"], ["copenhagen", "malmo"],
  ["copenhagen", "stralsund"], ["copenhagen", "christiania"], ["malmo", "stralsund"], ["visby", "riga"], ["stockholm", "abo"],
  ["stockholm", "reval"], ["helsingfors", "reval"], ["helsingfors", "petersburg"], ["danzig", "visby"], ["stettin", "copenhagen"],
  ["konigsberg", "riga"], ["umea", "uleaborg"], ["stettin", "stralsund"],
  // The western Mediterranean
  ["gibraltar", "tangier"], ["gibraltar", "palma"], ["gibraltar", "valletta"], ["cadiz", "tangier"], ["palma", "barcelona"],
  ["palma", "valencia"], ["palma", "algiers"], ["cartagena", "oran"], ["marseille", "ajaccio"], ["marseille", "palma"],
  ["marseille", "algiers"], ["genoa", "bastia"], ["bastia", "leghorn"], ["ajaccio", "sassari"], ["cagliari", "palermo"],
  ["cagliari", "tunis"], ["naples", "palermo"], ["naples", "cagliari"], ["palermo", "tunis"], ["messina", "valletta"],
  ["valletta", "tripoli"], ["valletta", "tunis"], ["valletta", "corfu"], ["valletta", "candia"], ["valletta", "alexandria"],
  ["marseille", "valletta"],
  // The Adriatic, the Aegean and the Levant
  ["venice", "zara"], ["ancona", "zara"], ["trieste", "ancona"], ["bari", "scutari"], ["bari", "corfu"], ["corfu", "scutari"],
  ["corfu", "tripolitza"], ["athens", "candia"], ["athens", "smyrna"], ["salonica", "smyrna"], ["rhodes", "smyrna"],
  ["candia", "alexandria"], ["candia", "benghazi"], ["rhodes", "nicosia"], ["nicosia", "acre"],
  ["nicosia", "alexandria"], ["alexandria", "acre"], ["salonica", "athens"],
  // The Black Sea
  ["constantinople", "sevastopol"], ["constantinople", "odessa"], ["odessa", "sevastopol"], ["odessa", "varna"],
  ["kaffa", "yekaterinodar"], ["kaffa", "trebizond"], ["kastamonu", "sevastopol"], ["kutaisi", "kaffa"],
  ["kutaisi", "trebizond"], ["constantinople", "trebizond"]
];

export const contextLabels: readonly { readonly text: string; readonly at: LonLat }[] = [
  { text: "Persia", at: [47.6, 37.3] },
  { text: "Mesopotamia", at: [42.4, 34.4] },
  { text: "Arabia", at: [38.5, 29.6] },
  { text: "Sahara", at: [2, 29.5] },
  { text: "Iceland", at: [-18.6, 64.9] },
  { text: "Astrakhan", at: [47, 47.2] },
  { text: "Kazan", at: [49.2, 55.6] },
  { text: "Daghestan", at: [46.9, 42.9] }
];

/** Straight names at a point; a name with two points follows the line between them. */
export const waterLabels: readonly { readonly text: string; readonly tier: "overview" | "operational" | "detail"; readonly at: readonly LonLat[] }[] = [
  { text: "Atlantic Ocean", tier: "overview", at: [[-14.5, 41], [-14.5, 50]] },
  { text: "North Sea", tier: "overview", at: [[1.2, 55.5], [6.2, 56.8]] },
  { text: "Norwegian Sea", tier: "overview", at: [[-2, 65], [8, 67.5]] },
  { text: "Mediterranean Sea", tier: "overview", at: [[15.5, 35.1], [24, 33.7]] },
  { text: "Black Sea", tier: "overview", at: [[30.2, 43.1], [38.2, 43.1]] },
  { text: "Baltic Sea", tier: "overview", at: [[16.2, 55.5], [19.8, 57.3]] },
  { text: "Bay of Biscay", tier: "operational", at: [[-4.6, 45.3]] },
  { text: "English Channel", tier: "operational", at: [[-2.4, 49.95]] },
  { text: "Irish Sea", tier: "detail", at: [[-5, 53.7]] },
  { text: "Skagerrak", tier: "detail", at: [[9.2, 57.9]] },
  { text: "Gulf of Bothnia", tier: "operational", at: [[19.4, 61.6]] },
  { text: "Gulf of Finland", tier: "detail", at: [[25.6, 59.85]] },
  { text: "White Sea", tier: "operational", at: [[37.5, 65.4]] },
  { text: "Tyrrhenian Sea", tier: "operational", at: [[12.1, 40]] },
  { text: "Adriatic Sea", tier: "operational", at: [[15.4, 43]] },
  { text: "Ionian Sea", tier: "operational", at: [[18.6, 38.2]] },
  { text: "Aegean Sea", tier: "operational", at: [[25, 38.9]] },
  { text: "Sea of Azov", tier: "detail", at: [[36.6, 46.1]] },
  { text: "Levantine Sea", tier: "operational", at: [[30.6, 33.4]] },
  { text: "Alboran Sea", tier: "detail", at: [[-3.2, 36]] }
];

/** Rivers drawn, by their Natural Earth names. `main` rivers show at every zoom. */
export const rivers: Readonly<Record<string, { readonly name: string; readonly rank: "main" | "tributary"; readonly source: readonly string[] }>> = {
  danube: { name: "Danube", rank: "main", source: ["Donau", "Danube"] },
  rhine: { name: "Rhine", rank: "main", source: ["Rhine", "Rhein", "Rhin", "Waal"] },
  elbe: { name: "Elbe", rank: "main", source: ["Elbe"] },
  oder: { name: "Oder", rank: "main", source: ["Oder"] },
  vistula: { name: "Vistula", rank: "main", source: ["Vistula"] },
  niemen: { name: "Niemen", rank: "main", source: ["Neman"] },
  dvina: { name: "Western Dvina", rank: "main", source: ["Daugava"] },
  dnieper: { name: "Dnieper", rank: "main", source: ["Dnipro", "Dnepre"] },
  dniester: { name: "Dniester", rank: "main", source: ["Dniester"] },
  don: { name: "Don", rank: "main", source: ["Don"] },
  volga: { name: "Volga", rank: "main", source: ["Volga"] },
  po: { name: "Po", rank: "main", source: ["Po"] },
  loire: { name: "Loire", rank: "main", source: ["Loire"] },
  seine: { name: "Seine", rank: "main", source: ["Seine"] },
  rhone: { name: "Rh\u00f4ne", rank: "main", source: ["Rh\u00f4ne", "Rhne"] },
  garonne: { name: "Garonne", rank: "main", source: ["Garonne"] },
  ebro: { name: "Ebro", rank: "main", source: ["Ebro"] },
  tagus: { name: "Tagus", rank: "main", source: ["Tajo", "Tejo"] },
  douro: { name: "Douro", rank: "main", source: ["Duero"] },
  guadalquivir: { name: "Guadalquivir", rank: "main", source: ["Guadalquivir"] },
  nile: { name: "Nile", rank: "main", source: ["Nile", "Damietta Branch", "Rosetta Branch"] },
  euphrates: { name: "Euphrates", rank: "main", source: ["Euphrates", "Firat", "Al Furat"] },
  inn: { name: "Inn", rank: "tributary", source: ["Inn"] },
  main: { name: "Main", rank: "tributary", source: ["Main"] },
  meuse: { name: "Meuse", rank: "tributary", source: ["Maas"] },
  moselle: { name: "Moselle", rank: "tributary", source: ["Mosel"] },
  weser: { name: "Weser", rank: "tributary", source: ["Weser"] },
  saone: { name: "Sa\u00f4ne", rank: "tributary", source: ["Sane"] },
  tisza: { name: "Tisza", rank: "tributary", source: ["Tisa"] },
  sava: { name: "Sava", rank: "tributary", source: ["Sava"] },
  drava: { name: "Drava", rank: "tributary", source: ["Drau"] },
  prut: { name: "Prut", rank: "tributary", source: ["Prut"] },
  bug: { name: "Bug", rank: "tributary", source: ["Bug"] },
  pripet: { name: "Pripet", rank: "tributary", source: ["Pripyat"] },
  oka: { name: "Oka", rank: "tributary", source: ["Oka"] },
  thames: { name: "Thames", rank: "tributary", source: ["Thames"] },
  tiber: { name: "Tiber", rank: "tributary", source: ["Tevere"] }
};

/** Blue and gold: a navy-to-steel sea, parchment-and-gold land, and a navy edge. */
export const art = {
  land: [
    [0, [222, 207, 160]],
    [150, [219, 200, 148]],
    [400, [211, 186, 128]],
    [800, [198, 167, 106]],
    [1300, [181, 147, 90]],
    [2000, [168, 138, 96]],
    [2700, [202, 186, 158]],
    [3500, [236, 230, 216]]
  ] satisfies (readonly [number, Rgb])[],
  relief: { ambient: 0.1, broadExaggeration: 22, broadRadius: 9, broadWeight: 0.55, brightest: 1.3, darkest: 0.42, exaggeration: 11, ridge: 0.14 },
  /** Land outside the game: cooler and greyer, so the playable board reads as gold. */
  neutral: { lift: 10, saturation: 0.22, tint: [0.86, 0.93, 1.04] satisfies Rgb, tone: 0.82 },
  lake: [86, 124, 172] satisfies Rgb,
  sea: [
    [0, [88, 128, 178]],
    [-100, [70, 110, 162]],
    [-500, [54, 92, 146]],
    [-2000, [40, 74, 126]],
    [-4500, [28, 56, 104]]
  ] satisfies (readonly [number, Rgb])[],
  seaRelief: 0.14,
  shoreGlow: { color: [140, 174, 212] satisfies Rgb, strength: 0.42, width: 30 },
  background: [27, 48, 90] satisfies Rgb,
  webpQuality: 84
} as const;

export const attribution: readonly { readonly text: string; readonly url?: string }[] = [
  {
    text: "Boundaries adapted from modern provinces, with coastlines, rivers and lakes, from Natural Earth (public domain). Made with Natural Earth.",
    url: "https://www.naturalearthdata.com/"
  },
  {
    text: "Relief computed from AWS Terrain Tiles (Mapzen terrarium). Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.",
    url: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md"
  }
];
