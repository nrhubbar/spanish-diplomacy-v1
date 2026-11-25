# Map asset provenance

Every file in this directory ships with the game. Their SHA-256 checksums are in `checksums.json`; a unit test fails if a file changes without the manifest being updated (`npm run maps:checksums`). Source inputs live in `scripts/sources/` and are not shipped. The game calls no map, tile, or elevation service at runtime.

## How the files are made

The five `iberia-*` files come from one script, `scripts/build-map.ts` (`npm run maps:build`), which runs offline from the vendored sources and then checks the outputs against `checksums.json`. It also rewrites every coordinate in `src/main/scenarios/spain-1936-07-31/map.json` (view box, focus, unit anchors, labels, cities, enclave circles, sub-territory label and capital points, context labels, rivers, and water labels) from the same geography, and writes the sub-territory borders and connection entries to `sub-territory-topology.json` beside it. `node scripts/build-map.ts --package-only` rewrites only `map.json`, `sub-territory-topology.json`, and `iberia-sub-territories.svg` (none needs the relief), for iterating on labels; only the full build checks registration and checksums.

- **One projection.** Region polygons, neighbouring countries, rivers, the elevation model, cities, and labels all pass through the same spherical Lambert conformal conic (standard parallels 37N and 43N, origin 40N 3W, map units in kilometres). Nothing is fitted to an existing picture.
- **Registered by construction.** The relief's land/sea edge is rasterized from the exact SVG path data written to `iberia-regions.svg`, so coastlines and borders in the relief and in the vector layer are the same lines. The build fails if a sample of points either side of the region edges disagrees with the baked land mask (`registration:` in its log), or if any river vertex lies off the region polygons or off the baked land mask (`river registration:`); the unit test "puts every river vertex inside a region" checks the shipped `map.json` against the shipped SVG, and the e2e test "draws the relief coastline exactly under the region coastline at full zoom" checks the rendered result in every browser.
- **Reproducible.** The build uses sharp/libvips (pinned in `package.json`), not a browser, so the same sources reproduce the same bytes. On 18 November 2026 two consecutive builds on macOS produced identical files.

`npm run maps:fetch` (`scripts/fetch-map-sources.ts`) is the only map script that uses the network. It re-downloads the elevation, Natural Earth, and geoBoundaries province inputs, records every upstream file's SHA-256 in `scripts/sources/manifest.json`, and rewrites the vendored files; review the diff before committing. `npm run maps:fetch -- rivers` (or `elevation`, `neutralLand`, `provinces`) refreshes only the named sources.

## `iberia-regions.svg`

Runtime territory geometry and interaction mask (regions `ES11` ... `ES62`).

- Source: geoBoundaries gbOpen Spain ADM1 (simplified), pinned to revision `9469f09`: https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen/ESP
- Vendored copy: `scripts/sources/geoboundaries/geoBoundaries-ESP-ADM1_simplified.geojson` (SHA-256 `b61a1bf661b90883763f633f5e9dbc27e7356309e42cbe56b60d2ceab5112f63`, checked before use)
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- Attribution: (c) geoBoundaries; source boundary data from the Instituto Geografico Nacional, Spain
- Changes: projected, simplified (Douglas-Peucker, 0.25 km tolerance; islets under 0.4 km2 dropped), assigned stable region ids, serialized to 0.1 km

## `iberia-sub-territories.svg`

Runtime sub-territory geometry: one path per sub-territory, its element id the sub-territory id (the 1936 provinces, Baleares by island, Asturias in two and Madrid in three; 55 in all). `map.json` binds each to its territory and gives its label and capital points.

- Outer edges: each territory's own region rings from `iberia-regions.svg` (above), vertex for vertex, so sub-territory borders agree with the region borders. Ceuta and Melilla use the same ADM1 land as the relief.
- Province borders inside a territory: geoBoundaries gbOpen Spain ADM2 (simplified), pinned to revision `9469f09` like ADM1: https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen/ESP/ADM2
  - Vendored copy: `scripts/sources/geoboundaries/geoBoundaries-ESP-ADM2_simplified.geojson` (SHA-256 `40a12d32651a352b59bc88447432421ab80e2d950deb6f552efbae907f7232c2`, equal to the repository's Git LFS object id; checked before use). 52 features: the 50 provinces, Ceuta, and Melilla.
  - License: geoBoundaries is released under Creative Commons Attribution 4.0 International (CC BY 4.0), but the geoBoundaries metadata for this layer (`geoBoundaries-ESP-ADM2-metaData.json`) gives its source as the Instituto Nacional de Estadistica (INE), Spain, boundary year 2018, under the "National Institute of Statistics (INE) Data License", with the licence source https://www.ine.es/ss/Satellite?L=0&c=Page&cid=1254735849170&p=1254735849170&pagename=Ayuda%2FINELayout (the INE legal notice). Its section "Reutilizacion de la informacion contenida en este sitio web", read on 19 November 2026, allows commercial and non-commercial reuse of information whose original source is the INE on these conditions: the meaning of the information is not distorted; the source is cited, as "Elaboracion propia con datos extraidos del sitio web del INE: www.ine.es" when the data is processed; the date of the last update is given when the original includes one; and nothing suggests that the INE takes part in, sponsors, or supports the reuse.
  - Attribution (shown on the Settings screen through `map.json`, with its accents): (c) geoBoundaries; "Elaboracion propia con datos extraidos del sitio web del INE: www.ine.es" (2018 boundaries)
- Hand-drawn splits (`scripts/map/iberia-1936-sub-territories.ts`): lines that follow municipal boundaries traced from geoBoundaries gbOpen Spain ADM3 (municipalities, source Instituto Geografico Nacional, CC BY 4.0, revision `9469f09`), simplified (Douglas-Peucker, 0.3 km) and rounded to 0.001 degree. ADM3 is not vendored; the lines are.
  - `oviedo`: the municipality (concejo) of Oviedo; `asturias`: the rest of the province.
  - `guadarrama`: the Sierra Norte (La Acebeda, Alameda del Valle, El Atazar, Berzosa del Lozoya, El Berrueco, Braojos, Buitrago del Lozoya, Bustarviejo, Cabanillas de la Sierra, La Cabrera, Canencia, Cervera de Buitrago, Garganta de los Montes, Gargantilla del Lozoya y Pinilla de Buitrago, Gascones, La Hiruela, Horcajo de la Sierra-Aoslos, Horcajuelo de la Sierra, Lozoya, Lozoyuela-Navas-Sieteiglesias, Madarcos, Montejo de la Sierra, Navalafuente, Navarredonda y San Mames, Patones, Pinilla del Valle, Pinuecar-Gandullas, Pradena del Rincon, Puebla de la Sierra, Puentes Viejas, Rascafria, Reduena, Robledillo de la Jara, Robregordo, La Serna del Monte, Somosierra, Torrelaguna, Torremocha de Jarama, Valdemanco, El Vellon, Venturada, Villavieja del Lozoya) and the Sierra de Guadarrama (Alpedrete, Becerril de la Sierra, El Boalo, Cercedilla, Collado Mediano, Collado Villalba, El Escorial, Guadalix de la Sierra, Guadarrama, Manzanares el Real, Miraflores de la Sierra, Los Molinos, Moralzarzal, Navacerrada, San Lorenzo de El Escorial, Santa Maria de la Alameda, Soto del Real, Zarzalejo, and the shared lands of Los Baldios and El Redeguelo).
  - `henares`: the Henares valley and the Jarama-Henares plain (Ajalvir, Alcala de Henares, Algete, Anchuelo, Camarma de Esteruelas, Cobena, Corpa, Daganzo de Arriba, Fresno de Torote, Fuente el Saz de Jarama, Los Santos de la Humosa, Meco, Paracuellos de Jarama, Pezuela de las Torres, Ribatejada, San Fernando de Henares, Santorcaz, Talamanca de Jarama, Torrejon de Ardoz, Torres de la Alameda, Valdeavero, Valdeolmos-Alalpardo, Valdepielagos, Valdetorres de Jarama, Valverde de Alcala, Villalbilla).
  - `madrid`: every other municipality of the province: the city, the west, and the south.
  - Baleares is one province in the source: each island takes the part of its capital's island, and islets join the nearest island (Formentera Ibiza; Cabrera and Dragonera Mallorca).
- Changes: projected; internal lines found on a 0.125 km grid labelled from the provinces (or split lines), traced, simplified once each (Douglas-Peucker, 0.25 km, keeping the points where three parts meet) and cut at the region edges; serialized to 0.1 km. The build fails if the parts of a territory do not add up to its region's area, if a province's part differs from its ADM2 area by more than 3 percent, or if two internal lines cross.
- Capital points: the chief town of each sub-territory, from the same Wikipedia coordinates as the cities (below; retrieved 19 November 2026 for the towns not in the city list), moved inward when the simplified coast leaves the town outside.

## Relief: `iberia-relief-detail.webp`, `iberia-relief-margin.webp`, and `iberia-relief-overview.webp`

Baked shaded relief: a multi-directional hillshade (four lights, strongest from the north-west) with a generalized relief term, a hypsometric tint in sandstone, olive, muted green, and warm gray, neutral gray relief for neighbouring countries, and a quiet depth-tinted sea with a lighter shore. Three layers are drawn coarsest first, all resampled from one 4-texels-per-km working raster:

- detail: the map's view box at 2.8 texels per km (4032 x 3360), sharpened slightly, with edges that fade out over 30 km;
- margin: the working raster's whole extent (the view box plus about 260 km) at 1.2 texels per km (2352 x 2064), for a fully zoomed camera at the view box edge, with edges that fade out over 60 km;
- overview: a wider area at 0.6 texels per km (2100 x 1800), from the zoom-5 elevation outside the working raster, fading into the map background at its edges.

### Elevation

- Source: AWS Terrain Tiles ("terrarium" encoding), Registry of Open Data on AWS: https://registry.opendata.aws/terrain-tiles/ , tiles from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- Retrieved: 18 November 2026. Zoom 8 (about 470 m cells; 270 tiles) for the working raster, zoom 5 (19 tiles) for the overview's outer area. Each tile's SHA-256 is in `scripts/sources/manifest.json`.
- Vendored derivatives: `scripts/sources/dem/terrarium-detail-z8.tif` (SHA-256 `217c6ccd59791a09ad28911c062cb38a384d599849d01bc2633d8e676236c837`) and `scripts/sources/dem/terrarium-overview-z5.tif` (SHA-256 `75e151b44271c3ccf9c4aee8b649f206e9549f2cd287fa66ba37069026f8ef0a`): the tiles of one zoom joined and decoded to whole metres in a 16-bit grayscale TIFF (value = metres + 12000; 0 = not fetched). Whole metres are the precision of the underlying sources.
- License and required credits, quoted from the Terrain Tiles attribution page (https://github.com/tilezen/joerd/blob/master/docs/attribution.md) for the sources covering this area:
  - "Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers;"
  - "Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration"
  - "United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey."

  The same credits are shown on the Settings screen through `map.json`.

### Neighbouring countries (land and sea mask outside Spain)

- Source: Natural Earth 1:10m Cultural Vectors, Admin 0 - Countries, release `v5.1.2` (commit `f1890d9f152c896d250a77557a5751a93d494776`): https://github.com/nvkelso/natural-earth-vector ; upstream file `geojson/ne_10m_admin_0_countries.geojson` SHA-256 `239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255`
- License: public domain (https://www.naturalearthdata.com/about/terms-of-use/). Credited as "Made with Natural Earth".
- Vendored subset: `scripts/sources/naturalearth/ne_10m_admin_0_countries-subset.geojson` (SHA-256 `37250d6945edecee5ca6c766c047af32fb7b91c3e212fca61e1092668442dc23`): the 43 countries other than Spain that touch the overview area, coordinates rounded to 0.0001 degree
- Use: neutral land only. Spain's own land comes from the geoBoundaries regions; texels within 1.5 km of both datasets on land are filled so the two boundary sources meet without a gap.

## Rivers (in `map.json`)

Vector rivers drawn over the relief: the eight main rivers and 22 major tributaries.

- Source: Natural Earth 1:10m Physical Vectors, Rivers + lake centerlines and its Europe supplement, release `v5.1.2` (commit `f1890d9f152c896d250a77557a5751a93d494776`): https://github.com/nvkelso/natural-earth-vector ; upstream files `geojson/ne_10m_rivers_lake_centerlines.geojson` (SHA-256 `bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a`) and `geojson/ne_10m_rivers_europe.geojson` (SHA-256 `90712202ac46985812e90840df9acd5101599a9c649868d5bc55ee96c2fedd4c`), retrieved 18 November 2026
- License: public domain (https://www.naturalearthdata.com/about/terms-of-use/). Credited as "Made with Natural Earth".
- Vendored subset: `scripts/sources/naturalearth/ne_10m_rivers-iberia.geojson` (SHA-256 `8ba93cfd8ce0969fa4d818f2032e3618e8ab9b9d5f1fd86960b663e89602d419`): the 59 lines of both files with a vertex between 9.8W and 4.6E and between 35.8N and 44N, cut to that extent with one vertex kept either side, coordinates rounded to 0.0001 degree, and only the `name`, `name_en`, `name_es`, `featurecla`, `scalerank`, `min_zoom`, `rivernum`, and `ne_id` properties kept
- Changes: rivers are chosen and named by `rivernum` in `scripts/map/iberia-1936-water.ts` (Natural Earth's own names are unreliable here, for example "Mio" for the Mino), joined where their pieces meet, turned to run downhill using the elevation model, clipped to the playable regions (stretches within 2.5 km of the Portuguese or French border are drawn just inside it; slivers between the two boundary datasets are bridged), simplified (Douglas-Peucker, 0.3 km for main rivers and 0.45 km for tributaries, never across the sea or a border), and serialized to 0.1 km. A river whose downstream end is near the sea gets a `mouth` stretch that tapers. River names and the 25 sea, gulf, and bay names are Castilian Spanish place names placed by hand from their WGS 84 positions.

## City and enclave positions

Cities, Ceuta, and Melilla are placed from WGS 84 coordinates listed in `scripts/map/iberia-1936.ts`: the coordinates of each city's English Wikipedia article, read through the MediaWiki API on 18 November 2026 and rounded to 0.001 degree. Sub-territory capitals in `scripts/map/iberia-1936-sub-territories.ts` reuse them, and add the other provincial capitals, Gijon, Collado Villalba, Alcala de Henares, Palma, Mahon, and Ibiza, read the same way on 19 November 2026.

## Removed sources

The earlier pipeline (`scripts/calibrate-map.mjs`, `scripts/register-geography.mjs`) fitted the geoBoundaries polygons to a hand-cropped Maps-For-Free relief raster (CC0). That raster, its crops, the prototype `iberia.svg`, and the unused geoBoundaries ADM0 file were removed from `scripts/sources/` together with the scripts, because nothing reads them any more. They remain in git history.

## Europe, 1805 (`europe-*`)

The four `europe-*` files come from `node scripts/build-europe-map.ts`, offline, from the inputs listed with their SHA-256 in `scripts/sources/europe-manifest.json` (downloaded 24 November 2026). Run `npm run maps:checksums` after it.

- `europe-regions.svg`, `europe-sub-territories.svg`: modern provinces from Natural Earth 10m admin-1 (public domain), merged into the areas listed in `scripts/map/europe-1805-areas.json` and simplified to about 1.3 km (islands under 70 km2 dropped). A few provinces are shared between areas along invented lines. Borders follow modern provinces, so they only approximate 1805. `scripts/europe-geometry.mjs` rebuilds the merged geometry; it needs mapshaper, which is not a project dependency.
- `europe-relief-overview.webp`, `europe-relief-detail.webp`: shaded relief computed from AWS Terrain Tiles (Mapzen terrarium, zoom 6), with the lakes from Natural Earth. Elevation credits as for the Iberian relief above.
- Rivers, lakes and water names in `map.json`: Natural Earth 10m (public domain).
