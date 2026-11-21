// Sub-territories of the `iberia-1936` map package (W2, D8): the 1936 provinces, Baleares by
// island, Asturias in two and Madrid in three. `scripts/build-map.ts` cuts each territory's region
// rings (the same rings as `iberia-regions.svg`) into these parts, so their outer edges are the
// region borders; only the lines inside a territory come from the data below.

import type { GeoPoint } from "./iberia-1936.ts";
import type { EntryOverride, SeaLink } from "./topology.ts";

/** A longitude/latitude pair, WGS 84 decimal degrees. */
export type LonLat = readonly [number, number];

export interface SubTerritorySource {
  readonly territoryId: string;
  /** Suggested display name, Castilian as on the 1936 map, for the scenario package. */
  readonly name: string;
  /** geoBoundaries gbOpen ESP ADM2 `shapeName`, for territories split along province borders. */
  readonly province?: string;
  /**
   * The sub-territory's chief town (its capital point, and the seed of a hand-drawn split).
   * Provincial capitals already in `cities` use the same coordinates; the rest are the coordinates
   * of each town's English Wikipedia article (MediaWiki API `prop=coordinates`), retrieved
   * 19 November 2026 and rounded to 0.001 degree. Soria's article has no primary coordinate, so
   * its second one (the city) is used.
   */
  readonly capital: GeoPoint & { readonly town: string };
}

const at = (town: string, latitude: number, longitude: number): SubTerritorySource["capital"] => ({ latitude, longitude, town });

/** Every sub-territory, grouped by territory in scenario order. The ids are the agreed ones (declog D8). */
export const subTerritories: Readonly<Record<string, SubTerritorySource>> = {
  "a-coruna": { territoryId: "galicia", name: "La Coru\u00f1a", province: "Coruna", capital: at("La Coru\u00f1a", 43.371, -8.396) },
  lugo: { territoryId: "galicia", name: "Lugo", province: "Lugo", capital: at("Lugo", 43.017, -7.55) },
  ourense: { territoryId: "galicia", name: "Orense", province: "Ourense", capital: at("Orense", 42.336, -7.863) },
  pontevedra: { territoryId: "galicia", name: "Pontevedra", province: "Pontevedra", capital: at("Pontevedra", 42.433, -8.633) },
  oviedo: { territoryId: "asturias", name: "Oviedo", capital: at("Oviedo", 43.36, -5.845) },
  asturias: { territoryId: "asturias", name: "Asturias", capital: at("Gij\u00f3n", 43.533, -5.7) },
  cantabria: { territoryId: "cantabria", name: "Cantabria", capital: at("Santander", 43.463, -3.805) },
  bizkaia: { territoryId: "pais-vasco", name: "Vizcaya", province: "Bizkaia", capital: at("Bilbao", 43.257, -2.924) },
  gipuzkoa: { territoryId: "pais-vasco", name: "Guip\u00fazcoa", province: "Gipuzkoa", capital: at("San Sebasti\u00e1n", 43.321, -1.986) },
  alava: { territoryId: "pais-vasco", name: "\u00c1lava", province: "Alava", capital: at("Vitoria", 42.85, -2.683) },
  navarra: { territoryId: "navarra", name: "Navarra", capital: at("Pamplona", 42.817, -1.65) },
  "la-rioja": { territoryId: "la-rioja", name: "La Rioja", capital: at("Logro\u00f1o", 42.465, -2.446) },
  zaragoza: { territoryId: "aragon", name: "Zaragoza", province: "Zaragoza", capital: at("Zaragoza", 41.65, -0.883) },
  huesca: { territoryId: "aragon", name: "Huesca", province: "Huesca", capital: at("Huesca", 42.133, -0.417) },
  teruel: { territoryId: "aragon", name: "Teruel", province: "Teruel", capital: at("Teruel", 40.344, -1.107) },
  madrid: { territoryId: "madrid", name: "Madrid", capital: at("Madrid", 40.417, -3.703) },
  guadarrama: { territoryId: "madrid", name: "Guadarrama", capital: at("Collado Villalba", 40.633, -4.008) },
  henares: { territoryId: "madrid", name: "Henares", capital: at("Alcal\u00e1 de Henares", 40.467, -3.367) },
  burgos: { territoryId: "castilla-y-leon", name: "Burgos", province: "Burgos", capital: at("Burgos", 42.35, -3.707) },
  valladolid: { territoryId: "castilla-y-leon", name: "Valladolid", province: "Valladolid", capital: at("Valladolid", 41.653, -4.724) },
  leon: { territoryId: "castilla-y-leon", name: "Le\u00f3n", province: "Leon", capital: at("Le\u00f3n", 42.606, -5.57) },
  palencia: { territoryId: "castilla-y-leon", name: "Palencia", province: "Palencia", capital: at("Palencia", 42.017, -4.533) },
  zamora: { territoryId: "castilla-y-leon", name: "Zamora", province: "Zamora", capital: at("Zamora", 41.499, -5.756) },
  salamanca: { territoryId: "castilla-y-leon", name: "Salamanca", province: "Salamanca", capital: at("Salamanca", 40.965, -5.664) },
  avila: { territoryId: "castilla-y-leon", name: "\u00c1vila", province: "Avila", capital: at("\u00c1vila", 40.65, -4.683) },
  segovia: { territoryId: "castilla-y-leon", name: "Segovia", province: "Segovia", capital: at("Segovia", 40.948, -4.118) },
  soria: { territoryId: "castilla-y-leon", name: "Soria", province: "Soria", capital: at("Soria", 41.767, -2.467) },
  toledo: { territoryId: "castilla-la-mancha", name: "Toledo", province: "Toledo", capital: at("Toledo", 39.857, -4.024) },
  "ciudad-real": { territoryId: "castilla-la-mancha", name: "Ciudad Real", province: "Ciudad Real", capital: at("Ciudad Real", 38.983, -3.917) },
  cuenca: { territoryId: "castilla-la-mancha", name: "Cuenca", province: "Cuenca", capital: at("Cuenca", 40.072, -2.134) },
  guadalajara: { territoryId: "castilla-la-mancha", name: "Guadalajara", province: "Guadalajara", capital: at("Guadalajara", 40.634, -3.167) },
  albacete: { territoryId: "castilla-la-mancha", name: "Albacete", province: "Albacete", capital: at("Albacete", 38.996, -1.856) },
  badajoz: { territoryId: "extremadura", name: "Badajoz", province: "Badajoz", capital: at("Badajoz", 38.88, -6.975) },
  caceres: { territoryId: "extremadura", name: "C\u00e1ceres", province: "Caceres", capital: at("C\u00e1ceres", 39.483, -6.367) },
  barcelona: { territoryId: "catalunya", name: "Barcelona", province: "Barcelona", capital: at("Barcelona", 41.383, 2.177) },
  girona: { territoryId: "catalunya", name: "Gerona", province: "Girona", capital: at("Gerona", 41.984, 2.821) },
  lleida: { territoryId: "catalunya", name: "L\u00e9rida", province: "Lleida", capital: at("L\u00e9rida", 41.617, 0.633) },
  tarragona: { territoryId: "catalunya", name: "Tarragona", province: "Tarragona", capital: at("Tarragona", 41.117, 1.253) },
  valencia: { territoryId: "valencia", name: "Valencia", province: "Valencia", capital: at("Valencia", 39.47, -0.376) },
  castellon: { territoryId: "valencia", name: "Castell\u00f3n", province: "Castellon", capital: at("Castell\u00f3n de la Plana", 39.983, -0.033) },
  alicante: { territoryId: "valencia", name: "Alicante", province: "Alicante", capital: at("Alicante", 38.345, -0.483) },
  mallorca: { territoryId: "islas-baleares", name: "Mallorca", capital: at("Palma", 39.567, 2.65) },
  menorca: { territoryId: "islas-baleares", name: "Menorca", capital: at("Mah\u00f3n", 39.888, 4.261) },
  ibiza: { territoryId: "islas-baleares", name: "Ibiza", capital: at("Ibiza", 38.909, 1.433) },
  sevilla: { territoryId: "andalucia", name: "Sevilla", province: "Sevilla", capital: at("Sevilla", 37.389, -5.995) },
  cadiz: { territoryId: "andalucia", name: "C\u00e1diz", province: "Cadiz", capital: at("C\u00e1diz", 36.535, -6.298) },
  huelva: { territoryId: "andalucia", name: "Huelva", province: "Huelva", capital: at("Huelva", 37.25, -6.95) },
  cordoba: { territoryId: "andalucia", name: "C\u00f3rdoba", province: "Cordoba", capital: at("C\u00f3rdoba", 37.89, -4.78) },
  granada: { territoryId: "andalucia", name: "Granada", province: "Granada", capital: at("Granada", 37.175, -3.6) },
  malaga: { territoryId: "andalucia", name: "M\u00e1laga", province: "Malaga", capital: at("M\u00e1laga", 36.719, -4.42) },
  jaen: { territoryId: "andalucia", name: "Ja\u00e9n", province: "Jaen", capital: at("Ja\u00e9n", 37.767, -3.771) },
  almeria: { territoryId: "andalucia", name: "Almer\u00eda", province: "Almeria", capital: at("Almer\u00eda", 36.842, -2.464) },
  murcia: { territoryId: "murcia", name: "Murcia", capital: at("Murcia", 37.983, -1.13) },
  ceuta: { territoryId: "ceuta", name: "Ceuta", capital: at("Ceuta", 35.888, -5.316) },
  melilla: { territoryId: "melilla", name: "Melilla", capital: at("Melilla", 35.292, -2.941) }
};

/**
 * Hand-drawn splits: lines that cut a territory, and each part's seed is its capital point. A part
 * is whatever its seed reaches inside the region without crossing a line; islands and other cells
 * no seed reaches join the nearest part. Each line runs a few kilometres past the region's edge.
 *
 * The lines follow municipal boundaries traced from geoBoundaries gbOpen ESP ADM3 (municipalities,
 * Instituto Geografico Nacional, CC BY 4.0, revision 9469f09), simplified (Douglas-Peucker, 0.3 km)
 * and rounded to 0.001 degree. The municipalities on each side are listed in
 * `assets/maps/ATTRIBUTION.md`.
 */
export const handSplits: Readonly<Record<string, { readonly lines: readonly (readonly LonLat[])[] }>> = {
  // Asturias: the concejo of Oviedo, the Nationalist pocket Aranda held from 19 July 1936 and the
  // Republican miners besieged until October, closed inside the rest of the province.
  asturias: {
    lines: [[
      [-5.861, 43.42], [-5.881, 43.427], [-5.876, 43.42], [-5.884, 43.409], [-5.887, 43.419], [-5.909, 43.416], [-5.922, 43.424], [-5.931, 43.397],
      [-5.944, 43.397], [-5.936, 43.393], [-5.938, 43.388], [-5.929, 43.387], [-5.935, 43.378], [-5.927, 43.38], [-5.929, 43.373], [-5.938, 43.368],
      [-5.953, 43.373], [-5.962, 43.369], [-5.961, 43.381], [-5.969, 43.379], [-5.968, 43.384], [-5.971, 43.381], [-5.978, 43.383], [-5.98, 43.377],
      [-5.972, 43.374], [-5.976, 43.366], [-5.97, 43.361], [-6.016, 43.334], [-6.001, 43.302], [-5.977, 43.309], [-5.965, 43.32], [-5.951, 43.299],
      [-5.924, 43.312], [-5.92, 43.319], [-5.884, 43.322], [-5.879, 43.327], [-5.869, 43.322], [-5.868, 43.308], [-5.861, 43.308], [-5.841, 43.316],
      [-5.841, 43.326], [-5.832, 43.318], [-5.845, 43.301], [-5.829, 43.292], [-5.838, 43.285], [-5.812, 43.289], [-5.793, 43.279], [-5.782, 43.279],
      [-5.772, 43.288], [-5.774, 43.302], [-5.76, 43.309], [-5.756, 43.317], [-5.757, 43.332], [-5.751, 43.339], [-5.743, 43.334], [-5.743, 43.343],
      [-5.777, 43.346], [-5.776, 43.354], [-5.782, 43.356], [-5.793, 43.379], [-5.805, 43.381], [-5.809, 43.388], [-5.818, 43.39], [-5.83, 43.412],
      [-5.824, 43.416], [-5.831, 43.416], [-5.837, 43.41], [-5.847, 43.413], [-5.848, 43.408], [-5.868, 43.414], [-5.861, 43.42]
    ]]
  },
  // Madrid: three lines from one point near Talamanca de Jarama (40.735 N, 3.542 W).
  // - Guadarrama | Henares: north-east to the Guadalajara border along the Jarama.
  // - Guadarrama | Madrid: west along the foot of the Sierra to the Avila border; the Sierra side
  //   holds the Guadarrama passes and Somosierra.
  // - Henares | Madrid: south down the Jarama to San Fernando de Henares, then east along the
  //   watershed between the Henares and the Tajuna to the Guadalajara border.
  madrid: {
    lines: [
      [
        [-3.472, 40.791], [-3.508, 40.789], [-3.508, 40.781], [-3.525, 40.761], [-3.534, 40.762], [-3.542, 40.754], [-3.533, 40.751], [-3.542, 40.735]
      ],
      [
        [-3.542, 40.735], [-3.579, 40.751], [-3.594, 40.75], [-3.608, 40.78], [-3.627, 40.773], [-3.637, 40.757], [-3.676, 40.729], [-3.695, 40.73],
        [-3.707, 40.725], [-3.711, 40.73], [-3.734, 40.732], [-3.757, 40.72], [-3.771, 40.704], [-3.806, 40.711], [-3.84, 40.667], [-3.856, 40.663],
        [-3.865, 40.646], [-3.878, 40.652], [-3.892, 40.652], [-3.923, 40.638], [-3.94, 40.622], [-3.953, 40.598], [-3.959, 40.602], [-3.958, 40.632],
        [-3.974, 40.627], [-3.98, 40.62], [-4.004, 40.616], [-4.02, 40.619], [-4.028, 40.63], [-4.034, 40.63], [-4.035, 40.62], [-4.042, 40.613],
        [-4.035, 40.609], [-4.035, 40.597], [-4.044, 40.59], [-4.048, 40.571], [-4.061, 40.573], [-4.079, 40.568], [-4.088, 40.559], [-4.098, 40.557],
        [-4.107, 40.543], [-4.115, 40.544], [-4.124, 40.539], [-4.133, 40.519], [-4.151, 40.522], [-4.152, 40.531], [-4.177, 40.53], [-4.198, 40.523],
        [-4.202, 40.512], [-4.21, 40.512], [-4.213, 40.525], [-4.197, 40.559], [-4.215, 40.554], [-4.219, 40.542], [-4.231, 40.532], [-4.262, 40.531],
        [-4.271, 40.542], [-4.259, 40.543], [-4.258, 40.547], [-4.267, 40.548], [-4.27, 40.562], [-4.289, 40.564], [-4.321, 40.552]
      ],
      [
        [-3.542, 40.735], [-3.526, 40.732], [-3.529, 40.712], [-3.545, 40.698], [-3.545, 40.691], [-3.554, 40.689], [-3.553, 40.652], [-3.567, 40.65],
        [-3.57, 40.644], [-3.585, 40.646], [-3.585, 40.654], [-3.593, 40.655], [-3.584, 40.627], [-3.574, 40.619], [-3.574, 40.599], [-3.565, 40.599],
        [-3.56, 40.586], [-3.548, 40.587], [-3.54, 40.583], [-3.539, 40.572], [-3.553, 40.575], [-3.563, 40.573], [-3.559, 40.565], [-3.566, 40.554],
        [-3.548, 40.539], [-3.557, 40.528], [-3.551, 40.524], [-3.555, 40.503], [-3.542, 40.494], [-3.534, 40.472], [-3.525, 40.467], [-3.53, 40.461],
        [-3.527, 40.455], [-3.534, 40.454], [-3.526, 40.433], [-3.538, 40.43], [-3.537, 40.423], [-3.52, 40.41], [-3.503, 40.408], [-3.454, 40.421],
        [-3.442, 40.419], [-3.441, 40.412], [-3.432, 40.415], [-3.438, 40.431], [-3.427, 40.425], [-3.411, 40.426], [-3.374, 40.377], [-3.353, 40.366],
        [-3.319, 40.383], [-3.324, 40.395], [-3.312, 40.4], [-3.306, 40.386], [-3.275, 40.381], [-3.278, 40.395], [-3.269, 40.398], [-3.253, 40.394],
        [-3.222, 40.402], [-3.229, 40.393], [-3.228, 40.386], [-3.201, 40.392], [-3.183, 40.375], [-3.168, 40.378], [-3.152, 40.377], [-3.15, 40.373],
        [-3.115, 40.373]
      ]
    ]
  },
  // Baleares: one province in the sources; each island group is the part its capital's island
  // belongs to, and the islets join the nearest island (Formentera Ibiza, Cabrera and Dragonera
  // Mallorca).
  "islas-baleares": { lines: [] }
};

/** Grid cell and line simplification for the internal lines, in km. */
export const partition = { cellSize: 0.125, tolerance: 0.25 } as const;

/** Largest allowed difference between a province's built area and its projected ADM2 area. */
export const provinceAreaTolerance = 0.03;

/**
 * Topology measures, in km: boundary points within `contact` of another sub-territory's boundary
 * are shared border (region borders are simplified separately, so neighbours across a territory
 * border sit up to about half a kilometre apart). A boundary point is coast when every probe at
 * the `seaProbes` distances straight out from it is in the sea; Natural Earth's neighbouring
 * countries and geoBoundaries leave gaps up to several km wide between them (along the
 * Portuguese border rivers, for example), which the longer probes cross. Neighbours share at least `minimumBorder`, which leaves out corner touches; a
 * port needs at least `minimumCoast` of coast.
 */
export const topology = { contact: 0.75, minimumBorder: 2, minimumCoast: 5, seaProbes: [0.5, 1, 2, 3, 4, 6, 8], step: 0.25 } as const;

/**
 * Connection entries chosen by hand, by territory id, where the geometric rule (longest shared
 * border, or closest coasts) would miss the road, railway, or ferry line armies used in 1936-39.
 * Every other connection keeps the derived entry; the build checks each override (known ids, on
 * the right side, bordering for land, coastal for sea).
 */
export const entryOverrides: readonly EntryOverride[] = [
  // Sea: the regular steamer lines of the 1930s, from ports of level 2 where there is a choice.
  { entry: { andalucia: "cadiz", ceuta: "ceuta" }, reason: "Algeciras-Ceuta, the Strait crossing of the July 1936 airlift and convoy." },
  { entry: { andalucia: "malaga", melilla: "melilla" }, reason: "The Malaga-Melilla ferry line (the closest coasts would give Almeria)." },
  { entry: { catalunya: "barcelona", "islas-baleares": "mallorca" }, reason: "The Barcelona-Palma line." },
  { entry: { valencia: "valencia", "islas-baleares": "mallorca" }, reason: "The Valencia-Palma line (the closest coasts would give Alicante-Ibiza)." },
  { kind: "sea", entry: { andalucia: "malaga", murcia: "murcia" }, reason: "R3: Malaga's sea lane to Cartagena, the Republican fleet's other base, once the coast road is cut." },
  // Land: the main roads and railways where the longest shared border misleads.
  { entry: { "castilla-la-mancha": "toledo", extremadura: "caceres" }, reason: "The Tajo valley road from Navalmoral to Talavera, the Army of Africa's march on Madrid." },
  { entry: { andalucia: "sevilla", extremadura: "badajoz" }, reason: "The Sevilla-Merida road and railway (the Via de la Plata), the column route of August 1936." },
  { entry: { "la-rioja": "la-rioja", "castilla-y-leon": "burgos" }, reason: "The Ebro valley road and railway from Logrono to Haro and Miranda de Ebro, not the Cameros passes into Soria." },
  { entry: { "castilla-la-mancha": "cuenca", valencia: "valencia" }, reason: "The Madrid-Valencia road through Motilla to Requena, the Republic's lifeline." }
];

/**
 * Sea links inside a territory, written into `subTerritoryBorders` like land borders, so that the
 * islands form one connected graph for the partition and path rules (P3, P6).
 */
export const seaLinks: readonly SeaLink[] = [
  { between: ["mallorca", "menorca"], reason: "The Palma-Mahon line; Menorca has no other link." },
  { between: ["mallorca", "ibiza"], reason: "The Palma-Ibiza line." }
];
