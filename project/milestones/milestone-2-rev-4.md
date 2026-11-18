# Milestone 2 Revision 4: Production Map Pass

> Internal product and implementation plan. Nothing in this document, including research notes, quality criteria, or design rationale, may be imported into or rendered by the player-facing application.

## Direction

Revision 4 turns the functional campaign board into a production-quality strategy map. The experience should feel like a restrained historical command table: tactile terrain, quiet ownership information, unmistakable units and orders, and controls that disappear into muscle memory.

The approved direction is a lightly tilted 2.5D relief map with semantic zoom. The map remains the primary surface; interface panels support decisions without competing with it.

### Review Concepts

- [Planning overview](../mockups/milestone-2-rev-4/planning-overview.png)
- [Semantic zoom](../mockups/milestone-2-rev-4/semantic-zoom.png)
- [Turn resolution](../mockups/milestone-2-rev-4/resolution.png)

These images define hierarchy, material, density, and interaction language. They are directional rather than geographic or pixel-perfect specifications.

## Feedback Summary

- Map input currently leaks into page scrolling, keyboard panning is ineffective, and next-turn routing is unreliable.
- Terrain, ownership, units, routes, and outcomes compete for attention instead of forming a hierarchy.
- Unit detail and outcome graphics scale poorly.
- The board needs real relief and a visible northern Morocco landmass.

## Approved Rendering Rules

- Gold is the single active-focus language. It marks the selected unit, selected origin, or committed destination with both an outline and glow. Legal destinations remain cyan and dashed; ownership, movement, and combat outcomes never borrow gold.
- The counter-to-label-to-terrain proportions in the reviewed concepts are the production target. Counter bodies keep a stable screen-space footprint while designation and strength appear through semantic zoom.
- Portugal, southern France, and northern Morocco share the same neutral gray-relief treatment. They provide geographic context, carry country labels, and are not interactive territories.
- The Balearics remain a strategically relevant, contested territory and therefore use the contested brown wash. This is intentional: Mallorca was under rebel control from the outset, Menorca remained Republican, and the Pityusic islands changed hands. The archipelago subsequently became an important Mediterranean military and air-naval position.
- NATO counters are softly tinted with their faction color. Their geometry, charcoal line work, ordered badge, and accessible name continue to carry meaning when hue is unavailable.

Historical basis: [Government of the Balearic Islands, Civil War and repression context](https://www.caib.es/sites/memoria/f/560655) and David Ginard Féron's study, [*The Balearic Islands during the Spanish Civil War: Strategy, diplomacy, propaganda and information*](https://doi.org/10.6035/MILLARS.2026.60.4).

## Plan Forward

### 1. Build One Camera And Input Model

- Replace scattered transform behavior with one testable camera state: position, zoom, bounds, viewport, and semantic zoom level.
- Wheel input over the map is captured by an explicitly non-passive listener and never scrolls the page. Pinch, drag, controls, and keyboard commands call the same camera actions.
- WASD and arrow keys pan whenever the map owns focus and the target is not an editable control. The initial camera framing must allow meaningful movement rather than clamping at the first keypress.
- Screen-to-map projection is shared by terrain, borders, cities, units, orders, hit testing, and accessibility overlays.

### 2. Render A Lightly Tilted 2.5D Board

- Generate `iberia-registered.svg` from the pinned geoBoundaries gbOpen Spain ADM1 dataset (CC BY 4.0) and use it as the authoritative territory geometry and interaction mask. The build-time registration fits WGS-84 polygons to the relief once; runtime overlays use identity projection in the shared view box.
- Use `spain-topo.png` as the existing art-direction and alignment reference.
- Produce a local height/normal asset from **USGS SRTM 1 Arc-Second Global** elevation data. The dataset is public domain, openly distributed, and approximately 30 m resolution. Record the source, processing commands, crop, and attribution in the repository.
- Render shallow displaced relief with a fixed camera and conservative vertical exaggeration. Terrain must remain readable under ownership overlays and must not become a scenic distraction.
- Expand the composition southward so northern Morocco is a continuous, clearly recognizable, non-interactive landmass beneath Ceuta and Melilla. Units must always sit over visible land or a deliberate inset.
- Keep all runtime map assets local. Do not require a live map or elevation service.

Source: [USGS SRTM 1 Arc-Second Global dataset](https://data.usgs.gov/datacatalog/data/USGS%3AEROS5e83a3ee1af480c5), public-domain license and DOI `10.5066/F7PR7TFT`.

`spain-topo.png` requires a provenance check before release. If its redistribution rights cannot be confirmed, recreate its color-relief role from SRTM plus public-domain Natural Earth data rather than shipping an uncertain asset.

### 3. Establish A Deliberate Visual Hierarchy

1. **Terrain:** neutral sandstone, olive, muted green, and warm-gray relief.
2. **Ownership:** low-opacity faction wash plus a distinct boundary treatment; never opaque faction-colored terrain.
3. **Cities and borders:** crisp, quiet cartographic marks that remain readable against the least-contrasting terrain.
4. **Units:** softly faction-tinted NATO counters with charcoal line work and a narrow, high-contrast edge.
5. **Orders:** cool cyan planning routes, amber bounces, and muted crimson disbands. Route meaning does not reuse ownership color.
6. **Selection:** one restrained gold focus treatment with a solid outline and glow; gold is reserved for actionable selection.

Color is never the sole carrier of game state. Shape, stroke pattern, iconography, labels, and ARIA descriptions must preserve the same meaning in grayscale and common color-vision simulations.

### 4. Use Semantic Zoom For Units And Labels

- Overview: NATO symbol and faction accent only; optional compact strength indicator when space permits.
- Operational zoom: reveal abbreviated designation and strength without enlarging the counter body disproportionately.
- Detail zoom: reveal full unit name, strength, order state, and relevant city/territory information through selection or a lightweight inspector—not permanent map text.
- Counters use collision-aware placement and screen-space sizing. They may spread or cluster, but never obscure each other, cities, or critical borders.
- Hit areas remain accessible even when the rendered counter is visually compact.

### 5. Make Orders And Outcomes Scale Correctly

- Routes are smooth vector curves with screen-space stroke widths and arrowheads.
- Outcome symbols are vector/SDF-style graphics with thin optical strokes and constant apparent size. They must remain sharp and balanced throughout the zoom range.
- Ordered units are visibly locked through icon/state treatment, not merely opacity or color.
- Resolution favors a small number of legible routes and outcome markers; dense narrative detail stays in the resolution panel.

### 6. Repair Turn Progression At The State Boundary

- `Start Next Turn` performs one state transition and routes from the resulting phase; screens do not guess the destination in parallel with the coordinator.
- Mixed, shared-device, and all-computer configurations receive integration coverage for the transition.
- The fix must not reintroduce unnecessary handoff screens when fewer than two people share the device.

## Delivery Sequence

1. Record asset provenance, generate the local relief height map, and register openly licensed administrative geometry to it.
2. Build the camera/input model and fix scroll capture, WASD, pointer gestures, and next-turn routing.
3. Introduce the 2.5D terrain renderer and align SVG interaction geometry over it.
4. Apply the visual hierarchy, northern Morocco composition, and semantic unit layers.
5. Replace route and outcome rendering with scale-independent vectors.
6. Tune desktop and mobile layouts from Playwright captures at overview, operational, and detail zoom.
7. Complete accessibility, performance, and regression verification before calling the revision complete.

## Quality Bar

Revision 4 is complete only when:

- Scrolling or pinching over the map changes only the map; the page never double-scrolls.
- Drag, pinch, wheel, controls, WASD, arrows, zoom keys, and reset behave consistently and pass browser integration tests.
- Terrain, ownership, units, routes, selection, and outcomes remain distinguishable without relying on hue alone.
- Unit symbols are recognizable at overview scale; designation and strength appear progressively at closer zooms.
- Borders, routes, and outcome icons remain crisp with stable optical weight throughout the supported zoom range.
- Spain, Portugal, the Balearics, and northern Morocco read as one intentional geographic composition; no land unit appears to float in water.
- `Start Next Turn` works for every supported commander assignment.
- The map maintains responsive interaction on the project's supported desktop and mobile test viewports and respects reduced-motion preferences.
- Playwright screenshots at overview, operational zoom, detail zoom, resolution, and mobile scale receive an explicit visual review.
- Unit, integration, and end-to-end coverage stays above the repository threshold, with new camera math and phase transitions tested directly.
- No internal planning copy, research rationale, source-selection notes, or quality-bar language appears in the shipped game.

