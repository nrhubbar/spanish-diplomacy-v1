// Source data for the `iberia-1936` map package: projection, extents, source names, and the
// real-world positions that `scripts/build-map.ts` projects into `map.json`. Everything here is
// geography or art direction; the pipeline modules beside it are package-agnostic.

import type { LambertConformalConic } from "./projection.ts";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * Lambert conformal conic on a sphere, standard parallels 37N and 43N (one sixth in from each
 * end of the 35N-45N band the map covers), centred on 40N 3W. Conformal keeps coastlines and
 * borders true to shape; scale error stays within 0.35 percent between 34.5N and 44.5N.
 */
export const projection: LambertConformalConic = {
  centralMeridian: -3,
  originLatitude: 40,
  radius: 6371.0088,
  standardParallels: [37, 43]
};

/** Map space in projected kilometres. The camera never pans its centre outside it. */
export const viewBox: Rect = { x: -680, y: -540, width: 1440, height: 1200 };

/** Framed when a game starts: the Peninsula, the Balearics, Ceuta, Melilla, and the Rif coast. */
export const focus: Rect = { x: -538, y: -455, width: 1166, height: 1075 };

export const terrain = {
  /**
   * Working relief, baked once at 4 texels per km from the zoom-8 elevation (about 470 m cells).
   * It covers the view box plus the half-viewport a fully zoomed camera can show beyond it.
   */
  master: { bounds: { x: -940, y: -800, width: 1960, height: 1720 } satisfies Rect, demZoom: 8, texelsPerUnit: 4 },
  /**
   * Shipped detail layer: the master resampled over the view box (4032 x 3360 texels). Its edges
   * fade out over `feather` km into the margin layer, so the change in sharpness has no seam.
   */
  detail: { bounds: viewBox, texelsPerUnit: 2.8, feather: 30 },
  /** Shipped margin layer: the whole master at 1.2 texels per km, for a zoomed camera at the view box edge. */
  margin: { bounds: { x: -940, y: -800, width: 1960, height: 1720 } satisfies Rect, texelsPerUnit: 1.2, feather: 60 },
  /**
   * Shipped overview layer under everything, for wide and tall viewports: the zoom-5 elevation
   * outside the master, the downsampled master inside it, and a fade into the background.
   */
  overview: { bounds: { x: -1700, y: -1450, width: 3500, height: 3000 } satisfies Rect, demZoom: 5, texelsPerUnit: 0.6, fade: 220 }
} as const;

/** geoBoundaries gbOpen ESP ADM1 `shapeName` for every map region id. */
export const regionSources: Readonly<Record<string, string>> = {
  ES11: "Galicia",
  ES12: "Principado de Asturias",
  ES13: "Cantabria",
  ES21: "Pa\u00eds Vasco/Euskadi",
  ES22: "Comunidad Foral de Navarra",
  ES23: "La Rioja",
  ES24: "Arag\u00f3n",
  ES30: "Comunidad de Madrid",
  ES41: "Castilla y Le\u00f3n",
  ES42: "Castilla-La Mancha",
  ES43: "Extremadura",
  ES51: "Catalu\u00f1a/Catalunya",
  ES52: "Comunitat Valenciana",
  ES53: "Illes Balears",
  ES61: "Andaluc\u00eda",
  ES62: "Regi\u00f3n de Murcia"
};

/**
 * Playable land that is not a bound region, by territory id and geoBoundaries ADM1 `shapeName`:
 * drawn in the relief like the regions, so the enclaves read as Spanish territory under their
 * circle shapes, and the land of their sub-territories.
 */
export const playableExtras: Readonly<Record<string, string>> = {
  ceuta: "Ciudad Aut\u00f3noma de Ceuta",
  melilla: "Ciudad Aut\u00f3noma de Melilla"
};

/** Rivers are vendored for this longitude/latitude extent: the Peninsula and the Balearics. */
export const riverExtent = { east: 4.6, north: 44, south: 35.8, west: -9.8 } as const;

/** Natural Earth ADM0_A3 codes left out of the neutral land (the playable country). */
export const excludedCountries: readonly string[] = ["ESP"];

/**
 * City centres, WGS 84 decimal degrees rounded to 0.001 degree (about 100 m): the coordinates of
 * each city's English Wikipedia article (MediaWiki API `prop=coordinates`), retrieved
 * 18 November 2026. Facts, not creative content; recorded here so the build stays offline.
 */
export const cities: Readonly<Record<string, GeoPoint & { readonly tier: "overview" | "detail" }>> = {
  "a-coruna": { latitude: 43.371, longitude: -8.396, tier: "detail" },
  oviedo: { latitude: 43.360, longitude: -5.845, tier: "detail" },
  gijon: { latitude: 43.533, longitude: -5.700, tier: "detail" },
  santander: { latitude: 43.463, longitude: -3.805, tier: "detail" },
  bilbao: { latitude: 43.257, longitude: -2.924, tier: "overview" },
  "san-sebastian": { latitude: 43.321, longitude: -1.986, tier: "detail" },
  pamplona: { latitude: 42.817, longitude: -1.650, tier: "detail" },
  burgos: { latitude: 42.350, longitude: -3.707, tier: "detail" },
  valladolid: { latitude: 41.653, longitude: -4.724, tier: "detail" },
  salamanca: { latitude: 40.965, longitude: -5.664, tier: "detail" },
  zaragoza: { latitude: 41.650, longitude: -0.883, tier: "overview" },
  teruel: { latitude: 40.344, longitude: -1.107, tier: "detail" },
  barcelona: { latitude: 41.383, longitude: 2.177, tier: "overview" },
  madrid: { latitude: 40.417, longitude: -3.703, tier: "overview" },
  toledo: { latitude: 39.857, longitude: -4.024, tier: "detail" },
  badajoz: { latitude: 38.880, longitude: -6.975, tier: "detail" },
  valencia: { latitude: 39.470, longitude: -0.376, tier: "overview" },
  albacete: { latitude: 38.996, longitude: -1.856, tier: "detail" },
  alicante: { latitude: 38.345, longitude: -0.483, tier: "detail" },
  cartagena: { latitude: 37.602, longitude: -0.984, tier: "detail" },
  seville: { latitude: 37.389, longitude: -5.995, tier: "overview" },
  cordoba: { latitude: 37.890, longitude: -4.780, tier: "detail" },
  granada: { latitude: 37.175, longitude: -3.600, tier: "detail" },
  malaga: { latitude: 36.719, longitude: -4.420, tier: "detail" },
  cadiz: { latitude: 36.535, longitude: -6.298, tier: "detail" }
};

/** Territories drawn as circles (no SVG region): centre (same sources as cities) and radius in km. */
export const enclaves: Readonly<Record<string, GeoPoint & { readonly radius: number; readonly labelOffset: { readonly x: number; readonly y: number } }>> = {
  ceuta: { latitude: 35.888, longitude: -5.316, radius: 12, labelOffset: { x: 46, y: -14 } },
  melilla: { latitude: 35.292, longitude: -2.941, radius: 12, labelOffset: { x: 52, y: -16 } }
};

/** Territory labels sit this far above the unit anchor, in km. */
export const labelLift = 48;

/**
 * Hand placements (latitude/longitude, projected like everything else) where the automatic anchor (pole of inaccessibility of the
 * largest polygon) or the lifted label would collide with a city, a coast, or a neighbour label.
 */
export const anchorOverrides: Readonly<Record<string, { readonly anchor?: GeoPoint; readonly label?: GeoPoint; readonly lift?: number }>> = {
  // The lifted label would sit on Madrid's counters; La Mancha proper reads better.
  "castilla-la-mancha": { label: { latitude: 39.05, longitude: -2.75 } },
  // Small regions: a full lift would put the label in Alava, or beside San Sebastian's city label.
  "la-rioja": { lift: 20 },
  navarra: { lift: 30 }
};

/** Neutral geography labels, in Spanish like every map label (W2). */
export const contextLabels: readonly (GeoPoint & { readonly text: string })[] = [
  { latitude: 39.9, longitude: -8.2, text: "Portugal" },
  { latitude: 43.75, longitude: 0.9, text: "Francia" },
  { latitude: 34.6, longitude: -4.6, text: "Marruecos" }
];

type Rgb = readonly [number, number, number];

/**
 * The scenario package folder this map belongs to: the one path to change when the package moves.
 * The pipeline regenerates its `map.json`, reads its `scenario.json` connections, and writes the
 * sub-territory topology beside them.
 */
export const scenarioPackage = "src/scenarios/spanish-civil-war-1936/";

/** The package document whose coordinates the pipeline regenerates. */
export const mapDocument = `${scenarioPackage}map.json`;

/** The scenario document whose connections the sub-territory topology covers (read only). */
export const scenarioDocument = `${scenarioPackage}scenario.json`;

/** Generated sub-territory topology for the scenario package (see project/specs/map-package.md). */
export const topologyDocument = `${scenarioPackage}sub-territory-topology.json`;

/**
 * Relief art direction (Milestone 2 Revision 4): neutral sandstone, olive, muted green, and
 * warm-gray land under a quiet sea. Colors are sRGB; elevations and depths are metres.
 */
export const art = {
  /** Hypsometric tint for playable land. */
  land: [
    [0, [150, 156, 112]],
    [150, [164, 166, 120]],
    [400, [186, 180, 136]],
    [700, [204, 190, 146]],
    [1000, [206, 184, 140]],
    [1400, [190, 166, 128]],
    [1900, [170, 152, 128]],
    [2500, [186, 178, 166]],
    [3300, [226, 222, 214]]
  ] satisfies (readonly [number, Rgb])[],
  /** Light model for the land: vertical exaggeration, generalized relief, and tone limits. */
  relief: {
    ambient: 0.06,
    broadExaggeration: 11,
    broadRadius: 3,
    broadWeight: 0.5,
    brightest: 1.35,
    darkest: 0.3,
    exaggeration: 4.5,
    ridge: 0.18
  },
  /** Neighbouring countries keep the relief but lose most of the tint. */
  neutral: { lift: 0, saturation: 0.18, tone: 0.92 },
  /** Depth tint, from the shoreline down. */
  sea: [
    [0, [118, 146, 156]],
    [-120, [104, 134, 148]],
    [-600, [90, 118, 134]],
    [-2000, [78, 104, 122]],
    [-4500, [70, 94, 112]]
  ] satisfies (readonly [number, Rgb])[],
  /** Share of the sea's brightness that follows the (blurred) sea-floor relief. */
  seaRelief: 0.12,
  /** Lighter shallow water along every coast, fading out over `width` km. */
  shoreGlow: { color: [146, 168, 170] satisfies Rgb, strength: 0.32, width: 9 },
  /** Fill beyond the rasters; the overview fades into it. */
  background: [72, 96, 114] satisfies Rgb,
  webpQuality: 84
} as const;

/** Map credits shown on the Settings screen (`attribution` in map.json). */
export const attribution: readonly { readonly text: string; readonly url?: string }[] = [
  {
    text: "Administrative boundaries adapted from geoBoundaries gbOpen (CC BY 4.0); source boundary data for regions and municipalities from the Instituto Geografico Nacional, Spain. Provinces: Elaboraci\u00f3n propia con datos extra\u00eddos del sitio web del INE: www.ine.es (2018 boundaries).",
    url: "https://www.geoboundaries.org/"
  },
  {
    text: "Relief computed from AWS Terrain Tiles (Mapzen terrarium). Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration; SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey.",
    url: "https://github.com/tilezen/joerd/blob/master/docs/attribution.md"
  },
  {
    text: "Neighbouring countries and rivers from Natural Earth (public domain). Made with Natural Earth.",
    url: "https://www.naturalearthdata.com/"
  },
  {
    text: "NATO unit symbols adapted from APP-6 symbols by CdnMCG on Wikimedia Commons (CC BY-SA 4.0).",
    url: "https://commons.wikimedia.org/wiki/User:CdnMCG"
  }
];
