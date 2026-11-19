// Water for the `iberia-1936` map package: which Natural Earth rivers are drawn and how, and where
// the sea names sit. Names are Castilian Spanish, written with \u escapes so the source stays ASCII
// (decision W4); the pipeline writes them to map.json the same way.
import type { GeoPoint } from "./iberia-1936.ts";
import type { ClipOptions } from "./rivers.ts";

export type RiverRank = "main" | "tributary";

export interface RiverEntry {
  readonly name: string;
  readonly rank: RiverRank;
  /** Natural Earth `rivernum` values joined into this river (a river can span features and layers). */
  readonly rivernums: readonly number[];
}

/**
 * The eight main rivers (drawn at every zoom and labelled) and the major tributaries (drawn from
 * the operational zoom), keyed by map river id. Identified by `rivernum` and checked against each
 * feature's projected course, because Natural Earth's own names are unreliable here: "Mio" for the
 * Mino, "Zncara" for the Zancara, and the Aragon recorded as a second "Alagon".
 */
export const rivers: Readonly<Record<string, RiverEntry>> = {
  ebro: { name: "R\u00edo Ebro", rank: "main", rivernums: [155] },
  tajo: { name: "R\u00edo Tajo", rank: "main", rivernums: [165, 198] },
  duero: { name: "R\u00edo Duero", rank: "main", rivernums: [304] },
  guadiana: { name: "R\u00edo Guadiana", rank: "main", rivernums: [395] },
  guadalquivir: { name: "R\u00edo Guadalquivir", rank: "main", rivernums: [723] },
  jucar: { name: "R\u00edo J\u00facar", rank: "main", rivernums: [404353] },
  segura: { name: "R\u00edo Segura", rank: "main", rivernums: [409073] },
  mino: { name: "R\u00edo Mi\u00f1o", rank: "main", rivernums: [1061, 1134] },
  sil: { name: "R\u00edo Sil", rank: "tributary", rivernums: [403655] },
  narcea: { name: "R\u00edo Narcea", rank: "tributary", rivernums: [401402] },
  esla: { name: "R\u00edo Esla", rank: "tributary", rivernums: [401685, 892] },
  // The second Pisuerga feature is the Arlanza and the lower Pisuerga down to the Duero.
  pisuerga: { name: "R\u00edo Pisuerga", rank: "tributary", rivernums: [407273, 407282] },
  adaja: { name: "R\u00edo Adaja", rank: "tributary", rivernums: [404378] },
  tormes: { name: "R\u00edo Tormes", rank: "tributary", rivernums: [406395] },
  alagon: { name: "R\u00edo Alag\u00f3n", rank: "tributary", rivernums: [405563] },
  tietar: { name: "R\u00edo Ti\u00e9tar", rank: "tributary", rivernums: [405916] },
  alberche: { name: "R\u00edo Alberche", rank: "tributary", rivernums: [404340] },
  // Natural Earth's Henares runs on down the lower Jarama to the Tajo at Aranjuez.
  henares: { name: "R\u00edo Henares", rank: "tributary", rivernums: [408413] },
  zancara: { name: "R\u00edo Z\u00e1ncara", rank: "tributary", rivernums: [562] },
  zujar: { name: "R\u00edo Z\u00fajar", rank: "tributary", rivernums: [406308] },
  guadalimar: { name: "R\u00edo Guadalimar", rank: "tributary", rivernums: [408468] },
  "guadiana-menor": { name: "R\u00edo Guadiana Menor", rank: "tributary", rivernums: [407783] },
  genil: { name: "R\u00edo Genil", rank: "tributary", rivernums: [404728] },
  segre: { name: "R\u00edo Segre", rank: "tributary", rivernums: [1120] },
  cinca: { name: "R\u00edo Cinca", rank: "tributary", rivernums: [403637] },
  aragon: { name: "R\u00edo Arag\u00f3n", rank: "tributary", rivernums: [405625] },
  jalon: { name: "R\u00edo Jal\u00f3n", rank: "tributary", rivernums: [408432] },
  // Natural Earth's Jiloca runs on down the lower Jalon to the Ebro.
  jiloca: { name: "R\u00edo Jiloca", rank: "tributary", rivernums: [407164] },
  cabriel: { name: "R\u00edo Cabriel", rank: "tributary", rivernums: [403615] },
  turia: { name: "R\u00edo Turia", rank: "tributary", rivernums: [406622] }
};

/**
 * Features in the vendored extent that are deliberately not drawn: rivers of France and Portugal,
 * and Spanish rivers whose parent river is missing from the source (Luna without the Orbigo,
 * Cardener without the Llobregat), minor coastal rivers, and one unnamed line.
 */
export const excludedRivernums: readonly number[] = [
  1064, 255, 79000, 303, 401729, 402150, 403044, 403638, 404643, 406527, 407571, 408263,
  404889, 406346, 402046, 406010
];

export interface RiverStyle {
  readonly clip: ClipOptions;
  readonly simplify: Readonly<Record<RiverRank, number>>;
  readonly mouthReach: number;
  readonly mouthLength: number;
  readonly confluenceReach: number;
  readonly label: { readonly clearance: number; readonly generalize: number; readonly length: number; readonly margin: number };
}

/** How rivers are clipped, simplified, tapered, and labelled; distances in km. */
export const riverStyle: RiverStyle = {
  clip: { bridge: 2, inset: 0.25, shortest: 6, snap: 2.5, step: 0.5 },
  /** Douglas-Peucker tolerance per rank: about one screen pixel at the zoom each rank first shows. */
  simplify: { main: 0.3, tributary: 0.45 },
  /** A downstream end this close to the sea, and not cut at a border, tapers over `mouthLength`. */
  mouthReach: 25,
  mouthLength: 14,
  /** A tributary's downstream end must meet another river, the sea, or the border within this. */
  confluenceReach: 3,
  label: { clearance: 22, generalize: 4, length: 230, margin: 40 }
};

export type WaterTier = "overview" | "operational" | "detail";

/**
 * A water name: straight at a point (gulfs, bays), or along a curve of control points (open seas,
 * W5). A curved name lists curves in order of preference; the renderer uses the first that fits,
 * so a narrow phone screen can show the name further out to sea.
 */
export type WaterLabelSource =
  | { readonly text: string; readonly tier: WaterTier; readonly at: GeoPoint }
  | { readonly text: string; readonly tier: WaterTier; readonly along: readonly (readonly GeoPoint[])[] };

const at = (latitude: number, longitude: number): GeoPoint => ({ latitude, longitude });

/** The 25 water names (decision W1), placed in open water beside the feature they name. */
export const waterLabels: readonly WaterLabelSource[] = [
  { text: "Oc\u00e9ano Atl\u00e1ntico", tier: "overview", along: [[at(37.3, -9.35), at(38.6, -9.8), at(39.7, -9.8), at(40.8, -9.3), at(42.0, -9.35)]] },
  { text: "Mar Mediterr\u00e1neo", tier: "overview", along: [
    [at(37.0, -1.2), at(37.55, 1.2), at(38.1, 3.4), at(38.4, 5.0)],
    [at(35.85, -2.1), at(36.5, 0.5), at(37.2, 2.6), at(37.8, 4.5)]
  ] },
  { text: "Mar Cant\u00e1brico", tier: "overview", along: [
    [at(43.88, -7.6), at(43.8, -5.6), at(43.64, -3.6), at(43.52, -2.0)],
    [at(44.0, -9.1), at(44.15, -5.5), at(44.05, -1.9)],
    [at(44.2, -7.4), at(44.3, -4.4), at(44.2, -1.3)]
  ] },
  { text: "Golfo de Vizcaya", tier: "operational", at: at(44.75, -2.9) },
  { text: "Mar de Albor\u00e1n", tier: "operational", at: at(35.95, -3.4) },
  { text: "Estrecho de Gibraltar", tier: "operational", at: at(35.93, -5.75) },
  { text: "Golfo de C\u00e1diz", tier: "operational", at: at(36.62, -7.15) },
  { text: "Mar Balear", tier: "operational", at: at(40.3, 2.2) },
  { text: "Golfo de Le\u00f3n", tier: "operational", at: at(42.75, 4.0) },
  { text: "Golfo de Valencia", tier: "operational", at: at(39.0, 0.62) },
  { text: "Golfo \u00c1rtabro", tier: "detail", at: at(43.53, -8.25) },
  { text: "R\u00eda de Ferrol", tier: "detail", at: at(43.6, -8.55) },
  { text: "R\u00eda de Arousa", tier: "detail", at: at(42.5, -9.25) },
  { text: "R\u00eda de Vigo", tier: "detail", at: at(42.2, -9.2) },
  { text: "Bah\u00eda de Santander", tier: "detail", at: at(43.58, -3.6) },
  { text: "Abra de Bilbao", tier: "detail", at: at(43.47, -3.05) },
  { text: "Golfo de Rosas", tier: "detail", at: at(42.18, 3.4) },
  { text: "Albufera de Valencia", tier: "detail", at: at(39.3, 0.18) },
  { text: "Mar Menor", tier: "detail", at: at(37.74, -0.72) },
  { text: "Golfo de Mazarr\u00f3n", tier: "detail", at: at(37.36, -1.45) },
  { text: "Golfo de Almer\u00eda", tier: "detail", at: at(36.7, -2.4) },
  { text: "Bah\u00eda de Algeciras", tier: "detail", at: at(36.08, -5.2) },
  { text: "Bah\u00eda de C\u00e1diz", tier: "detail", at: at(36.6, -6.62) },
  { text: "Bah\u00eda de Palma", tier: "detail", at: at(39.45, 2.68) },
  { text: "Bah\u00eda de Alcudia", tier: "detail", at: at(39.82, 3.3) }
];
