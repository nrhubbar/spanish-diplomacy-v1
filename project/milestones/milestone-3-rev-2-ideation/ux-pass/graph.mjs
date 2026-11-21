// ILLUSTRATIVE 1936 transport graph for the Rev 2 UI samples (notes 6, 6a). Not game data and not
// checked against a source: a plausible sketch of the 1936 network over the scenario's
// sub-territory borders, so the samples have something to draw. Every edge is a border pair from
// scenario.json `subTerritoryBorders`; render.mjs refuses an edge that is not.
//
// rail: 0 none, 1 branch, 2 main, 3 trunk (the same 1-3 weights the live rail layer draws).
// road: "main" | "minor" | null (null: no road; only infantry may cross, note 6a).
// pass: a named mountain crossing that costs extra to use.
export const edges = [
  // Madrid radials
  ["madrid", "henares", 3, "main"], ["henares", "guadalajara", 3, "main"], ["guadalajara", "zaragoza", 3, "main"],
  ["madrid", "guadarrama", 2, "main"], ["guadarrama", "avila", 2, "main", "Alto del León"], ["guadarrama", "segovia", 1, "main", "Navacerrada"],
  ["madrid", "toledo", 3, "main"], ["toledo", "ciudad-real", 3, "main"], ["ciudad-real", "jaen", 3, "main", "Despeñaperros"],
  ["jaen", "cordoba", 3, "main"], ["cordoba", "sevilla", 3, "main"], ["ciudad-real", "albacete", 3, "main"], ["albacete", "valencia", 3, "main"],
  ["madrid", "cuenca", 1, "minor"], ["cuenca", "valencia", 0, "minor"], ["madrid", "avila", 0, "main"], ["madrid", "guadalajara", 0, "minor"],
  ["toledo", "caceres", 2, "main"], ["toledo", "badajoz", 0, "minor"], ["toledo", "cuenca", 0, "minor"], ["toledo", "avila", 0, "minor"],
  // Ebro and Catalonia
  ["zaragoza", "lleida", 3, "main"], ["lleida", "barcelona", 3, "main"], ["zaragoza", "tarragona", 1, "minor"], ["tarragona", "barcelona", 3, "main"],
  ["barcelona", "girona", 2, "main"], ["zaragoza", "huesca", 2, "main"], ["huesca", "lleida", 1, "main"], ["navarra", "zaragoza", 2, "main"],
  ["la-rioja", "zaragoza", 2, "main"], ["zaragoza", "teruel", 2, "minor"], ["zaragoza", "soria", 0, "minor"], ["lleida", "tarragona", 1, "minor"],
  ["girona", "lleida", 0, "minor", "Pyrenean cols"], ["navarra", "huesca", 0, "minor", "Pyrenean cols"],
  // Levante coast
  ["teruel", "valencia", 2, "main"], ["valencia", "castellon", 3, "main"], ["castellon", "tarragona", 3, "main"], ["teruel", "castellon", 0, "minor"],
  ["albacete", "alicante", 2, "main"], ["alicante", "murcia", 2, "main"], ["albacete", "murcia", 2, "main"], ["valencia", "alicante", 0, "main"],
  ["albacete", "jaen", 0, "minor"], ["tarragona", "teruel", 0, "minor"], ["cuenca", "guadalajara", 0, "minor"], ["cuenca", "albacete", 0, "minor"], ["ciudad-real", "cuenca", 0, "minor"],
  // Andalucía
  ["sevilla", "cadiz", 2, "main"], ["sevilla", "huelva", 2, "main"], ["cordoba", "malaga", 2, "main"], ["granada", "malaga", 1, "main"],
  ["jaen", "granada", 1, "main"], ["granada", "almeria", 1, "main"], ["granada", "murcia", 1, "minor"], ["sevilla", "malaga", 0, "minor"],
  ["cordoba", "granada", 0, "main"], ["cadiz", "malaga", 0, "minor", "Serranía de Ronda"], ["cadiz", "huelva", 0, "minor"],
  ["almeria", "murcia", 0, "minor"], ["ciudad-real", "cordoba", 0, "minor", "Sierra Morena"],
  // Extremadura
  ["badajoz", "sevilla", 2, "main"], ["badajoz", "huelva", 1, "minor"], ["badajoz", "caceres", 1, "main"], ["badajoz", "cordoba", 1, "minor"],
  ["ciudad-real", "badajoz", 1, "minor"], ["salamanca", "caceres", 1, "main", "Béjar"],
  // Old Castile and León
  ["avila", "valladolid", 3, "main"], ["valladolid", "burgos", 3, "main"], ["valladolid", "palencia", 2, "main"], ["palencia", "leon", 2, "main"],
  ["valladolid", "zamora", 1, "main"], ["zamora", "salamanca", 1, "main"], ["salamanca", "avila", 2, "main"], ["segovia", "valladolid", 1, "minor"],
  ["burgos", "palencia", 1, "minor"], ["leon", "zamora", 1, "minor"], ["valladolid", "salamanca", 0, "minor"], ["valladolid", "leon", 0, "minor"],
  ["avila", "segovia", 0, "minor"], ["burgos", "segovia", 0, "minor"], ["burgos", "soria", 0, "minor"], ["segovia", "soria", 0, "minor"],
  ["soria", "guadalajara", 1, "minor"], ["segovia", "guadalajara", 0, "minor", "Somosierra"], ["guadarrama", "henares", 0, "minor"],
  // The north: sparse, mountainous
  ["leon", "asturias", 2, "main", "Pajares"], ["asturias", "oviedo", 2, "main"], ["asturias", "cantabria", 1, "minor"],
  ["palencia", "cantabria", 2, "main", "Reinosa"], ["cantabria", "burgos", 0, "minor", "Puerto del Escudo"], ["cantabria", "bizkaia", 1, "main"],
  ["bizkaia", "alava", 2, "main", "Orduña"], ["alava", "burgos", 3, "main"], ["alava", "gipuzkoa", 3, "main"], ["bizkaia", "gipuzkoa", 1, "minor"],
  ["gipuzkoa", "navarra", 1, "minor", "Alsasua"], ["alava", "navarra", 1, "main"], ["alava", "la-rioja", 1, "main"], ["navarra", "la-rioja", 1, "minor"],
  ["la-rioja", "burgos", 0, "minor"], ["bizkaia", "burgos", 0, "minor"],
  // Galicia
  ["leon", "lugo", 2, "main", "Piedrafita"], ["lugo", "a-coruna", 2, "main"], ["lugo", "ourense", 2, "main"], ["ourense", "pontevedra", 2, "main"],
  ["a-coruna", "pontevedra", 1, "main"], ["ourense", "zamora", 0, "minor", "Padornelo"], ["lugo", "pontevedra", 0, "minor"], ["ourense", "leon", 0, "minor"],
  // Islands: no land links
  ["mallorca", "menorca", 0, null], ["mallorca", "ibiza", 0, null]
];
// Borders with no road at all: only infantry can cross (note 6a). Mountain or empty country.
export const noRoad = [
  ["lugo", "asturias"], ["cantabria", "leon"], ["teruel", "cuenca"], ["teruel", "guadalajara"], ["avila", "caceres"], ["albacete", "granada"],
  ["la-rioja", "soria"], ["guadalajara", "guadarrama"]
];
