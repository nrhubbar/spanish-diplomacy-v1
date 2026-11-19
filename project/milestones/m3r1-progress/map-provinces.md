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
