# m3r1-map-provinces progress

## CP1: vendored source and geometry (commits b04b0b9, then the attribution and comment fix after it)

**Done**
- `npm run maps:fetch -- provinces` vendors geoBoundaries gbOpen ESP ADM2 (simplified), revision `9469f09` (the same as ADM1), verbatim to `scripts/sources/geoboundaries/geoBoundaries-ESP-ADM2_simplified.geojson`. Its SHA-256 (`40a12d32...`) is in `manifest.json` under `provinces`. Before writing, the fetch checks three things:
  - the file is not an LFS pointer;
  - its SHA-256 equals the LFS object id;
  - it has exactly 52 ADM2 features, including Ceuta and Melilla. That is 50 provinces plus the two cities; the build ignores the two Canarias provinces.
- `scripts/map/partition.ts` cuts a territory's region rings into labelled parts. The rings are the exact rings written to `iberia-regions.svg`. The method:
  1. Label a grid of 0.125 km cells from the ADM2 provinces, or from hand-drawn lines and seeds.
  2. Trace the label boundaries as chains, and simplify each chain once (0.25 km), keeping its junctions.
  3. Cut the chains at the region edges.
  4. Trace the faces of the result, label them, and merge faces that share a label.
- `scripts/map/iberia-1936-sub-territories.ts` holds:
  - the 55 D8 ids, each with its territory, a suggested Castilian name, its ADM2 province and its capital (Wikipedia coordinates);
  - the hand-drawn split lines.
- `npm run maps:build` now also writes:
  - `assets/maps/iberia-sub-territories.svg`: one path per id, read even-odd, 176 KB, loaded lazily like the region SVG;
  - `map.json` `subTerritories`: `{ svg, entries: { id: { territoryId, label, capital } } }`.
- `mapSchema.ts` has the optional `subTerritories` field, and `map.schema.json` is regenerated. `scenario.schema.json` is unchanged.
- The attribution credits INE for the provinces. `ATTRIBUTION.md` has a sub-territory section.

**Decisions**
1. ADM2 never supplies an outer edge. Every sub-territory's outer edges are its region's rings, vertex for vertex; ADM2 only decides which side of an internal line a point is on. The reason: ADM2 (INE) and ADM1 (IGN) disagree by up to several km, and ADM2's own shared borders are not fully shared.
2. The regions, the relief and the checksums of the existing assets are unchanged, byte for byte.
3. The province data's licence is not CC BY 4.0, as the brief assumed. The geoBoundaries metadata names the "National Institute of Statistics (INE) Data License", which points to the INE legal notice. Its reuse section allows reuse, commercial or not, if four conditions are met:
   - the source is cited ("Elaboracion propia con datos extraidos del sitio web del INE: www.ine.es");
   - the date is given;
   - the meaning of the data is not distorted;
   - nothing implies that the INE endorses the reuse.

   The Settings attribution now carries that citation, still in the single entry that mentions geoBoundaries, which `app.test.tsx` expects to find once.
4. Oviedo is the concejo of Oviedo (187 km2), closed inside `asturias`.
5. Madrid follows municipal groups:
   - `guadarrama` is the Sierra Norte plus the Sierra de Guadarrama and El Escorial, so it includes Somosierra. D8 says "north-west"; this is read as the whole Sierra front.
   - `henares` is the Henares valley and the Jarama-Henares plain.
   - `madrid` is the rest.
6. The split lines are traced from geoBoundaries ADM3 (IGN, CC BY 4.0), simplified, and stored as lines; ADM3 is not vendored.
7. Baleares: each island takes its capital's part, and islets join the nearest island.
8. Capital points move to the nearest point at least 0.3 km inside their part. The largest move is 0.64 km.
9. Generated names in the JSON are ASCII with `\u` escapes, as before.
10. The paths are not inline in `map.json`; they live in a separate SVG that loads lazily. This differs from the ownership note "sub-territory geometry in map.json". The reason: `map.json` is imported eagerly, so inline paths would add about 176 KB to the initial chunk.

**Checks**
- `npm run maps:build` exit 0, run twice; `map.json` is byte-identical between the runs.
- Checksum check: all 5 assets match.
- Build-time guards:
  - every territory's parts sum to its region area;
  - every province is within 3 percent of its ADM2 area (the largest gap is `alava`, +1.7 percent);
  - no internal lines cross.
- `lint` 0, `typecheck` 0, `test:unit` 0 (483 tests).

**Next (CP2)**
- Sub-territory adjacency, with shared border length.
- Entry sub-territories for each land connection, and ports for each sea connection.
- A generated topology file.
- `project/specs/map-package.md`.
- Unit tests.

## CP2: topology, schema and tests (commits 8f50062, then the city lookup after it)

**Done**
- `scripts/map/topology.ts` measures, from the built geometry:
  - shared border length between every pair of sub-territories;
  - coast per sub-territory;
  - the entry sub-territories of each scenario connection.
- `npm run maps:build` writes `sub-territory-topology.json` beside `map.json`. It is in the contract's CT-10 shape, ready to copy into `scenario.json`:
  - `subTerritoryBorders`: 118 `[a, b]` pairs;
  - `connections[]`: `{ between, kind, entry: [a, b] }` in scenario order, with `entry` in `between` order (ports for sea connections);
  - `subTerritories[]`: `{ id, territoryId, name }`, the name being a suggestion;
  - `measurements`: border km, coast km, and connection km.
- One constant, `scenarioPackage` in `scripts/map/iberia-1936.ts`, names the scenario folder. `mapDocument`, `scenarioDocument`, `topologyDocument` and the tests derive from it.
- `manifest.json`: `boundarySource` is now "Estad\u00edstica" (upstream drops the letter). The fetch script restores it and writes the manifest as ASCII.
- `project/specs/map-package.md` documents `subTerritories` and the topology file.
- Tests:
  - `src/test/mapPartition.test.ts` (12 tests): partitioning, topology and the build on synthetic shapes.
  - `src/test/subTerritories.test.ts` (14 tests) on the shipped package:
    - the ids equal D8 exactly;
    - the SVG path ids equal the `entries` keys, in the same order;
    - rings are closed;
    - the parts cover their region's area to within 0.2 percent;
    - every label and capital point is inside its own part only;
    - capitals are within 1 km of their towns;
    - the split areas fall in their expected bands;
    - enclave probes are taken from real region rings (Trevino, Petilla, Ademuz, Llivia, Formentera, Cabrera, Dragonera);
    - borders are unique and symmetric;
    - each mainland territory is one connected piece;
    - cross-territory borders match the land connections exactly;
    - every connection has entries on the right sides, land entries share a border, and ports have coast;
    - inland and coastal checks.

**Decisions**
11. Two sub-territories border if at least 2 km of their boundaries lie within 0.75 km of each other. Region borders are simplified separately, so neighbours across a territory border sit a little apart. Corner touches do not count.
12. Coast is boundary whose outward probes, at 0.5 to 8 km, all land in the sea. Natural Earth and geoBoundaries leave gaps of up to several km along the Portuguese rivers, and the longer probes cross them. Inland frontier provinces keep at most 1.4 km of false coast, below the 5 km a port needs.
13. A land entry is the pair across the two territories with the longest shared border. A sea entry (the ports) is the pair of coastal sub-territories whose coasts come closest. The sea results:
    - cadiz to ceuta (17 km);
    - almeria to melilla (153 km);
    - barcelona to mallorca (168 km);
    - alicante to ibiza (84 km).
    The contract may prefer other historical ports: valencia for the Valencia crossing, malaga for Melilla.
14. The topology file also carries suggested names, the measurements, and `cities: { cityId: subTerritoryId }`: the part each map city stands in, for `cities[].subTerritoryId` (L16). Every scenario city lands in its own territory; Oviedo is in `oviedo` and Gijon in `asturias`. The contract can ignore the names and measurements.
15. Cross-territory borders equal the scenario's 29 land connections exactly, so no connection is missing or extra.

**Checks**
- `npm run maps:build` exit 0. Two runs gave identical `map.json`, topology and assets; all 5 checksums match; the relief and region files are unchanged.
- `npm run maps:fetch -- provinces` reproduces `manifest.json` byte for byte.
- `lint` 0, `typecheck` 0, `test:unit` 0 (29 files, 510 tests; coverage 98.64 statements, 94.95 branches).
- `npm run build` 0. The sub-territory SVG is its own lazy chunk (180 KB, 49 KB gzip), and `map.json` grew from 30.9 to 42.8 KB.
- `E2E_PORT=5302` e2e on chromium and mobile-chromium: exit 0, 51 passed and 5 skipped, with no baseline diffs.
- Run in the contract worktree at `ea8b0cb`, against its schemas:
  - `subTerritoryBorders` parses with `subTerritoryBordersSchema`;
  - all 33 of its Spain connections match the topology's `between`/`kind` order and parse with `entry` added;
  - its 55 sub-territory ids all appear in the topology.
  - Its `builtInSources.ts` still loads only `map.json` and `scenario.json` per folder, so the topology file is not bundled.

**Next**
- Hand-off.
- At merge, the integrator moves `scenarioPackage` to the contract's folder, and the contract copies `subTerritoryBorders` and `connections[].entry` into `scenario.json`.

## CP3: entry overrides and island links (reviewer gaps)

**Done**
- `entryOverrides` (in `scripts/map/iberia-1936-sub-territories.ts`) are per-connection entries, keyed by territory id, each with its reason. Where one exists it replaces the derived rule. Each override is checked:
  - both ids are known;
  - each sits on its own side;
  - land pairs share a border, and sea pairs are both coastal;
  - the override matches a connection.
- `seaLinks` `mallorca`-`menorca` and `mallorca`-`ibiza` are written into `subTerritoryBorders`, and marked `sea: true` in `measurements.borderKm` together with the crossing distance. Every territory's sub-territories now form one connected graph, and the test that skipped Baleares now covers it.
- The topology file's `connections[]` are the scenario's own connection objects, unchanged except for `entry`, so they match `scenario.json` field for field. `measurements.connectionKm` records the rule behind each entry (`override`, `longest-border`, `closest-coasts`) and the reason.

**Decisions**
16. Sea overrides follow the 1930s steamer lines:
    - `cadiz`-`ceuta` (Algeciras);
    - `malaga`-`melilla`;
    - `barcelona`-`mallorca`;
    - `valencia`-`mallorca`.
    I pinned all four, even where the closest-coasts rule already agreed, so a geometry change cannot flip them.
17. Land overrides:
    - `toledo`-`caceres`: the Tajo valley road from Navalmoral to Talavera, the Army of Africa's march on Madrid.
    - `sevilla`-`badajoz`: the Sevilla-Merida road and railway on the Via de la Plata, the column route of August 1936.
    - `la-rioja`-`burgos`: the Ebro valley road and railway from Logrono to Haro and Miranda. The longest border went into Soria over the Cameros passes.
    - `cuenca`-`valencia`: the Madrid-Valencia road through Motilla to Requena, the Republic's lifeline. The longest border went through Albacete.
18. Every other land entry already follows the main 1936 route, so none is overridden. The routes:
    - `lugo`-`leon`: the Galician mainline through Monforte and Ponferrada;
    - `asturias`-`leon`: the Pajares railway;
    - `alava`-`burgos`: Vitoria-Miranda;
    - `gipuzkoa`-`navarra`: Mola's 1936 front;
    - `navarra`-`zaragoza`: Tudela;
    - `zaragoza`-`soria`: the Madrid-Zaragoza railway at Arcos de Jalon;
    - `soria`-`guadalajara`: Siguenza and Medinaceli;
    - `teruel`-`castellon`: the Central de Aragon railway through Segorbe;
    - `huesca`-`lleida`: Fraga, on the Zaragoza-Lleida road;
    - `guadarrama`-`segovia`: the passes;
    - `madrid`-`toledo`;
    - `salamanca`-`caceres`: the Via de la Plata;
    - `ciudad-real`-`jaen`: Despenaperras;
    - `albacete`-`murcia`: Hellin;
    - `alicante`-`murcia`;
    - `almeria`-`murcia`: the Lorca coast road and the Lorca-Baza railway;
    - `tarragona`-`castellon`: the coast road;
    - `cantabria`-`burgos`: the Escudo road (Reinosa via Palencia is the other route);
    - `teruel`-`guadalajara`: Molina;
    - `la-rioja`-`zaragoza`: the only border.

**Checks**
- `npm run maps:build` exit 0. Two runs gave identical output, all 5 checksums match, and the relief and region files are unchanged.
- `lint`, `typecheck`, `test:unit` and `build` all exit 0 (29 files, 514 tests).
- `E2E_PORT=5302` e2e on chromium and mobile-chromium: exit 0, 51 passed and 5 skipped.
