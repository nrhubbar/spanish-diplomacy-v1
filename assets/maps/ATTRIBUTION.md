# Map asset provenance

Every file in this directory ships with the game. Their SHA-256 checksums are in `checksums.json`; a unit test fails if a file changes without the manifest being updated (`npm run maps:checksums`). Source inputs live in `scripts/sources/` and are not shipped. The game calls no map, tile, or elevation service at runtime.

## How the files are made

All four files come from one script, `scripts/build-map.ts` (`npm run maps:build`), which runs offline from the vendored sources and then checks the outputs against `checksums.json`. It also rewrites every coordinate in `src/main/scenarios/spain-1936-07-31/map.json` (view box, focus, unit anchors, labels, cities, enclave circles, context labels) from the same geography.

- **One projection.** Region polygons, neighbouring countries, the elevation model, cities, and labels all pass through the same spherical Lambert conformal conic (standard parallels 37N and 43N, origin 40N 3W, map units in kilometres). Nothing is fitted to an existing picture.
- **Registered by construction.** The relief's land/sea edge is rasterized from the exact SVG path data written to `iberia-regions.svg`, so coastlines and borders in the relief and in the vector layer are the same lines. The build fails if a sample of points either side of the region edges disagrees with the baked land mask (`registration:` in its log), and the e2e test "draws the relief coastline exactly under the region coastline at full zoom" checks the rendered result in every browser.
- **Reproducible.** The build uses sharp/libvips (pinned in `package.json`), not a browser, so the same sources reproduce the same bytes. On 18 November 2026 two consecutive builds on macOS produced identical files.

`npm run maps:fetch` (`scripts/fetch-map-sources.ts`) is the only map script that uses the network. It re-downloads the elevation and Natural Earth inputs, records every upstream file's SHA-256 in `scripts/sources/manifest.json`, and rewrites the vendored derivatives; review the diff before committing.

## `iberia-regions.svg`

Runtime territory geometry and interaction mask (regions `ES11` ... `ES62`).

- Source: geoBoundaries gbOpen Spain ADM1 (simplified), pinned to revision `9469f09`: https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen/ESP
- Vendored copy: `scripts/sources/geoboundaries/geoBoundaries-ESP-ADM1_simplified.geojson` (SHA-256 `b61a1bf661b90883763f633f5e9dbc27e7356309e42cbe56b60d2ceab5112f63`, checked before use)
- License: Creative Commons Attribution 4.0 International (CC BY 4.0)
- Attribution: (c) geoBoundaries; source boundary data from the Instituto Geografico Nacional, Spain
- Changes: projected, simplified (Douglas-Peucker, 0.25 km tolerance; islets under 0.4 km2 dropped), assigned stable region ids, serialized to 0.1 km

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

## City and enclave positions

Cities, Ceuta, and Melilla are placed from WGS 84 coordinates listed in `scripts/map/iberia-1936.ts`: the coordinates of each city's English Wikipedia article, read through the MediaWiki API on 18 November 2026 and rounded to 0.001 degree.

## Removed sources

The earlier pipeline (`scripts/calibrate-map.mjs`, `scripts/register-geography.mjs`) fitted the geoBoundaries polygons to a hand-cropped Maps-For-Free relief raster (CC0). That raster, its crops, the prototype `iberia.svg`, and the unused geoBoundaries ADM0 file were removed from `scripts/sources/` together with the scripts, because nothing reads them any more. They remain in git history.
